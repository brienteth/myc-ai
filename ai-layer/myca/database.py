"""
Myca Database — Persistent chat history in SQLite.

Stores conversations and messages in ~/.myca/myca.db.
No cloud, no sync — everything lives on the device.
"""

import sqlite3
import time
import uuid
from pathlib import Path
from typing import Optional

DB_PATH = Path("~/.myca/myca.db").expanduser()


def init_db():
    """Create tables if they don't exist."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS conversations (
            id          TEXT PRIMARY KEY,
            title       TEXT,
            created_at  REAL,
            updated_at  REAL,
            node_used   TEXT
        );

        CREATE TABLE IF NOT EXISTS messages (
            id                  TEXT PRIMARY KEY,
            conversation_id     TEXT,
            role                TEXT,
            content             TEXT,
            node_used           TEXT,
            node_display        TEXT,
            tokens_per_second   REAL,
            total_tokens        INTEGER,
            failover_occurred   INTEGER DEFAULT 0,
            failover_from       TEXT,
            created_at          REAL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        );

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_messages_conv
            ON messages(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_conv_updated
            ON conversations(updated_at DESC);
    """)
    conn.commit()
    conn.close()


def save_message(conv_id: str, role: str, content: str, meta: dict = None) -> str:
    """Insert a message; auto-creates conversation row if needed."""
    meta = meta or {}
    conn = sqlite3.connect(DB_PATH)
    msg_id = str(uuid.uuid4())
    now = time.time()
    title = (content[:60] + "…") if len(content) > 60 else content

    # Auto-create conversation
    conn.execute(
        """INSERT OR IGNORE INTO conversations
           (id, title, created_at, updated_at, node_used)
           VALUES (?, ?, ?, ?, ?)""",
        (conv_id, title, now, now, meta.get("node_used", "local")),
    )

    conn.execute(
        """INSERT INTO messages
           (id, conversation_id, role, content,
            node_used, node_display, tokens_per_second,
            total_tokens, failover_occurred, failover_from, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            msg_id, conv_id, role, content,
            meta.get("node_used", "local"),
            meta.get("node_display", "Bu Cihaz"),
            meta.get("tokens_per_second", 0.0),
            meta.get("total_tokens", 0),
            int(bool(meta.get("failover_occurred", False))),
            meta.get("failover_from"),
            now,
        ),
    )

    # Update conversation's updated_at; set title from first user message
    if role == "user":
        conn.execute(
            "UPDATE conversations SET updated_at=?, title=? WHERE id=? AND title=''",
            (now, title, conv_id),
        )
    else:
        conn.execute(
            "UPDATE conversations SET updated_at=? WHERE id=?",
            (now, conv_id),
        )

    conn.commit()
    conn.close()
    return msg_id


def get_conversations(limit: int = 50) -> list[dict]:
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        """SELECT id, title, created_at, updated_at, node_used
           FROM conversations
           ORDER BY updated_at DESC
           LIMIT ?""",
        (limit,),
    ).fetchall()
    conn.close()
    return [
        {"id": r[0], "title": r[1], "created_at": r[2],
         "updated_at": r[3], "node_used": r[4]}
        for r in rows
    ]


def get_messages(conv_id: str) -> list[dict]:
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        """SELECT role, content, node_used, node_display,
                  tokens_per_second, total_tokens,
                  failover_occurred, failover_from, created_at
           FROM messages
           WHERE conversation_id=?
           ORDER BY created_at ASC""",
        (conv_id,),
    ).fetchall()
    conn.close()
    return [
        {
            "role": r[0], "content": r[1],
            "node_used": r[2], "node_display": r[3],
            "tps": r[4], "total_tokens": r[5],
            "failover_occurred": bool(r[6]),
            "failover_from": r[7], "created_at": r[8],
        }
        for r in rows
    ]


def delete_all_history():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM messages")
    conn.execute("DELETE FROM conversations")
    conn.commit()
    conn.close()


def delete_conversation(conv_id: str):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM messages WHERE conversation_id=?", (conv_id,))
    conn.execute("DELETE FROM conversations WHERE id=?", (conv_id,))
    conn.commit()
    conn.close()


def get_stats() -> dict:
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute(
        """SELECT
             COUNT(DISTINCT conversation_id) AS conv_count,
             COUNT(*) AS msg_count,
             MIN(created_at) AS first_message
           FROM messages"""
    ).fetchone()
    conn.close()
    return {
        "conversations": row[0] or 0,
        "messages": row[1] or 0,
        "since": row[2],
    }


def export_all() -> dict:
    """Return all conversations + messages as a dict (for JSON export)."""
    convs = get_conversations(limit=100_000)
    for c in convs:
        c["messages"] = get_messages(c["id"])
    return {"version": 1, "exported_at": time.time(), "conversations": convs}


def import_backup(data: dict):
    """Merge conversations from a backup dict (no duplicates by id)."""
    convs = data.get("conversations", [])
    for conv in convs:
        msgs = conv.pop("messages", [])
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            """INSERT OR IGNORE INTO conversations
               (id, title, created_at, updated_at, node_used)
               VALUES (?, ?, ?, ?, ?)""",
            (conv["id"], conv.get("title", ""), conv.get("created_at", 0),
             conv.get("updated_at", 0), conv.get("node_used", "local")),
        )
        for m in msgs:
            msg_id = str(uuid.uuid4())
            conn.execute(
                """INSERT OR IGNORE INTO messages
                   (id, conversation_id, role, content,
                    node_used, node_display, tokens_per_second,
                    total_tokens, failover_occurred, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    msg_id, conv["id"], m.get("role", "user"),
                    m.get("content", ""), m.get("node_used", "local"),
                    m.get("node_display", "Bu Cihaz"),
                    m.get("tps", 0), m.get("total_tokens", 0),
                    int(bool(m.get("failover_occurred", False))),
                    m.get("created_at", time.time()),
                ),
            )
        conn.commit()
        conn.close()
