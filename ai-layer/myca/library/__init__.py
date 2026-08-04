"""
Myca Library Engine (Phase 2.4)
Core entrypoint of the Universal Library package.
Manages SQLite schema, migrations, access logging, and database operations.
"""
import os
import time
import uuid
import logging
import sqlite3
import aiosqlite
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional

logger = logging.getLogger("myca.library")

class LibraryEngine:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.data_dir / "library.db"
        self.uploads_dir = self.data_dir / "uploads"
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.inference_engine = None
        self.embedding_engine = None
        self.indexer = None

    async def init_db(self):
        async with aiosqlite.connect(self.db_path) as db:
            # Check for migration/schema evolution
            try:
                cursor = await db.execute("PRAGMA table_info(files)")
                columns = [row[1] for row in await cursor.fetchall()]
                if columns and "hash" not in columns:
                    logger.info("Migrating old library database schema...")
                    await db.execute("DROP TABLE IF EXISTS files")
                    await db.execute("DROP TABLE IF EXISTS settings")
                    await db.execute("DROP TABLE IF EXISTS trusted_nodes")
            except Exception as e:
                logger.warning(f"Error checking database table info: {e}")

            # 1. files table
            await db.execute('''
                CREATE TABLE IF NOT EXISTS files (
                    id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    path TEXT,
                    type TEXT NOT NULL,
                    mime TEXT,
                    content TEXT,
                    summary TEXT,
                    url TEXT,
                    size_bytes INTEGER,
                    hash TEXT,
                    author TEXT,
                    language TEXT,
                    page_count INTEGER,
                    duration_seconds REAL,
                    resolution TEXT,
                    tags TEXT,
                    favorite INTEGER DEFAULT 0,
                    indexed_at REAL,
                    created_at REAL,
                    modified_at REAL,
                    last_accessed REAL
                )
            ''')

            # 2. chunks table
            await db.execute('''
                CREATE TABLE IF NOT EXISTS chunks (
                    id TEXT PRIMARY KEY,
                    file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
                    chunk_index INTEGER,
                    content TEXT NOT NULL,
                    start_offset INTEGER,
                    end_offset INTEGER
                )
            ''')

            # 3. embeddings table
            await db.execute('''
                CREATE TABLE IF NOT EXISTS embeddings (
                    id TEXT PRIMARY KEY,
                    chunk_id TEXT REFERENCES chunks(id) ON DELETE CASCADE,
                    file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
                    vector BLOB NOT NULL,
                    model TEXT DEFAULT 'all-MiniLM-L6-v2',
                    created_at REAL
                )
            ''')

            # 4. metadata table
            await db.execute('''
                CREATE TABLE IF NOT EXISTS metadata (
                    id TEXT PRIMARY KEY,
                    file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
                    key TEXT NOT NULL,
                    value TEXT
                )
            ''')

            # 5. thumbnails table
            await db.execute('''
                CREATE TABLE IF NOT EXISTS thumbnails (
                    file_id TEXT PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
                    data BLOB,
                    mime TEXT DEFAULT 'image/webp',
                    width INTEGER,
                    height INTEGER
                )
            ''')

            # 6. collections table
            await db.execute('''
                CREATE TABLE IF NOT EXISTS collections (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    created_at REAL
                )
            ''')

            # 7. collection_items table
            await db.execute('''
                CREATE TABLE IF NOT EXISTS collection_items (
                    collection_id TEXT REFERENCES collections(id) ON DELETE CASCADE,
                    file_id TEXT REFERENCES files(id) ON DELETE CASCADE,
                    added_at REAL,
                    PRIMARY KEY (collection_id, file_id)
                )
            ''')

            # 8. access_history table
            await db.execute('''
                CREATE TABLE IF NOT EXISTS access_history (
                    id TEXT PRIMARY KEY,
                    file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
                    action TEXT NOT NULL,
                    timestamp REAL
                )
            ''')

            # 9. search_cache table
            await db.execute('''
                CREATE TABLE IF NOT EXISTS search_cache (
                    query_hash TEXT PRIMARY KEY,
                    query TEXT,
                    results TEXT,
                    created_at REAL
                )
            ''')

            # 10. Legacy settings (retained for compatibility)
            await db.execute('''
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            ''')

            # 11. Legacy trusted_nodes (retained for compatibility)
            await db.execute('''
                CREATE TABLE IF NOT EXISTS trusted_nodes (
                    node_id TEXT PRIMARY KEY,
                    trusted INTEGER DEFAULT 1,
                    added_at REAL
                )
            ''')

            await db.commit()
        logger.info("[LIBRARY] Database initialized successfully.")

    async def _generate_summary(self, content: str) -> str:
        if not content:
            return "No content to read."
        prompt = f"Summarize the following text in a single short sentence (max 10 words). Write nothing else:\n\n{content[:1000]}"
        
        # Try local inference engine if initialized
        if self.inference_engine:
            try:
                summary = await self.inference_engine.generate(prompt)
                if summary:
                    return summary.strip()
            except Exception as e:
                logger.warning(f"Local summary generation failed: {e}")

        return content[:60].strip() + "..." if len(content) > 60 else "No summary available."

    async def add_file(self, filename: str, content_bytes: bytes, file_type: str) -> dict:
        """Fallback manual upload handler."""
        file_id = str(uuid.uuid4())
        created_at = time.time()
        size_bytes = len(content_bytes)

        # Save to disk
        file_path = self.uploads_dir / f"{file_id}_{filename}"
        with open(file_path, "wb") as f:
            f.write(content_bytes)

        # Calculate file hash
        sha = hashlib.sha256()
        sha.update(content_bytes)
        file_hash = sha.hexdigest()

        # Run extraction & chunking & embedding
        from .indexer import FileIndexer
        indexer = FileIndexer(self)
        info = await indexer.process_file(file_path, file_id=file_id, file_type=file_type)

        return info

    async def add_url(self, url: str) -> dict:
        file_id = str(uuid.uuid4())
        created_at = time.time()
        filename = url.split("://")[-1].split("/")[0] # Simple domain as filename

        try:
            import httpx
            async with httpx.AsyncClient() as client:
                res = await client.get(url, timeout=10.0)
                extracted_text = res.text
                size_bytes = len(res.content)
        except Exception as e:
            extracted_text = f"[URL read error: {str(e)}]"
            size_bytes = 0

        summary = await self._generate_summary(extracted_text)
        
        # Calculate text hash
        sha = hashlib.sha256()
        sha.update(extracted_text.encode('utf-8', errors='ignore'))
        file_hash = sha.hexdigest()

        async with aiosqlite.connect(self.db_path) as db:
            await db.execute('''
                INSERT INTO files (id, filename, type, content, summary, url, size_bytes, hash, created_at, indexed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (file_id, filename, "research", extracted_text, summary, url, size_bytes, file_hash, created_at, created_at))
            await db.commit()

        # Try to chunk and embed research items
        try:
            from .indexer import FileIndexer
            indexer = FileIndexer(self)
            await indexer.generate_chunks_and_embeddings(file_id, extracted_text)
        except Exception as e:
            logger.error(f"Error embedding URL content: {e}")

        return {
            "id": file_id,
            "filename": filename,
            "type": "research",
            "summary": summary,
            "size_bytes": size_bytes,
            "created_at": created_at
        }

    async def list_files(self, type_filter: str = "all", search_query: str = "") -> List[dict]:
        """Simple list fallback."""
        return await self.hybrid_search(search_query, type_filter=type_filter)

    async def hybrid_search(self, query: str, type_filter: str = "all", limit: int = 50) -> List[Dict[str, Any]]:
        """Hybrid Search: Combining semantic ANN search with SQL LIKE keyword search."""
        if not query:
            # Empty query -> fetch by recency/filter
            q = "SELECT id, filename, type, summary, size_bytes, created_at, favorite FROM files WHERE 1=1"
            params = []
            if type_filter and type_filter != "all" and type_filter != "recent":
                q += " AND type = ?"
                params.append(type_filter)
            q += " ORDER BY created_at DESC LIMIT ?"
            params.append(limit)

            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row
                async with db.execute(q, tuple(params)) as cursor:
                    rows = await cursor.fetchall()
                    return [dict(row) for row in rows]

        # Standard keyword search
        like_q = f"%{query}%"
        kw_sql = """
            SELECT id, filename, type, summary, size_bytes, created_at, favorite, 1.0 AS score
            FROM files
            WHERE (filename LIKE ? OR summary LIKE ? OR content LIKE ? OR tags LIKE ?)
        """
        kw_params = [like_q, like_q, like_q, like_q]
        if type_filter and type_filter != "all" and type_filter != "recent":
            kw_sql += " AND type = ?"
            kw_params.append(type_filter)
        kw_sql += " LIMIT ?"
        kw_params.append(limit)

        kw_results = {}
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(kw_sql, tuple(kw_params)) as cursor:
                for row in await cursor.fetchall():
                    kw_results[row["id"]] = dict(row)

        # Semantic search if embedding engine is available
        semantic_results = {}
        if self.embedding_engine and query:
            try:
                q_vec = await self.embedding_engine.embed_text(query)
                if q_vec is not None:
                    # Query all embeddings
                    async with aiosqlite.connect(self.db_path) as db:
                        db.row_factory = aiosqlite.Row
                        # Fetch vectors
                        async with db.execute("SELECT file_id, chunk_id, vector FROM embeddings") as cursor:
                            rows = await cursor.fetchall()
                            
                        # Compute similarity
                        import numpy as np
                        matches = []
                        for r in rows:
                            f_id = r["file_id"]
                            v_bytes = r["vector"]
                            v = np.frombuffer(v_bytes, dtype=np.float32)
                            
                            # Cosine similarity
                            dot = np.dot(q_vec, v)
                            norm_q = np.linalg.norm(q_vec)
                            norm_v = np.linalg.norm(v)
                            sim = dot / (norm_q * norm_v) if norm_q > 0 and norm_v > 0 else 0.0
                            
                            if sim > 0.4:  # Threshold
                                matches.append((f_id, sim))
                        
                        # Sort and pick top unique files
                        matches.sort(key=lambda x: x[1], reverse=True)
                        seen_files = set()
                        for f_id, score in matches:
                            if f_id in seen_files:
                                continue
                            seen_files.add(f_id)
                            
                            # Fetch file details
                            async with db.execute(
                                "SELECT id, filename, type, summary, size_bytes, created_at, favorite FROM files WHERE id = ?",
                                (f_id,)
                            ) as cursor:
                                f_row = await cursor.fetchone()
                                if f_row:
                                    f_dict = dict(f_row)
                                    f_dict["score"] = float(score)
                                    # Filter by type
                                    if type_filter and type_filter != "all" and type_filter != "recent":
                                        if f_dict["type"] != type_filter:
                                            continue
                                    semantic_results[f_id] = f_dict
                                    if len(semantic_results) >= limit:
                                        break
            except Exception as e:
                logger.error(f"Semantic search error: {e}")

        # Merge and re-rank (reciprocal rank fusion style or simple score merge)
        merged = {}
        # Union
        for f_id, res in kw_results.items():
            merged[f_id] = res
            
        for f_id, res in semantic_results.items():
            if f_id in merged:
                # Boost score
                merged[f_id]["score"] = max(merged[f_id].get("score", 1.0), res["score"]) + 0.2
            else:
                merged[f_id] = res

        results = list(merged.values())
        # Sort by score descending, then created_at descending
        results.sort(key=lambda x: (x.get("score", 1.0), x.get("created_at", 0)), reverse=True)
        return results[:limit]

    async def get_file(self, file_id: str) -> Optional[dict]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT * FROM files WHERE id = ?", (file_id,)) as cursor:
                row = await cursor.fetchone()
                if row:
                    d = dict(row)
                    # Exclude huge content to avoid network overload, but send preview excerpt
                    if d.get("content"):
                        d["content"] = d["content"][:4000]
                    return d
        return None

    async def delete_file(self, file_id: str):
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute("SELECT filename, path FROM files WHERE id = ?", (file_id,)) as cursor:
                row = await cursor.fetchone()
                if row:
                    filename, path = row[0], row[1]
                    # If it was an upload (saved in uploads_dir), delete the file
                    if not path:
                        file_path = self.uploads_dir / f"{file_id}_{filename}"
                        if file_path.exists():
                            file_path.unlink()
            
            await db.execute("DELETE FROM files WHERE id = ?", (file_id,))
            await db.commit()

    async def delete_all(self):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM files")
            await db.commit()
        
        # Delete uploads
        for f in self.uploads_dir.glob("*"):
            if f.is_file():
                f.unlink()

    async def get_stats(self) -> dict:
        stats = {"total_files": 0, "total_size_bytes": 0, "by_type": {}}
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute("SELECT count(*), sum(size_bytes) FROM files") as cursor:
                row = await cursor.fetchone()
                if row:
                    stats["total_files"] = row[0] or 0
                    stats["total_size_bytes"] = row[1] or 0
            
            async with db.execute("SELECT type, count(*), sum(size_bytes) FROM files GROUP BY type") as cursor:
                async for row in cursor:
                    stats["by_type"][row[0]] = {
                        "count": row[1],
                        "size_bytes": row[2] or 0
                    }
        return stats

    async def toggle_favorite(self, file_id: str) -> bool:
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute("SELECT favorite FROM files WHERE id = ?", (file_id,)) as cursor:
                row = await cursor.fetchone()
                if row is None:
                    return False
                new_fav = 1 if row[0] == 0 else 0
                await db.execute("UPDATE files SET favorite = ? WHERE id = ?", (new_fav, file_id))
                await db.commit()
                return bool(new_fav)

    async def record_access(self, file_id: str, action: str = "opened"):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute('''
                INSERT INTO access_history (id, file_id, action, timestamp)
                VALUES (?, ?, ?, ?)
            ''', (str(uuid.uuid4()), file_id, action, time.time()))
            await db.execute('''
                UPDATE files SET last_accessed = ? WHERE id = ?
            ''', (time.time(), file_id))
            await db.commit()

    async def get_recent(self, limit: int = 20) -> List[Dict[str, Any]]:
        q = """
            SELECT f.id, f.filename, f.type, f.summary, f.size_bytes, h.timestamp as created_at, f.favorite
            FROM access_history h
            JOIN files f ON h.file_id = f.id
            ORDER BY h.timestamp DESC
            LIMIT ?
        """
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(q, (limit,)) as cursor:
                rows = await cursor.fetchall()
                # Deduplicate by file ID
                seen = set()
                dedup = []
                for r in rows:
                    if r["id"] not in seen:
                        seen.add(r["id"])
                        dedup.append(dict(r))
                return dedup

    async def get_suggestions(self, partial: str) -> List[str]:
        if not partial:
            return []
        like_q = f"{partial}%"
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT filename FROM files WHERE filename LIKE ? LIMIT 5",
                (like_q,)
            ) as cursor:
                rows = await cursor.fetchall()
                return [r[0] for r in rows]

    async def get_relevant_context(self, user_query: str) -> str:
        """RAG matching via hybrid search."""
        files = await self.hybrid_search(user_query, limit=2)
        context_texts = []
        for f in files:
            file_id = f["id"]
            full_file = await self.get_file(file_id)
            if full_file and full_file.get("content"):
                context_texts.append(f"Document: {full_file['filename']}\nContent:\n{full_file['content'][:2000]}\n")
        return "\n".join(context_texts)

# Alias for compatibility with node.py/api.py
LibraryService = LibraryEngine
