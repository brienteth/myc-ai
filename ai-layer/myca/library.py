"""
Myca Library Service — Handles file ingestion, text extraction, DB storage, and RAG context.
"""
import os
import time
import uuid
import logging
import asyncio
import aiosqlite
import httpx
from pathlib import Path

logger = logging.getLogger("myca.library")

class LibraryService:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.data_dir / "library.db"
        self.uploads_dir = self.data_dir / "uploads"
        self.uploads_dir.mkdir(parents=True, exist_ok=True)

    async def init_db(self):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute('''
                CREATE TABLE IF NOT EXISTS files (
                    id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    type TEXT NOT NULL,
                    content TEXT,
                    summary TEXT,
                    url TEXT,
                    size_bytes INTEGER,
                    created_at REAL
                )
            ''')
            await db.execute('''
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            ''')
            await db.execute('''
                CREATE TABLE IF NOT EXISTS trusted_nodes (
                    node_id TEXT PRIMARY KEY,
                    trusted INTEGER DEFAULT 1,
                    added_at REAL
                )
            ''')
            await db.commit()

    async def _generate_summary(self, content: str) -> str:
        if not content:
            return "No content to read."
        prompt = f"Summarize the following text in a single short sentence (max 10 words). Write nothing else:\n\n{content[:1000]}"
        
        # Try local inference engine if initialized
        if hasattr(self, 'inference_engine') and self.inference_engine:
            try:
                summary = await self.inference_engine.generate(prompt)
                if summary:
                    return summary.strip()
            except Exception as e:
                logger.warning(f"Local summary generation failed: {e}")

        # Fallback to Ollama or standard message
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    "http://localhost:11434/api/generate",
                    json={"model": os.environ.get("MYCA_MODEL", "qwen2.5-coder:7b"), "prompt": prompt, "stream": False},
                    timeout=5.0
                )
                if res.status_code == 200:
                    return res.json().get("response", "").strip()
        except Exception as e:
            logger.warning(f"Summary generation via Ollama fallback failed: {e}")
        
        return content[:60].strip() + "..." if len(content) > 60 else "No summary available."

    async def add_file(self, filename: str, content_bytes: bytes, file_type: str) -> dict:
        file_id = str(uuid.uuid4())
        created_at = time.time()
        size_bytes = len(content_bytes)

        # Save to disk
        file_path = self.uploads_dir / f"{file_id}_{filename}"
        with open(file_path, "wb") as f:
            f.write(content_bytes)

        extracted_text = ""
        
        try:
            if file_type == "document":
                if filename.lower().endswith(".pdf"):
                    from pypdf import PdfReader
                    reader = PdfReader(file_path)
                    extracted_text = "\n".join(page.extract_text() for page in reader.pages if page.extract_text())
                else:
                    extracted_text = content_bytes.decode('utf-8', errors='ignore')
            elif file_type == "code":
                extracted_text = content_bytes.decode('utf-8', errors='ignore')
            elif file_type == "audio":
                try:
                    from faster_whisper import WhisperModel
                    logger.info("Loading faster-whisper tiny model for audio transcription...")
                    model = WhisperModel("tiny", device="cpu", compute_type="int8")
                    segments, info = model.transcribe(str(file_path), beam_size=5)
                    extracted_text = " ".join([segment.text for segment in segments])
                except ImportError:
                    extracted_text = "[Audio transcript pending - faster-whisper not installed]"
            elif file_type == "image":
                extracted_text = "[Image file. Visual content analysis not implemented yet.]"
            elif file_type == "video":
                extracted_text = "[Video file. Video content analysis not implemented yet.]"
            else:
                extracted_text = ""
        except Exception as e:
            logger.error(f"Error extracting text from {filename}: {e}")
            extracted_text = f"[Content extraction error: {str(e)}]"

        summary = await self._generate_summary(extracted_text)

        async with aiosqlite.connect(self.db_path) as db:
            await db.execute('''
                INSERT INTO files (id, filename, type, content, summary, size_bytes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (file_id, filename, file_type, extracted_text, summary, size_bytes, created_at))
            await db.commit()

        return {
            "id": file_id,
            "filename": filename,
            "type": file_type,
            "summary": summary,
            "size_bytes": size_bytes,
            "created_at": created_at
        }

    async def add_url(self, url: str) -> dict:
        file_id = str(uuid.uuid4())
        created_at = time.time()
        filename = url.split("://")[-1].split("/")[0] # Simple domain as filename

        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(url, timeout=10.0)
                extracted_text = res.text # Basic text, should parse HTML in prod
                size_bytes = len(res.content)
        except Exception as e:
            extracted_text = f"[URL read error: {str(e)}]"
            size_bytes = 0

        summary = await self._generate_summary(extracted_text)

        async with aiosqlite.connect(self.db_path) as db:
            await db.execute('''
                INSERT INTO files (id, filename, type, content, summary, url, size_bytes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (file_id, filename, "research", extracted_text, summary, url, size_bytes, created_at))
            await db.commit()

        return {
            "id": file_id,
            "filename": filename,
            "type": "research",
            "summary": summary,
            "size_bytes": size_bytes,
            "created_at": created_at
        }

    async def list_files(self, type_filter: str = "all", search_query: str = "") -> list[dict]:
        query = "SELECT id, filename, type, summary, size_bytes, created_at FROM files WHERE 1=1"
        params = []

        if type_filter and type_filter != "all" and type_filter != "recent":
            query += " AND type = ?"
            params.append(type_filter)
        
        if search_query:
            query += " AND (filename LIKE ? OR summary LIKE ? OR content LIKE ?)"
            like_q = f"%{search_query}%"
            params.extend([like_q, like_q, like_q])

        query += " ORDER BY created_at DESC"

        if type_filter == "recent":
            query += " LIMIT 20"

        files = []
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(query, tuple(params)) as cursor:
                async for row in cursor:
                    files.append(dict(row))
        return files

    async def get_file(self, file_id: str) -> dict:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT * FROM files WHERE id = ?", (file_id,)) as cursor:
                row = await cursor.fetchone()
                if row:
                    d = dict(row)
                    if d.get("content"):
                        d["content"] = d["content"][:2000] # send excerpt only
                    return d
        return None

    async def delete_file(self, file_id: str):
        async with aiosqlite.connect(self.db_path) as db:
            # Get filename first to delete from disk
            async with db.execute("SELECT filename FROM files WHERE id = ?", (file_id,)) as cursor:
                row = await cursor.fetchone()
                if row:
                    file_path = self.uploads_dir / f"{file_id}_{row[0]}"
                    if file_path.exists():
                        file_path.unlink()
            
            await db.execute("DELETE FROM files WHERE id = ?", (file_id,))
            await db.commit()

    async def delete_all(self):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM files")
            await db.commit()
        
        # Delete from disk
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

    async def get_relevant_context(self, user_query: str) -> str:
        """Basic RAG: keyword match against summaries/content"""
        words = [w.lower() for w in user_query.split() if len(w) > 3]
        if not words:
            return ""

        query = "SELECT filename, content FROM files WHERE "
        conditions = []
        params = []
        for w in words:
            conditions.append("(filename LIKE ? OR summary LIKE ?)")
            like_w = f"%{w}%"
            params.extend([like_w, like_w])
        
        query += " OR ".join(conditions) + " LIMIT 2"

        context_texts = []
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(query, tuple(params)) as cursor:
                async for row in cursor:
                    filename, content = row[0], row[1]
                    if content:
                        context_texts.append(f"Belge: {filename}\nİçerik:\n{content[:1500]}\n")
        
        if context_texts:
            return "\n".join(context_texts)
        return ""
