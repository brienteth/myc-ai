"""
Automation Database & Secrets Vault (Phase 3.0)
Manages local SQLite storage for workflow definitions, execution runs, logs, and vault secrets.
"""
import os
import sqlite3
import json
import time
from pathlib import Path
from typing import List, Dict, Any, Optional

DB_PATH = Path("~/.myca/myca_automation.db").expanduser()

class AutomationDB:
    @staticmethod
    def init_db():
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(DB_PATH))
        
        # 1. workflows table (stores serialised Workflow definitions)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS workflows (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                enabled INTEGER DEFAULT 1,
                definition_json TEXT NOT NULL,
                created_at REAL,
                updated_at REAL
            )
        """)

        # 2. runs table (tracks execution history)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS runs (
                id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL,
                status TEXT NOT NULL,  -- Running, Completed, Failed, Cancelled
                started_at REAL,
                ended_at REAL,
                duration REAL,
                error TEXT,
                variables_json TEXT
            )
        """)

        # 3. node_logs table (tracks execution metrics per node)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS node_logs (
                id TEXT PRIMARY KEY,
                run_id TEXT NOT NULL,
                node_id TEXT NOT NULL,
                skill TEXT NOT NULL,
                status TEXT NOT NULL,  -- Pending, Running, Completed, Failed
                outputs_json TEXT,
                logs TEXT,
                duration REAL,
                started_at REAL
            )
        """)

        # 4. secrets table (Local Secure Vault)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS secrets (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at REAL
            )
        """)

        # 5. mcp_servers table (Model Context Protocol configurations)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS mcp_servers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,  -- stdio, sse
                command TEXT,
                url TEXT,
                status TEXT NOT NULL, -- Connected, Disconnected, Error
                tools_count INTEGER DEFAULT 0,
                error_log TEXT,
                created_at REAL
            )
        """)

        conn.commit()
        conn.close()

    # ── Workflow CRUD ──────────────────────────────────────────

    @staticmethod
    def save_workflow(workflow_dict: dict):
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("""
            INSERT OR REPLACE INTO workflows (id, name, enabled, definition_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            workflow_dict["id"],
            workflow_dict["name"],
            1 if workflow_dict.get("enabled", True) else 0,
            json.dumps(workflow_dict),
            workflow_dict.get("created_at", time.time()),
            time.time()
        ))
        conn.commit()
        conn.close()

    @staticmethod
    def get_workflows() -> List[dict]:
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT definition_json FROM workflows").fetchall()
        conn.close()
        return [json.loads(r["definition_json"]) for r in rows]

    @staticmethod
    def get_workflow(workflow_id: str) -> Optional[dict]:
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT definition_json FROM workflows WHERE id = ?", (workflow_id,)).fetchone()
        conn.close()
        return json.loads(row["definition_json"]) if row else None

    @staticmethod
    def delete_workflow(workflow_id: str):
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("DELETE FROM workflows WHERE id = ?", (workflow_id,))
        conn.commit()
        conn.close()

    # ── Run Tracking ───────────────────────────────────────────

    @staticmethod
    def start_run(run_id: str, workflow_id: str, variables: dict) -> dict:
        now = time.time()
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("""
            INSERT INTO runs (id, workflow_id, status, started_at, variables_json)
            VALUES (?, ?, 'Running', ?, ?)
        """, (run_id, workflow_id, now, json.dumps(variables)))
        conn.commit()
        conn.close()
        return {"id": run_id, "workflow_id": workflow_id, "status": "Running", "started_at": now}

    @staticmethod
    def end_run(run_id: str, status: str, error: Optional[str] = None):
        now = time.time()
        conn = sqlite3.connect(str(DB_PATH))
        row = conn.execute("SELECT started_at FROM runs WHERE id = ?", (run_id,)).fetchone()
        duration = now - row[0] if row else 0.0
        conn.execute("""
            UPDATE runs SET status = ?, ended_at = ?, duration = ?, error = ?
            WHERE id = ?
        """, (status, now, duration, error, run_id))
        conn.commit()
        conn.close()

    @staticmethod
    def start_node(node_log_id: str, run_id: str, node_id: str, skill: str):
        now = time.time()
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("""
            INSERT INTO node_logs (id, run_id, node_id, skill, status, started_at, logs)
            VALUES (?, ?, ?, ?, 'Running', ?, '')
        """, (node_log_id, run_id, node_id, skill, now))
        conn.commit()
        conn.close()

    @staticmethod
    def log_node_event(node_log_id: str, message: str):
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("""
            UPDATE node_logs SET logs = logs || ? || '\n'
            WHERE id = ?
        """, (message, node_log_id))
        conn.commit()
        conn.close()

    @staticmethod
    def end_node(node_log_id: str, status: str, outputs: dict):
        now = time.time()
        conn = sqlite3.connect(str(DB_PATH))
        row = conn.execute("SELECT started_at FROM node_logs WHERE id = ?", (node_log_id,)).fetchone()
        duration = now - row[0] if row else 0.0
        conn.execute("""
            UPDATE node_logs SET status = ?, outputs_json = ?, duration = ?
            WHERE id = ?
        """, (status, json.dumps(outputs), duration, node_log_id))
        conn.commit()
        conn.close()

    @staticmethod
    def get_history(limit: int = 50) -> List[dict]:
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        runs = conn.execute("""
            SELECT r.*, w.name as workflow_name
            FROM runs r
            LEFT JOIN workflows w ON r.workflow_id = w.id
            ORDER BY r.started_at DESC
            LIMIT ?
        """, (limit,)).fetchall()
        
        history = []
        for r in runs:
            run_dict = dict(r)
            run_id = r["id"]
            nodes = conn.execute("SELECT * FROM node_logs WHERE run_id = ?", (run_id,)).fetchall()
            run_dict["nodes"] = [dict(n) for n in nodes]
            history.append(run_dict)
            
        conn.close()
        return history

    # ── Local Vault Secrets ────────────────────────────────────

    @staticmethod
    def get_secret(key: str) -> Optional[str]:
        conn = sqlite3.connect(str(DB_PATH))
        row = conn.execute("SELECT value FROM secrets WHERE key = ?", (key,)).fetchone()
        conn.close()
        return row[0] if row else None

    @staticmethod
    def set_secret(key: str, value: str):
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("""
            INSERT OR REPLACE INTO secrets (key, value, updated_at)
            VALUES (?, ?, ?)
        """, (key, value, time.time()))
        conn.commit()
        conn.close()

    @staticmethod
    def delete_secret(key: str):
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("DELETE FROM secrets WHERE key = ?", (key,))
        conn.commit()
        conn.close()

    @staticmethod
    def get_secret_keys() -> List[str]:
        conn = sqlite3.connect(str(DB_PATH))
        rows = conn.execute("SELECT key FROM secrets").fetchall()
        conn.close()
        return [r[0] for r in rows]

    # ── MCP Servers ────────────────────────────────────────────

    @staticmethod
    def save_mcp_server(server: dict):
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("""
            INSERT OR REPLACE INTO mcp_servers (id, name, type, command, url, status, tools_count, error_log, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            server["id"],
            server["name"],
            server["type"],
            server.get("command"),
            server.get("url"),
            server.get("status", "Disconnected"),
            server.get("tools_count", 0),
            server.get("error_log"),
            server.get("created_at", time.time())
        ))
        conn.commit()
        conn.close()

    @staticmethod
    def get_mcp_servers() -> List[dict]:
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM mcp_servers ORDER BY created_at DESC").fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def delete_mcp_server(server_id: str):
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("DELETE FROM mcp_servers WHERE id = ?", (server_id,))
        conn.commit()
        conn.close()

    @staticmethod
    def update_mcp_status(server_id: str, status: str, tools_count: int = 0, error_log: str = None):
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("""
            UPDATE mcp_servers SET status = ?, tools_count = ?, error_log = ?
            WHERE id = ?
        """, (status, tools_count, error_log, server_id))
        conn.commit()
        conn.close()
