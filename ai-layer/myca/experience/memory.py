"""
Myca Experience Memory (Layer 5)

Deep memory storage for execution experiences.
Stores:
- Complete DAG Plans
- Successful Selectors mapped to DOM hashes
- Confidence and success rates
- Energy and Latency analytics
"""

import logging
import sqlite3
import time
import uuid
import json
from pathlib import Path
from typing import Optional, Tuple, Any

logger = logging.getLogger("myca.experience.memory")

class ExperienceMemory:
    MODEL = "all-MiniLM-L6-v2"
    
    def __init__(self, threshold: float = 0.90):
        self.threshold = threshold
        self.db_path = Path("~/.myca/myca_execution.db").expanduser()
        self.encoder = None
        self._init_db()

    def _init_db(self):
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(self.db_path))
        
        # execution_history: tracks high-level Need -> Plan execution
        conn.execute("""
            CREATE TABLE IF NOT EXISTS execution_history (
                id TEXT PRIMARY KEY,
                need_hash TEXT NOT NULL,
                embedding BLOB NOT NULL,
                plan_json TEXT NOT NULL,
                success BOOLEAN NOT NULL,
                latency_ms REAL,
                energy_cost REAL,
                timestamp REAL
            )
        """)
        
        # selector_memory: tracks deterministic skill successes (e.g. DOM selectors)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS selector_memory (
                id TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                dom_hash TEXT NOT NULL,
                target_description TEXT NOT NULL,
                successful_selector TEXT NOT NULL,
                success_rate REAL DEFAULT 1.0,
                last_used REAL
            )
        """)
        
        conn.commit()
        conn.close()

    def _get_encoder(self):
        if self.encoder is None:
            try:
                from sentence_transformers import SentenceTransformer
                logger.info(f"Loading semantic encoder: {self.MODEL}")
                self.encoder = SentenceTransformer(self.MODEL)
            except ImportError:
                return None
        return self.encoder

    def embed(self, text: str):
        import numpy as np
        encoder = self._get_encoder()
        if encoder is None: return None
        return encoder.encode(text, normalize_embeddings=True).astype(np.float32)

    def store_plan_experience(self, need_text: str, plan: dict, success: bool, latency: float, energy: float):
        import numpy as np
        emb = self.embed(need_text)
        if emb is None: return

        conn = sqlite3.connect(str(self.db_path))
        conn.execute("""
            INSERT INTO execution_history
            (id, need_hash, embedding, plan_json, success, latency_ms, energy_cost, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            str(uuid.uuid4()), hash(need_text), emb.tobytes(), 
            json.dumps(plan), success, latency, energy, time.time()
        ))
        conn.commit()
        conn.close()

    def store_selector(self, url: str, dom_hash: str, target_desc: str, selector: str):
        conn = sqlite3.connect(str(self.db_path))
        conn.execute("""
            INSERT OR REPLACE INTO selector_memory
            (id, url, dom_hash, target_description, successful_selector, last_used)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (str(uuid.uuid4()), url, dom_hash, target_desc, selector, time.time()))
        conn.commit()
        conn.close()

    def find_selector(self, url: str, dom_hash: str, target_desc: str) -> Optional[str]:
        conn = sqlite3.connect(str(self.db_path))
        row = conn.execute("""
            SELECT successful_selector FROM selector_memory 
            WHERE url = ? AND dom_hash = ? AND target_description = ? 
            ORDER BY success_rate DESC LIMIT 1
        """, (url, dom_hash, target_desc)).fetchone()
        conn.close()
        return row[0] if row else None
