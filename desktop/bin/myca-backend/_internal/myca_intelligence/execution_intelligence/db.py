import sqlite3
import json
import logging
import uuid
import time
from typing import Dict, Any, List, Optional
import os

logger = logging.getLogger("myca_intelligence.execution_intelligence.db")

# Use ai-layer/data directory for actual DB to persist
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../../data/execution_intelligence.db")

def get_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # executions
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS executions (
            id TEXT PRIMARY KEY,
            intent TEXT,
            status TEXT,
            budget JSON,
            metrics JSON,
            created_at REAL,
            updated_at REAL
        )
    """)
    
    # agents
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS agents (
            id TEXT PRIMARY KEY,
            execution_id TEXT,
            name TEXT,
            definition JSON,
            created_at REAL
        )
    """)
    
    # loops
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS loops (
            id TEXT PRIMARY KEY,
            execution_id TEXT,
            target_id TEXT,
            config JSON,
            current_iteration INTEGER,
            status TEXT,
            created_at REAL
        )
    """)
    
    # checkpoints
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS checkpoints (
            id TEXT PRIMARY KEY,
            execution_id TEXT,
            state JSON,
            created_at REAL
        )
    """)
    
    # verification_results
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS verification_results (
            id TEXT PRIMARY KEY,
            execution_id TEXT,
            node_id TEXT,
            artifact_id TEXT,
            results JSON,
            overall_status TEXT,
            created_at REAL
        )
    """)
    
    conn.commit()
    conn.close()
    logger.info("[DB] Execution Intelligence DB initialized.")

class ExecutionDB:
    @staticmethod
    def save_execution(exe_id: str, intent: str, status: str, budget: dict):
        conn = get_connection()
        conn.execute(
            "INSERT OR REPLACE INTO executions (id, intent, status, budget, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (exe_id, intent, status, json.dumps(budget), time.time(), time.time())
        )
        conn.commit()
        conn.close()

    @staticmethod
    def update_execution_status(exe_id: str, status: str):
        conn = get_connection()
        conn.execute("UPDATE executions SET status = ?, updated_at = ? WHERE id = ?", (status, time.time(), exe_id))
        conn.commit()
        conn.close()

    @staticmethod
    def save_checkpoint(exe_id: str, state: dict):
        ckpt_id = str(uuid.uuid4())
        conn = get_connection()
        conn.execute(
            "INSERT INTO checkpoints (id, execution_id, state, created_at) VALUES (?, ?, ?, ?)",
            (ckpt_id, exe_id, json.dumps(state), time.time())
        )
        conn.commit()
        conn.close()

init_db()
