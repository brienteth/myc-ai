"""
Myca Execution Cache

Deterministic result caching for idempotent skill executions.
If a skill was called with the exact same inputs within the TTL window,
the cached result is returned immediately without re-execution.

Example:
  fs.search("~/Downloads/myca") executed 5 minutes ago → return from cache, skip re-execution.

Design:
  - Key = SHA-256(skill_id + sorted(inputs))
  - TTL-based expiry (configurable per skill, default 300s)
  - In-memory LRU + optional SQLite persistence
  - Zero external dependencies
"""

import hashlib
import json
import time
import logging
from typing import Any, Dict, Optional
from collections import OrderedDict

logger = logging.getLogger("myca.execution.cache")


class ExecutionCache:
    """
    LRU + TTL execution result cache.
    
    Usage:
        cache = ExecutionCache()
        key = cache.make_key("fs.search", {"path": "~/Downloads"})
        
        hit = cache.get(key)
        if hit:
            return hit  # Skip execution
        
        result = await skill.execute(...)
        cache.put(key, result)
    """

    def __init__(self, max_entries: int = 256, default_ttl: float = 300.0):
        self._store: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self._max_entries = max_entries
        self._default_ttl = default_ttl
        self._hits = 0
        self._misses = 0

    # ── Key Generation ────────────────────────────────────────
    @staticmethod
    def make_key(skill_id: str, inputs: dict) -> str:
        """Deterministic cache key from skill + inputs."""
        # Sort keys for stability
        canonical = json.dumps({"skill": skill_id, "inputs": inputs}, sort_keys=True, default=str)
        return hashlib.sha256(canonical.encode()).hexdigest()

    # ── Cache Operations ──────────────────────────────────────
    def get(self, key: str) -> Optional[dict]:
        """Look up a cached result. Returns None on miss or expiry."""
        entry = self._store.get(key)
        if entry is None:
            self._misses += 1
            return None

        # Check TTL
        if time.time() - entry["cached_at"] > entry["ttl"]:
            del self._store[key]
            self._misses += 1
            logger.debug(f"[CACHE] Expired: {key[:12]}...")
            return None

        # Move to end (LRU refresh)
        self._store.move_to_end(key)
        self._hits += 1
        logger.info(f"[CACHE] HIT for {entry.get('skill_id', '?')} (key={key[:12]}...)")
        return entry["result"]

    def put(self, key: str, result: dict, skill_id: str = "", ttl: Optional[float] = None):
        """Store an execution result in the cache."""
        if key in self._store:
            self._store.move_to_end(key)
        else:
            # Evict oldest if at capacity
            while len(self._store) >= self._max_entries:
                evicted_key, _ = self._store.popitem(last=False)
                logger.debug(f"[CACHE] Evicted: {evicted_key[:12]}...")

        self._store[key] = {
            "result": result,
            "skill_id": skill_id,
            "cached_at": time.time(),
            "ttl": ttl if ttl is not None else self._default_ttl,
        }
        logger.info(f"[CACHE] STORED {skill_id} (key={key[:12]}..., ttl={ttl or self._default_ttl}s)")

    def invalidate(self, key: str):
        """Remove a specific entry."""
        if key in self._store:
            del self._store[key]

    def invalidate_skill(self, skill_id: str):
        """Remove all entries for a given skill."""
        keys_to_remove = [k for k, v in self._store.items() if v.get("skill_id") == skill_id]
        for k in keys_to_remove:
            del self._store[k]

    def flush(self):
        """Clear entire cache."""
        self._store.clear()
        self._hits = 0
        self._misses = 0

    # ── Stats ─────────────────────────────────────────────────
    def stats(self) -> dict:
        total = self._hits + self._misses
        return {
            "entries": len(self._store),
            "max_entries": self._max_entries,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": f"{(self._hits / total * 100):.1f}%" if total > 0 else "0.0%",
            "default_ttl": self._default_ttl,
        }


# ── Skills that should NEVER be cached (side-effects) ────────
NON_CACHEABLE_SKILLS = {
    "fs.write", "fs.delete", "table.write",
    "communication.send", "browser.click", "browser.type",
    "sys.admin", "payment",
}

def is_cacheable(skill_id: str) -> bool:
    """Returns True if the skill is safe to cache (no side-effects)."""
    return skill_id not in NON_CACHEABLE_SKILLS
