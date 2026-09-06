"""
Memory Controller for Myca OS (P0.5 / P1.5)
Manages durable memory classification, relevance scoring, and SQLite persistence
for memories, decisions, experiences, projects, entities, relations, embeddings, and events.

P1.5 Memory Safety: Rule-based confidence scoring distinguishes temporary candidates
("şimdilik", "belki") from durable committed decisions ("karar verdik", "kesinlikle").
"""

import os
import sqlite3
import time
import uuid
import json
import logging
from enum import Enum
from typing import List, Dict, Any, Optional, Tuple

import numpy as np
from .database import DB_PATH, init_db
from .contracts.memory import MemoryStore

logger = logging.getLogger("myca.memory")

# Categories for durable memory
CATEGORIES = ["project", "decision", "preference", "credential", "workflow", "interaction"]


class MemoryDurability(str, Enum):
    """
    Durability classification for memory entries.
    - EPHEMERAL: Temporary/exploratory state — should not persist as binding decisions.
    - CANDIDATE: Tentative/conditional — may become durable after confirmation.
    - DURABLE: Committed decision — reliable long-term fact.
    """
    EPHEMERAL = "ephemeral"   # Low confidence (< 0.35)
    CANDIDATE = "candidate"   # Medium confidence (0.35 – 0.70)
    DURABLE   = "durable"     # High confidence (> 0.70)


# ── Hedging patterns → pull confidence DOWN ──
_HEDGE_PATTERNS_TR = [
    "şimdilik", "belki", "sanırım", "muhtemelen", "düşünüyorum", "deneyelim",
    "deneyebiliriz", "geçici", "henüz", "belki de", "bakalım", "bakalım ne olur",
    "bence", "olabilir", "tartışabiliriz", "ileride", "lazım mı", "gerekli mi"
]
_HEDGE_PATTERNS_EN = [
    "for now", "maybe", "perhaps", "possibly", "i think", "we could try",
    "temporarily", "tentatively", "not sure", "might", "could", "let's see",
    "consider", "maybe we should", "discuss later"
]

# ── Commit patterns → push confidence UP ──
_COMMIT_PATTERNS_TR = [
    "karar verdik", "kesinlikle", "artık", "kalıcı olarak", "her zaman",
    "zorunlu", "evet bu", "bunu kullanacağız", "bu şekilde yapacağız",
    "onaylandı", "teyit edildi", "final karar", "mutlaka", "şart"
]
_COMMIT_PATTERNS_EN = [
    "decided", "confirmed", "we will", "always", "permanently", "mandatory",
    "final decision", "must", "required", "approved", "committed to"
]

# Scoring weights (tuned so single hedge → EPHEMERAL, single commit → DURABLE)
_HEDGE_WEIGHT  = 0.18   # Each hedge pattern subtracts this from 0.50 baseline
_COMMIT_WEIGHT = 0.22   # Each commit pattern adds this to 0.50 baseline
_DURABLE_THRESHOLD   = 0.68   # score > this → DURABLE
_EPHEMERAL_THRESHOLD = 0.33   # score < this → EPHEMERAL (else CANDIDATE)

class MemoryController(MemoryStore):
    """
    Core Memory Controller handling durable memory classification,
    semantic embedding, relevance search, and schema-validated SQLite operations.
    """

    def __init__(self, threshold: float = 0.65):
        self.threshold = threshold
        self.db_path = DB_PATH
        init_db()  # Ensure database schema is initialized
        self.encoder = None
        self._init_encoder()

    def _init_encoder(self):
        try:
            from sentence_transformers import SentenceTransformer
            self.encoder = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("SentenceTransformer model loaded successfully.")
        except ImportError:
            logger.info("SentenceTransformer not installed. Falling back to deterministic mock embedding.")

    def embed(self, text: str) -> np.ndarray:
        """
        Embed text. If SentenceTransformer is available, use it.
        Otherwise, generate a deterministic normalized pseudo-random vector based on text hash.
        """
        if self.encoder is not None:
            try:
                emb = self.encoder.encode(text, normalize_embeddings=True)
                return np.array(emb, dtype=np.float32)
            except Exception as e:
                logger.warning(f"Failed to run SentenceTransformer embedding: {e}")

        # Deterministic bag-of-words fallback vector (384 dimensions)
        import hashlib
        import re
        
        v = np.zeros(384, dtype=np.float32)
        words = re.findall(r'\w+', text.lower())
        
        # Stop words list
        stop_words = {"is", "a", "the", "are", "to", "for", "in", "on", "of", "and", "or", "how", "do", "i", "you", "with"}
        filtered_words = [w for w in words if w not in stop_words and len(w) > 1]
        
        # Hash each filtered word to a 384 dimensional space
        for w in filtered_words:
            wh = int(hashlib.md5(w.encode('utf-8')).hexdigest(), 16)
            idx = wh % 384
            v[idx] += 1.0
            
        # Add a tiny base random vector using full sentence hash to break ties/guarantee non-zero
        sh = int(hashlib.md5(text.encode('utf-8')).hexdigest(), 16)
        rng = np.random.default_rng(sh % (2**32))
        noise = rng.standard_normal(384, dtype=np.float32) * 0.05
        v += noise
        
        # Normalize
        norm = np.linalg.norm(v)
        if norm > 0:
            v = v / norm
        return v

    def is_durable_memory(self, text: str) -> bool:
        """
        Durable Memory Classifier.
        Filters out superficial chat and casual greetings.
        Returns True if the text contains high-value durable information.
        """
        text_lower = text.lower().strip()
        
        # 1. Reject trivial greetings and short chat
        if len(text_lower) < 15:
            return False

        greetings = ["selam", "merhaba", "nasılsın", "günaydın", "iyi günler", "hey", "hello", "hi"]
        if any(text_lower == g for g in greetings):
            return False

        # 2. Key structural keywords indicating decisions, specifications, credentials or automation instructions
        durable_keywords = [
            "proje", "project", "veri", "data", "şifre", "key", "token", "karar", "decision",
            "tercih", "preference", "workflow", "otomasyon", "db", "database", "tablo", "table",
            "repo", "git", "dosya", "file", "yol", "path", "api", "envelop", "pairing",
            "yaz", "create", "build", "run", "çalıştır", "kur", "setup", "config", "ayarla"
        ]
        
        # If it has more than 20 characters and contains at least one durable keyword, classify as durable
        if any(kw in text_lower for kw in durable_keywords):
            return True

        # If it's a long sentence and does not look like simple conversational filler
        simple_fillers = ["tamam", "ok", "teşekkürler", "rica ederim", "harika", "süper", "anladım"]
        if any(text_lower.startswith(f) for f in simple_fillers):
            return False

        if len(text_lower) > 35:
            return True

        return False

    def score_durability_confidence(self, text: str) -> Tuple[float, MemoryDurability]:
        """
        P1.5 — Rule-based durability confidence scoring.

        Distinguishes temporary/exploratory state from committed decisions by
        detecting hedging language (low confidence) vs commit signals (high confidence).

        Returns:
            (confidence_score: float[0,1], label: MemoryDurability)

        Examples:
            "Şimdilik PostgreSQL kullanalım"    → (0.20, EPHEMERAL)
            "Bunu deneyebiliriz"                → (0.30, EPHEMERAL)
            "API key ayarlamamız gerekiyor"     → (0.55, CANDIDATE)
            "PostgreSQL kullanmaya karar verdik" → (0.85, DURABLE)
            "Kesinlikle bu yolu kullanacağız"   → (0.90, DURABLE)
        """
        text_lower = text.lower().strip()
        score = 0.50  # Neutral baseline

        # Hedge signals → decrease confidence
        hedge_hits = sum(
            1 for p in (_HEDGE_PATTERNS_TR + _HEDGE_PATTERNS_EN)
            if p in text_lower
        )
        # Commit signals → increase confidence
        commit_hits = sum(
            1 for p in (_COMMIT_PATTERNS_TR + _COMMIT_PATTERNS_EN)
            if p in text_lower
        )

        # Apply weighted delta per hit (caps at ±0.45 from baseline)
        score -= min(hedge_hits * _HEDGE_WEIGHT, 0.45)
        score += min(commit_hits * _COMMIT_WEIGHT, 0.45)

        # Clamp to [0, 1]
        score = max(0.0, min(1.0, score))

        # Classify into durability level
        if score > _DURABLE_THRESHOLD:
            label = MemoryDurability.DURABLE
        elif score < _EPHEMERAL_THRESHOLD:
            label = MemoryDurability.EPHEMERAL
        else:
            label = MemoryDurability.CANDIDATE

        logger.debug(
            f"Durability score={score:.2f} ({label.value}) | "
            f"hedges={hedge_hits} commits={commit_hits} | text='{text[:50]}'"
        )
        return round(score, 4), label

    # ── Database Operations ──

    def add_memory(self, content: str, category: str, force_durability: Optional[MemoryDurability] = None) -> str:
        """
        Store a general text memory with timestamp, category, and durability metadata.

        P1.5: Computes rule-based durability confidence automatically.
        EPHEMERAL memories are stored but flagged — they must NOT be treated as
        binding decisions by planners or policy engines.

        Args:
            content: The memory text content.
            category: One of CATEGORIES.
            force_durability: Override automatic scoring (e.g., for system-confirmed decisions).

        Returns:
            memory_id (str) or "" if rejected as superficial chat.
        """
        if not self.is_durable_memory(content):
            logger.info(f"Memory skipped (superficial chat): {content[:30]}")
            return ""

        # Score durability
        if force_durability is not None:
            durability_score = {MemoryDurability.EPHEMERAL: 0.20,
                                MemoryDurability.CANDIDATE: 0.55,
                                MemoryDurability.DURABLE: 0.90}.get(force_durability, 0.55)
            durability_label = force_durability
        else:
            durability_score, durability_label = self.score_durability_confidence(content)

        memory_id = str(uuid.uuid4())
        now = time.time()
        conn = sqlite3.connect(str(self.db_path))
        try:
            # Ensure columns exist (backward-compat migration)
            conn.execute(
                "ALTER TABLE memories ADD COLUMN durability_score REAL DEFAULT 0.5"
            ) if not self._column_exists(conn, "memories", "durability_score") else None
            conn.execute(
                "ALTER TABLE memories ADD COLUMN durability_label TEXT DEFAULT 'candidate'"
            ) if not self._column_exists(conn, "memories", "durability_label") else None

            conn.execute(
                "INSERT INTO memories (id, content, category, timestamp, durability_score, durability_label) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (memory_id, content, category, now, durability_score, durability_label.value)
            )
            # Store embedding
            emb = self.embed(content)
            conn.execute(
                "INSERT INTO embeddings (id, text, vector_blob, created_at) VALUES (?, ?, ?, ?)",
                (memory_id, content, emb.tobytes(), now)
            )
            conn.commit()
            logger.info(
                f"Memory stored [{durability_label.value} / {durability_score:.2f}]: {memory_id} | {content[:50]}"
            )
            
            # Sync with local Node Resonance LSH memory engine
            import httpx
            try:
                httpx.post("http://127.0.0.1:3500/resonance/add", json={
                    "query": content,
                    "content": content
                }, timeout=0.08)
            except Exception:
                pass
        finally:
            conn.close()
        return memory_id

    @staticmethod
    def _column_exists(conn: sqlite3.Connection, table: str, column: str) -> bool:
        """Check if a column exists in a table (for safe ALTER TABLE migrations)."""
        try:
            cursor = conn.execute(f"PRAGMA table_info({table})")
            return any(row[1] == column for row in cursor.fetchall())
        except Exception:
            return False

    def add_decision(self, context: str, choice: str, rationale: str) -> str:
        decision_id = str(uuid.uuid4())
        conn = sqlite3.connect(str(self.db_path))
        try:
            conn.execute(
                "INSERT INTO decisions (id, context, choice, rationale, timestamp) VALUES (?, ?, ?, ?, ?)",
                (decision_id, context, choice, rationale, time.time())
            )
            # Also store as embedding for semantic lookup
            emb_text = f"Context: {context} | Choice: {choice} | Rationale: {rationale}"
            emb = self.embed(emb_text)
            conn.execute(
                "INSERT INTO embeddings (id, text, vector_blob, created_at) VALUES (?, ?, ?, ?)",
                (decision_id, emb_text, emb.tobytes(), time.time())
            )
            conn.commit()
            logger.info(f"Decision memory stored successfully: {decision_id}")
        finally:
            conn.close()
        return decision_id

    def add_experience(self, prompt: str, plan: Dict[str, Any], latency_ms: float, energy_cost: float, success: bool) -> str:
        exp_id = str(uuid.uuid4())
        conn = sqlite3.connect(str(self.db_path))
        try:
            conn.execute(
                "INSERT INTO experiences (id, prompt, plan_json, latency_ms, energy_cost, success, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (exp_id, prompt, json.dumps(plan), latency_ms, energy_cost, success, time.time())
            )
            conn.commit()
            logger.info(f"Experience stored successfully: {exp_id}")
        finally:
            conn.close()
        return exp_id

    def add_project(self, title: str, description: str, repo_path: str, status: str = "active") -> str:
        project_id = str(uuid.uuid4())
        conn = sqlite3.connect(str(self.db_path))
        try:
            conn.execute(
                "INSERT INTO projects (id, title, description, repo_path, created_at, status) VALUES (?, ?, ?, ?, ?, ?)",
                (project_id, title, description, repo_path, time.time(), status)
            )
            conn.commit()
            logger.info(f"Project stored successfully: {project_id}")
        finally:
            conn.close()
        return project_id

    def add_entity(self, name: str, entity_type: str, properties: Dict[str, Any]) -> str:
        entity_id = str(uuid.uuid4())
        conn = sqlite3.connect(str(self.db_path))
        try:
            conn.execute(
                "INSERT INTO entities (id, name, type, properties, created_at) VALUES (?, ?, ?, ?, ?)",
                (entity_id, name, entity_type, json.dumps(properties), time.time())
            )
            conn.commit()
            logger.info(f"Entity stored: {entity_id}")
        finally:
            conn.close()
        return entity_id

    def add_relation(self, source_id: str, target_id: str, relation_type: str, properties: Dict[str, Any]) -> str:
        relation_id = str(uuid.uuid4())
        conn = sqlite3.connect(str(self.db_path))
        try:
            conn.execute(
                "INSERT INTO relations (id, source_id, target_id, type, properties, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (relation_id, source_id, target_id, relation_type, json.dumps(properties), time.time())
            )
            conn.commit()
            logger.info(f"Relation stored: {relation_id}")
        finally:
            conn.close()
        return relation_id

    def add_event(self, event_type: str, payload: Dict[str, Any]) -> str:
        event_id = str(uuid.uuid4())
        conn = sqlite3.connect(str(self.db_path))
        try:
            conn.execute(
                "INSERT INTO events (id, event_type, payload_json, timestamp) VALUES (?, ?, ?, ?)",
                (event_id, event_type, json.dumps(payload), time.time())
            )
            conn.commit()
            logger.info(f"Event logged: {event_id}")
        finally:
            conn.close()
        return event_id

    def score_resonance(self, query: str, candidate: str, query_vector: np.ndarray, candidate_vector: np.ndarray) -> float:
        """
        Computes compound resonance (incorporating morphology harmony, 
        suffixes, and phase coherence) by calling the local Node core.
        """
        import httpx
        try:
            r = httpx.post("http://127.0.0.1:3500/resonance/score", json={
                "textA": query,
                "textB": candidate,
                "a": {
                    "type": "complex",
                    "values": query_vector.tolist(),
                    "D": len(query_vector)
                },
                "b": {
                    "type": "complex",
                    "values": candidate_vector.tolist(),
                    "D": len(candidate_vector)
                }
            }, timeout=0.08) # strict 80ms timeout
            if r.status_code == 200:
                data = r.json()
                return float(data.get("finalScore", 0.5))
        except Exception:
            pass
        # Fallback to standard cosine similarity
        return float(np.dot(query_vector, candidate_vector))

    # ── Retrieval and Relevance Search ──

    def retrieve_relevant_memories(
        self,
        query: str,
        category: Optional[str] = None,
        limit: int = 5,
        min_durability: Optional[MemoryDurability] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieves memories matching semantic cosine similarity query.

        Args:
            min_durability: If set, filters out memories below this durability level.
                            e.g., MemoryDurability.DURABLE → only committed decisions.
        """
        _durability_rank = {
            MemoryDurability.EPHEMERAL: 0,
            MemoryDurability.CANDIDATE: 1,
            MemoryDurability.DURABLE:   2,
        }
        min_rank = _durability_rank.get(min_durability, 0) if min_durability else 0

        query_vector = self.embed(query)
        conn = sqlite3.connect(str(self.db_path))
        
        try:
            cursor = conn.cursor()
            if category:
                cursor.execute(
                    "SELECT e.id, e.text, e.vector_blob, m.category, m.timestamp, "
                    "COALESCE(m.durability_score, 0.5), COALESCE(m.durability_label, 'candidate') "
                    "FROM embeddings e "
                    "JOIN memories m ON e.id = m.id WHERE m.category = ?", (category,)
                )
            else:
                cursor.execute(
                    "SELECT e.id, e.text, e.vector_blob, m.category, m.timestamp, "
                    "COALESCE(m.durability_score, 0.5), COALESCE(m.durability_label, 'candidate') "
                    "FROM embeddings e LEFT JOIN memories m ON e.id = m.id"
                )
            
            rows = cursor.fetchall()
            
            results = []
            for row in rows:
                row_id, text, vec_bytes = row[0], row[1], row[2]
                dur_score = row[5] if len(row) > 5 else 0.5
                dur_label = row[6] if len(row) > 6 else "candidate"

                # Filter by min_durability
                row_rank = _durability_rank.get(MemoryDurability(dur_label) if dur_label else MemoryDurability.CANDIDATE, 1)
                if row_rank < min_rank:
                    continue

                vec = np.frombuffer(vec_bytes, dtype=np.float32)
                score = self.score_resonance(query, text, query_vector, vec)
                if score >= self.threshold:
                    results.append({
                        "id": row_id,
                        "text": text,
                        "score": score,
                        "timestamp": row[4] if len(row) > 4 else 0,
                        "durability_score": dur_score,
                        "durability_label": dur_label,
                    })
            
            results.sort(key=lambda x: x["score"], reverse=True)
            return results[:limit]
        finally:
            conn.close()

    def retrieve_durable_memories(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Convenience method: Only returns DURABLE (committed) memories.
        Use this when planners or policy engines need reliable, non-tentative facts.
        """
        return self.retrieve_relevant_memories(
            query, limit=limit, min_durability=MemoryDurability.DURABLE
        )

    # ── MemoryStore Interface Implementations ──

    # ── MemoryStore Interface Implementations ──

    def store_experience(self, experience: Dict[str, Any]) -> None:
        """Stores structured user experience wrapper matching MemoryStore interface."""
        prompt = experience.get("prompt") or experience.get("need_text") or ""
        plan = experience.get("plan") or {}
        latency = experience.get("latency_ms") or experience.get("latency") or 0.0
        energy = experience.get("energy_cost") or experience.get("energy") or 0.0
        success = experience.get("success") or False
        
        self.add_experience(prompt, plan, latency, energy, success)

    def store_plan_experience(self, need_text: str, plan: dict, success: bool, latency: float, energy: float):
        """Compatibility method for storing execution history."""
        self.add_experience(need_text, plan, latency, energy, success)

    def clear(self):
        """Clears memory databases."""
        conn = sqlite3.connect(str(self.db_path))
        try:
            conn.execute("DELETE FROM memories")
            conn.execute("DELETE FROM decisions")
            conn.execute("DELETE FROM experiences")
            conn.execute("DELETE FROM projects")
            conn.execute("DELETE FROM entities")
            conn.execute("DELETE FROM relations")
            conn.execute("DELETE FROM embeddings")
            conn.execute("DELETE FROM events")
            conn.commit()
        finally:
            conn.close()

    def rank_candidate_dags(self, need_text: str, candidate_dags: List[Dict[str, Any]]) -> Tuple[dict, float]:
        """
        Ranks candidate DAGs based on historical execution experience metrics.
        Returns (best_candidate_dag, confidence_score).
        """
        if not candidate_dags:
            return {}, 0.0

        best_plan = candidate_dags[0]
        best_score = 0.5

        try:
            conn = sqlite3.connect(str(self.db_path))
            rows = conn.execute("SELECT plan_json, success FROM experiences WHERE success = 1").fetchall()
            conn.close()

            if not rows:
                return best_plan, best_score

            for dag in candidate_dags:
                skills_in_dag = {n.get("skill") for n in dag.get("nodes", [])}
                score = 0.5
                for r in rows:
                    try:
                        past_plan = json.loads(r[0])
                        past_skills = {n.get("skill") for n in past_plan.get("nodes", [])}
                        if skills_in_dag == past_skills:
                            score += 0.4
                    except Exception:
                        pass
                if score > best_score:
                    best_score = score
                    best_plan = dag

        except Exception as e:
            logger.warning(f"Candidate DAG ranking error: {e}")

        return best_plan, min(best_score, 1.0)

    def retrieve_context(self, prompt: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Retrieves relevant context strings matching the prompt."""
        memories = self.retrieve_relevant_memories(prompt, limit=limit)
        return [{"id": m["id"], "content": m["text"], "relevance": m["score"]} for m in memories]

    def store_selector(self, url: str, dom_hash: str, target_desc: str, selector: str):
        conn = sqlite3.connect(str(self.db_path))
        try:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS ui_selectors ("
                "url TEXT, dom_hash TEXT, target_desc TEXT, selector TEXT, "
                "PRIMARY KEY (url, dom_hash, target_desc))"
            )
            conn.execute(
                "INSERT OR REPLACE INTO ui_selectors (url, dom_hash, target_desc, selector) "
                "VALUES (?, ?, ?, ?)",
                (url, dom_hash, target_desc, selector)
            )
            conn.commit()
        finally:
            conn.close()

    def find_selector(self, url: str, dom_hash: str, target_desc: str) -> Optional[str]:
        conn = sqlite3.connect(str(self.db_path))
        try:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS ui_selectors ("
                "url TEXT, dom_hash TEXT, target_desc TEXT, selector TEXT, "
                "PRIMARY KEY (url, dom_hash, target_desc))"
            )
            cursor = conn.cursor()
            cursor.execute(
                "SELECT selector FROM ui_selectors WHERE url = ? AND dom_hash = ? AND target_desc = ?",
                (url, dom_hash, target_desc)
            )
            row = cursor.fetchone()
            return row[0] if row else None
        finally:
            conn.close()
