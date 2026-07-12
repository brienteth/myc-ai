"""
Myca File Indexer & Watcher
Handles background filesystem watching, change detection, and extraction queue scheduling.
"""
import os
import time
import uuid
import logging
import asyncio
import hashlib
import json
import aiosqlite
from pathlib import Path
from typing import List, Dict, Any, Optional

from .extractors import UniversalExtractor
from .chunker import TextChunker
from .embedding import EmbeddingEngine

logger = logging.getLogger("myca.library.indexer")

class FileIndexer:
    def __init__(self, library_engine):
        self.library = library_engine
        self.db_path = library_engine.db_path
        self.queue = asyncio.Queue()
        self.watched_dirs = [
            Path("~/Documents").expanduser(),
            Path("~/Desktop").expanduser(),
            Path("~/Downloads").expanduser(),
            Path("~/Pictures").expanduser(),
            Path("~/Music").expanduser(),
            Path("~/Videos").expanduser(),
            library_engine.uploads_dir
        ]
        self.worker_task = None
        self.watcher_task = None

    def start(self):
        """Starts background workers for index queue and watcher."""
        if not self.worker_task:
            self.worker_task = asyncio.create_task(self._queue_worker())
        if not self.watcher_task:
            self.watcher_task = asyncio.create_task(self._watch_loop())
        logger.info("[INDEXER] Background watch and queue worker tasks launched.")

    def stop(self):
        if self.worker_task:
            self.worker_task.cancel()
            self.worker_task = None
        if self.watcher_task:
            self.watcher_task.cancel()
            self.watcher_task = None
        logger.info("[INDEXER] Stopped background tasks.")

    async def _queue_worker(self):
        """Process queued file paths sequentially in background."""
        while True:
            try:
                task_item = await self.queue.get()
                path, f_type = task_item
                logger.info(f"[INDEXER] Processing queued file: {path.name}")
                await self.process_file(path, file_type=f_type)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[INDEXER] Error in queue worker: {e}")
            finally:
                self.queue.task_done()

    async def _watch_loop(self):
        """Poll watched folders for new or changed files."""
        # Initial wait for boot to settle down
        await asyncio.sleep(5)
        while True:
            try:
                logger.info("[INDEXER] Scanning watched folders...")
                for folder in self.watched_dirs:
                    if not folder.exists():
                        continue
                    # Non-recursive quick scan to avoid long freezes on user home dir
                    for item in folder.iterdir():
                        if item.is_file() and not item.name.startswith("."):
                            # Check if we should index
                            await self.check_and_queue(item)
                # Run cleanup for missing files
                await self.cleanup_deleted_files()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[INDEXER] Watcher loop error: {e}")
            
            # Poll every 60 seconds
            await asyncio.sleep(60)

    async def check_and_queue(self, file_path: Path):
        """Calculate hash and queue if new or modified."""
        try:
            stat = file_path.stat()
            size = stat.st_size
            modified = stat.st_mtime
            
            # Skip massive files (above 100MB) for vector indexing in basic watch
            if size > 100 * 1024 * 1024:
                return

            async with aiosqlite.connect(self.db_path) as db:
                async with db.execute(
                    "SELECT id, modified_at, size_bytes FROM files WHERE path = ?",
                    (str(file_path),)
                ) as cursor:
                    row = await cursor.fetchone()
                    if row:
                        db_modified, db_size = row[1], row[2]
                        if abs(db_modified - modified) < 1.0 and db_size == size:
                            return # Up to date
            
            # Add to queue
            await self.queue.put((file_path, "all"))
            logger.info(f"[INDEXER] Queued for indexing: {file_path.name}")
        except Exception as e:
            logger.error(f"[INDEXER] Failed checking {file_path.name}: {e}")

    async def cleanup_deleted_files(self):
        """Delete entries from database if files no longer exist on disk."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT id, path FROM files WHERE path IS NOT NULL") as cursor:
                rows = await cursor.fetchall()

        to_delete = []
        for r in rows:
            if not Path(r["path"]).exists():
                to_delete.append(r["id"])

        if to_delete:
            logger.info(f"[INDEXER] Cleaning up {len(to_delete)} missing files from database.")
            async with aiosqlite.connect(self.db_path) as db:
                for f_id in to_delete:
                    await db.execute("DELETE FROM files WHERE id = ?", (f_id,))
                await db.commit()

    async def process_file(self, file_path: Path, file_id: Optional[str] = None, file_type: str = "all") -> dict:
        """
        Main pipeline: Universal Extraction -> Chunking -> Embeddings -> Database
        """
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        file_id = file_id or str(uuid.uuid4())
        created_at = time.time()
        stat = file_path.stat()
        size_bytes = stat.st_size
        modified_at = stat.st_mtime

        # Calculate file hash for uniqueness / dedup
        sha = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(8192):
                sha.update(chunk)
        file_hash = sha.hexdigest()

        # Check dedup before writing
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute("SELECT id FROM files WHERE hash = ?", (file_hash,)) as cursor:
                row = await cursor.fetchone()
                if row and row[0] != file_id:
                    logger.info(f"[INDEXER] File {file_path.name} already exists as {row[0]}, updating path reference only.")
                    await db.execute(
                        "UPDATE files SET path = ?, modified_at = ? WHERE id = ?",
                        (str(file_path), modified_at, row[0])
                    )
                    await db.commit()
                    return {"id": row[0], "filename": file_path.name, "status": "deduped"}

        # 1. Extraction Pipeline
        extracted = UniversalExtractor.extract_all(file_path, file_type=file_type)
        content = extracted["content"]
        meta = extracted["metadata"]
        thumbnail = extracted["thumbnail"]
        extracted_type = extracted["type"]

        summary = await self.library._generate_summary(content)

        # 2. Database Insert
        async with aiosqlite.connect(self.db_path) as db:
            # Upsert core files table
            await db.execute('''
                INSERT OR REPLACE INTO files (
                    id, filename, path, type, content, summary, size_bytes, hash,
                    author, language, page_count, duration_seconds, resolution, tags,
                    indexed_at, created_at, modified_at, last_accessed
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                file_id, file_path.name, str(file_path), extracted_type, content, summary, size_bytes, file_hash,
                meta.get("author", "Unknown"), meta.get("language", "en"), meta.get("page_count", 1),
                meta.get("duration_seconds", 0.0), meta.get("resolution", "Unknown"),
                json.dumps(meta.get("classes", []) + meta.get("functions", []) + meta.get("imports", [])),
                created_at, created_at, modified_at, created_at
            ))

            # Delete old chunks & embeddings if file is updated
            await db.execute("DELETE FROM chunks WHERE file_id = ?", (file_id,))
            await db.execute("DELETE FROM embeddings WHERE file_id = ?", (file_id,))

            # Save thumbnail if generated
            if thumbnail:
                await db.execute('''
                    INSERT OR REPLACE INTO thumbnails (file_id, data, mime)
                    VALUES (?, ?, ?)
                ''', (file_id, thumbnail, "image/webp"))

            # Save extensible metadata keys
            for k, v in meta.items():
                if isinstance(v, (str, int, float, bool)):
                    await db.execute('''
                        INSERT OR REPLACE INTO metadata (id, file_id, key, value)
                        VALUES (?, ?, ?, ?)
                    ''', (str(uuid.uuid4()), file_id, k, str(v)))

            await db.commit()

        # 3. Chunking & Embeddings
        await self.generate_chunks_and_embeddings(file_id, content)

        return {
            "id": file_id,
            "filename": file_path.name,
            "type": extracted_type,
            "summary": summary,
            "size_bytes": size_bytes,
            "created_at": created_at
        }

    async def generate_chunks_and_embeddings(self, file_id: str, text: str):
        """Chunk text and generate vector embeddings using EmbeddingEngine."""
        if not text:
            return

        # 1. Chunker
        chunks = TextChunker.chunk_text(text)
        if not chunks:
            return

        # 2. Db Insertion and Batch embeddings
        chunk_texts = [c[0] for c in chunks]
        
        embeddings_list = []
        if self.library.embedding_engine:
            try:
                embeddings_list = await self.library.embedding_engine.embed_chunks(chunk_texts)
            except Exception as e:
                logger.error(f"[INDEXER] Embedding generation error: {e}")

        async with aiosqlite.connect(self.db_path) as db:
            for i, (chunk_text, start_off, end_off) in enumerate(chunks):
                chunk_id = str(uuid.uuid4())
                await db.execute('''
                    INSERT INTO chunks (id, file_id, chunk_index, content, start_offset, end_offset)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (chunk_id, file_id, i, chunk_text, start_off, end_off))

                # Store embedding if generated
                if i < len(embeddings_list) and embeddings_list[i] is not None:
                    vector_bytes = embeddings_list[i].tobytes()
                    await db.execute('''
                        INSERT INTO embeddings (id, chunk_id, file_id, vector, model, created_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (str(uuid.uuid4()), chunk_id, file_id, vector_bytes, EmbeddingEngine.MODEL_NAME, time.time()))

            await db.commit()
