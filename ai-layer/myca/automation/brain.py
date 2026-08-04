"""
Second Brain & Session Memory (Obsidian-Inspired)

Provides a local-first knowledge vault with:
  - Session handover: save context/decisions/next-steps at end of session
  - Session resume: reload context from handover at start of new session
  - Vault indexing: scan Markdown files and build a searchable index
  - Auto-linking: automatically create [[wikilinks]] between related notes

All data stored locally in ~/.myca/notes/ and ~/.myca/myca_automation.db.
No Obsidian required, no cloud, no sync service.
"""

import json
import logging
import os
import re
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("myca.automation.brain")

# Default vault path
VAULT_PATH = Path("~/.myca/notes").expanduser()
HANDOVER_PATH = VAULT_PATH / "handovers"
DB_PATH = Path("~/.myca/myca_automation.db").expanduser()


# ── Database Helpers (knowledge_vault table) ───────────────────

class VaultDB:
    """Manages the knowledge_vault table in the automation DB."""

    @staticmethod
    def _conn():
        return sqlite3.connect(str(DB_PATH))

    @staticmethod
    def init_tables():
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = VaultDB._conn()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS knowledge_vault (
                id              TEXT PRIMARY KEY,
                title           TEXT NOT NULL,
                file_path       TEXT,
                content_preview TEXT,   -- first ~500 chars
                tags            TEXT,   -- JSON array of tags
                links           TEXT,   -- JSON array of [[wikilinks]]
                word_count      INTEGER,
                source_type     TEXT,   -- note, handover, scrape, spec
                created_at      REAL,
                updated_at      REAL
            );

            CREATE TABLE IF NOT EXISTS handover_sessions (
                id              TEXT PRIMARY KEY,
                summary         TEXT NOT NULL,
                decisions       TEXT,       -- JSON array
                next_steps      TEXT,       -- JSON array
                open_questions  TEXT,       -- JSON array
                context_files   TEXT,       -- JSON array of file paths
                session_start   REAL,
                session_end     REAL,
                created_at      REAL
            );

            CREATE INDEX IF NOT EXISTS idx_vault_tags ON knowledge_vault(tags);
            CREATE INDEX IF NOT EXISTS idx_vault_source ON knowledge_vault(source_type);
            CREATE INDEX IF NOT EXISTS idx_handover_time ON handover_sessions(created_at DESC);
        """)
        conn.commit()
        conn.close()

    # ── Vault Note CRUD ────────────────────────────────────────

    @staticmethod
    def save_note(note: dict):
        conn = VaultDB._conn()
        conn.execute("""
            INSERT OR REPLACE INTO knowledge_vault
            (id, title, file_path, content_preview, tags, links, word_count, source_type, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            note["id"], note["title"], note.get("file_path", ""),
            note.get("content_preview", "")[:500],
            json.dumps(note.get("tags", [])),
            json.dumps(note.get("links", [])),
            note.get("word_count", 0),
            note.get("source_type", "note"),
            note.get("created_at", time.time()),
            time.time()
        ))
        conn.commit()
        conn.close()

    @staticmethod
    def get_notes(source_type: Optional[str] = None, limit: int = 100) -> List[dict]:
        conn = VaultDB._conn()
        conn.row_factory = _dict_factory
        if source_type:
            rows = conn.execute(
                "SELECT * FROM knowledge_vault WHERE source_type = ? ORDER BY updated_at DESC LIMIT ?",
                (source_type, limit)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM knowledge_vault ORDER BY updated_at DESC LIMIT ?",
                (limit,)
            ).fetchall()
        conn.close()
        for r in rows:
            r["tags"] = json.loads(r.get("tags") or "[]")
            r["links"] = json.loads(r.get("links") or "[]")
        return rows

    @staticmethod
    def search_notes(query: str, limit: int = 20) -> List[dict]:
        conn = VaultDB._conn()
        conn.row_factory = _dict_factory
        rows = conn.execute(
            "SELECT * FROM knowledge_vault WHERE title LIKE ? OR content_preview LIKE ? OR tags LIKE ? ORDER BY updated_at DESC LIMIT ?",
            (f"%{query}%", f"%{query}%", f"%{query}%", limit)
        ).fetchall()
        conn.close()
        for r in rows:
            r["tags"] = json.loads(r.get("tags") or "[]")
            r["links"] = json.loads(r.get("links") or "[]")
        return rows

    @staticmethod
    def delete_note(note_id: str):
        conn = VaultDB._conn()
        conn.execute("DELETE FROM knowledge_vault WHERE id = ?", (note_id,))
        conn.commit()
        conn.close()

    # ── Handover Session CRUD ──────────────────────────────────

    @staticmethod
    def save_handover(handover: dict):
        conn = VaultDB._conn()
        conn.execute("""
            INSERT OR REPLACE INTO handover_sessions
            (id, summary, decisions, next_steps, open_questions, context_files, session_start, session_end, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            handover["id"], handover["summary"],
            json.dumps(handover.get("decisions", [])),
            json.dumps(handover.get("next_steps", [])),
            json.dumps(handover.get("open_questions", [])),
            json.dumps(handover.get("context_files", [])),
            handover.get("session_start", 0),
            handover.get("session_end", time.time()),
            time.time()
        ))
        conn.commit()
        conn.close()

    @staticmethod
    def get_latest_handover() -> Optional[dict]:
        conn = VaultDB._conn()
        conn.row_factory = _dict_factory
        row = conn.execute(
            "SELECT * FROM handover_sessions ORDER BY created_at DESC LIMIT 1"
        ).fetchone()
        conn.close()
        if row:
            row["decisions"] = json.loads(row.get("decisions") or "[]")
            row["next_steps"] = json.loads(row.get("next_steps") or "[]")
            row["open_questions"] = json.loads(row.get("open_questions") or "[]")
            row["context_files"] = json.loads(row.get("context_files") or "[]")
        return row

    @staticmethod
    def get_handover_history(limit: int = 10) -> List[dict]:
        conn = VaultDB._conn()
        conn.row_factory = _dict_factory
        rows = conn.execute(
            "SELECT * FROM handover_sessions ORDER BY created_at DESC LIMIT ?",
            (limit,)
        ).fetchall()
        conn.close()
        for r in rows:
            r["decisions"] = json.loads(r.get("decisions") or "[]")
            r["next_steps"] = json.loads(r.get("next_steps") or "[]")
            r["open_questions"] = json.loads(r.get("open_questions") or "[]")
            r["context_files"] = json.loads(r.get("context_files") or "[]")
        return rows


def _dict_factory(cursor, row):
    return {col[0]: row[idx] for idx, col in enumerate(cursor.description)}


# ── Second Brain Vault Engine ─────────────────────────────────

class SecondBrainVault:
    """
    Local-first knowledge vault with session memory.

    Inspired by the Obsidian + Claude workflow, but built into Myca
    so it works without Obsidian and without any cloud dependency.
    """

    def __init__(self, vault_path: Optional[str] = None, inference_engine=None):
        self.vault_path = Path(vault_path).expanduser() if vault_path else VAULT_PATH
        self.vault_path.mkdir(parents=True, exist_ok=True)
        HANDOVER_PATH.mkdir(parents=True, exist_ok=True)
        self.inference = inference_engine
        VaultDB.init_tables()

    # ── Handover: Save Session Context ─────────────────────────

    async def create_handover(self, summary: str, decisions: Optional[List[str]] = None,
                               next_steps: Optional[List[str]] = None,
                               open_questions: Optional[List[str]] = None,
                               context_files: Optional[List[str]] = None) -> dict:
        """
        Save a session handover — a snapshot of the current work context.
        This is the '/handover' equivalent from the Obsidian workflow.
        """
        handover_id = f"handover-{uuid.uuid4().hex[:8]}"
        now = time.time()

        handover = {
            "id": handover_id,
            "summary": summary,
            "decisions": decisions or [],
            "next_steps": next_steps or [],
            "open_questions": open_questions or [],
            "context_files": context_files or [],
            "session_start": now - 3600,  # Approximate
            "session_end": now,
        }

        # Save to DB
        VaultDB.save_handover(handover)

        # Also write a Markdown file for human-readable browsing
        md_content = self._handover_to_markdown(handover)
        handover_file = HANDOVER_PATH / f"{handover_id}.md"
        handover_file.write_text(md_content, encoding="utf-8")
        handover["file_path"] = str(handover_file)

        # Index in vault
        VaultDB.save_note({
            "id": handover_id,
            "title": f"Handover: {summary[:60]}",
            "file_path": str(handover_file),
            "content_preview": summary[:500],
            "tags": ["handover", "session"],
            "links": [],
            "word_count": len(summary.split()),
            "source_type": "handover"
        })

        logger.info(f"[BRAIN] Handover saved: {handover_id}")
        return handover

    def _handover_to_markdown(self, handover: dict) -> str:
        """Convert a handover dict to a readable Markdown document."""
        lines = [
            f"# Session Handover",
            f"",
            f"**Date:** {time.strftime('%Y-%m-%d %H:%M', time.localtime(handover.get('session_end', time.time())))}",
            f"**ID:** `{handover['id']}`",
            f"",
            f"## Summary",
            f"",
            handover["summary"],
            f"",
        ]

        if handover.get("decisions"):
            lines.append("## Decisions Made")
            lines.append("")
            for d in handover["decisions"]:
                lines.append(f"- {d}")
            lines.append("")

        if handover.get("next_steps"):
            lines.append("## Next Steps")
            lines.append("")
            for s in handover["next_steps"]:
                lines.append(f"- [ ] {s}")
            lines.append("")

        if handover.get("open_questions"):
            lines.append("## Open Questions")
            lines.append("")
            for q in handover["open_questions"]:
                lines.append(f"- ❓ {q}")
            lines.append("")

        if handover.get("context_files"):
            lines.append("## Context Files")
            lines.append("")
            for f in handover["context_files"]:
                lines.append(f"- `{f}`")
            lines.append("")

        return "\n".join(lines)

    # ── Resume: Reload Session Context ─────────────────────────

    async def load_handover(self, handover_id: Optional[str] = None) -> Optional[dict]:
        """
        Load the latest (or specific) handover to resume a session.
        This is the '/resume' equivalent from the Obsidian workflow.
        """
        if handover_id:
            conn = VaultDB._conn()
            conn.row_factory = _dict_factory
            row = conn.execute("SELECT * FROM handover_sessions WHERE id = ?", (handover_id,)).fetchone()
            conn.close()
            if row:
                row["decisions"] = json.loads(row.get("decisions") or "[]")
                row["next_steps"] = json.loads(row.get("next_steps") or "[]")
                row["open_questions"] = json.loads(row.get("open_questions") or "[]")
                row["context_files"] = json.loads(row.get("context_files") or "[]")
            return row
        else:
            return VaultDB.get_latest_handover()

    # ── Vault Indexing ─────────────────────────────────────────

    async def index_vault(self, vault_path: Optional[str] = None) -> dict:
        """
        Scan a directory of Markdown files and index them in the knowledge vault.
        Extracts titles, tags, wikilinks, and content previews.
        """
        scan_path = Path(vault_path).expanduser() if vault_path else self.vault_path
        if not scan_path.exists():
            return {"indexed": 0, "errors": 0, "message": f"Vault path not found: {scan_path}"}

        indexed = 0
        errors = 0

        for md_file in scan_path.rglob("*.md"):
            try:
                content = md_file.read_text(encoding="utf-8", errors="replace")
                title = self._extract_title(content, md_file.stem)
                tags = self._extract_tags(content)
                links = self._extract_wikilinks(content)

                note = {
                    "id": f"note-{uuid.uuid4().hex[:8]}",
                    "title": title,
                    "file_path": str(md_file),
                    "content_preview": content[:500],
                    "tags": tags,
                    "links": links,
                    "word_count": len(content.split()),
                    "source_type": "note"
                }
                VaultDB.save_note(note)
                indexed += 1
            except Exception as e:
                logger.warning(f"[BRAIN] Failed to index {md_file}: {e}")
                errors += 1

        logger.info(f"[BRAIN] Indexed {indexed} notes from {scan_path} ({errors} errors)")
        return {"indexed": indexed, "errors": errors, "vault_path": str(scan_path)}

    # ── Auto-Linking ───────────────────────────────────────────

    async def auto_link_notes(self) -> dict:
        """
        Analyze all indexed notes and automatically suggest/create
        [[wikilinks]] between related content based on title/tag matching.
        """
        notes = VaultDB.get_notes(limit=1000)
        if not notes:
            return {"links_created": 0, "message": "No notes in vault"}

        # Build title index for matching
        title_index = {}
        for note in notes:
            title_lower = note["title"].lower()
            title_index[title_lower] = note

        links_created = 0
        for note in notes:
            existing_links = set(note.get("links", []))
            content_lower = note.get("content_preview", "").lower()
            new_links = list(existing_links)

            for other_title, other_note in title_index.items():
                if other_note["id"] == note["id"]:
                    continue
                # Check if this note mentions the other note's title
                if other_title in content_lower and other_title not in existing_links:
                    new_links.append(other_title)
                    links_created += 1

            # Check tag overlap
            note_tags = set(note.get("tags", []))
            for other_note in notes:
                if other_note["id"] == note["id"]:
                    continue
                other_tags = set(other_note.get("tags", []))
                if note_tags & other_tags:  # Intersection
                    other_title = other_note["title"].lower()
                    if other_title not in new_links:
                        new_links.append(other_title)
                        links_created += 1

            if len(new_links) > len(existing_links):
                note["links"] = new_links
                VaultDB.save_note(note)

        logger.info(f"[BRAIN] Auto-linked {links_created} connections")
        return {"links_created": links_created}

    # ── Ingest Scraped Content ─────────────────────────────────

    async def ingest_scrape(self, scrape_result: dict) -> dict:
        """
        Ingest a web scrape result into the knowledge vault.
        Creates a Markdown note file and indexes it.
        """
        url = scrape_result.get("url", "")
        title = scrape_result.get("title", url)
        markdown = scrape_result.get("markdown", "")

        # Create note file
        safe_name = re.sub(r'[^\w\s-]', '', title)[:60].strip().replace(' ', '_')
        note_file = self.vault_path / "scrapes" / f"{safe_name}.md"
        note_file.parent.mkdir(parents=True, exist_ok=True)

        # Write markdown with frontmatter
        frontmatter = f"""---
source: {url}
scraped_at: {time.strftime('%Y-%m-%d %H:%M')}
title: "{title}"
---

# {title}

{markdown}
"""
        note_file.write_text(frontmatter, encoding="utf-8")

        # Index in vault
        note_id = f"scrape-{uuid.uuid4().hex[:8]}"
        note = {
            "id": note_id,
            "title": title,
            "file_path": str(note_file),
            "content_preview": markdown[:500],
            "tags": ["scrape", "web"],
            "links": [],
            "word_count": scrape_result.get("word_count", 0),
            "source_type": "scrape"
        }
        VaultDB.save_note(note)

        logger.info(f"[BRAIN] Ingested scrape: {title}")
        return note

    # ── Helper Methods ─────────────────────────────────────────

    @staticmethod
    def _extract_title(content: str, fallback: str) -> str:
        """Extract title from Markdown content (first # heading or YAML title)."""
        # Check YAML frontmatter
        yaml_match = re.match(r'^---\s*\n.*?title:\s*["\']?(.*?)["\']?\s*\n.*?---', content, re.DOTALL)
        if yaml_match:
            return yaml_match.group(1).strip()

        # Check first H1
        h1_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        if h1_match:
            return h1_match.group(1).strip()

        return fallback

    @staticmethod
    def _extract_tags(content: str) -> List[str]:
        """Extract tags from Markdown (YAML frontmatter tags or #hashtags)."""
        tags = []

        # YAML tags
        yaml_match = re.match(r'^---\s*\n(.*?)---', content, re.DOTALL)
        if yaml_match:
            yaml_content = yaml_match.group(1)
            tags_match = re.search(r'tags:\s*\[(.*?)\]', yaml_content)
            if tags_match:
                tags.extend(t.strip().strip('"\'') for t in tags_match.group(1).split(","))
            else:
                tags_match = re.findall(r'^\s*-\s+(\w+)\s*$', yaml_content, re.MULTILINE)
                # Only grab tags after a "tags:" line
                in_tags = False
                for line in yaml_content.split("\n"):
                    if line.strip().startswith("tags:"):
                        in_tags = True
                        continue
                    if in_tags and line.strip().startswith("- "):
                        tags.append(line.strip()[2:].strip())
                    elif in_tags and not line.strip().startswith("-"):
                        in_tags = False

        # Inline #hashtags (but not headings)
        for match in re.finditer(r'(?<!\w)#(\w{2,30})(?!\w)', content):
            tag = match.group(1)
            if tag not in tags:
                tags.append(tag)

        return tags

    @staticmethod
    def _extract_wikilinks(content: str) -> List[str]:
        """Extract [[wikilinks]] from Markdown content."""
        return re.findall(r'\[\[([^\]]+)\]\]', content)
