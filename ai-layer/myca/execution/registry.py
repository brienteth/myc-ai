"""
Myca Execution Registry (The OS Central Registry Layer)

Central OS Registry serving as the single source of truth for:
  - Skill manifests, Versioned ABIs, Docs, & Code Hints
  - Workflow templates & AST Examples
  - Hardware profiles, Benchmarks & Execution latency profiles
  - Package metadata & Security Policies
  - Error resolutions & Recovery strategies
  - Artifact schemas & Capability matrices

Subsystems consuming Execution Registry:
  Planner, ContextBuilder, Compiler, Optimizer, Validator, Scheduler, Runtime, Verifier
"""

import json
import sqlite3
import time
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field

logger = logging.getLogger("myca.execution.registry")


@dataclass
class KnowledgeBundle:
    """Rich semantic knowledge bundle returned for an intent or skill query."""
    topic: str
    skills: List[Dict[str, Any]] = field(default_factory=list)
    abi_schemas: List[Dict[str, Any]] = field(default_factory=list)
    templates: List[Dict[str, Any]] = field(default_factory=list)
    benchmarks: Dict[str, Any] = field(default_factory=dict)
    hardware_profiles: List[Dict[str, Any]] = field(default_factory=list)
    policies: List[Dict[str, Any]] = field(default_factory=list)
    error_resolutions: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "topic": self.topic,
            "skills": self.skills,
            "abi_schemas": self.abi_schemas,
            "templates": self.templates,
            "benchmarks": self.benchmarks,
            "hardware_profiles": self.hardware_profiles,
            "policies": self.policies,
            "error_resolutions": self.error_resolutions,
        }


class ExecutionRegistry:
    """
    The Central OS Registry & Knowledge Engine for Myca OS.
    Versioned, deterministic, local-first.
    """

    _instance: Optional["ExecutionRegistry"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.db_path = Path("~/.myca/execution_registry.db").expanduser()
            cls._instance._init_db()
        return cls._instance

    def _init_db(self):
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(self.db_path))

        # 1. Versioned Skill Registry Table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS skill_registry (
                skill_id TEXT NOT NULL,
                version TEXT NOT NULL,
                description TEXT,
                abi_schema TEXT,
                ast_examples TEXT,
                benchmarks TEXT,
                policies TEXT,
                updated_at REAL,
                PRIMARY KEY (skill_id, version)
            )
        """)

        # 2. Workflow Templates
        conn.execute("""
            CREATE TABLE IF NOT EXISTS workflow_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                intent_keywords TEXT NOT NULL,
                dag_json TEXT NOT NULL,
                updated_at REAL
            )
        """)

        # 3. Hardware Profiles & Capabilities
        conn.execute("""
            CREATE TABLE IF NOT EXISTS hardware_profiles (
                node_id TEXT PRIMARY KEY,
                cpu_cores INTEGER,
                ram_gb REAL,
                gpu_name TEXT,
                latency_ms REAL,
                trust_score REAL,
                capabilities TEXT,
                updated_at REAL
            )
        """)

        # 4. Error Resolutions & Recovery
        conn.execute("""
            CREATE TABLE IF NOT EXISTS error_resolutions (
                id TEXT PRIMARY KEY,
                error_pattern TEXT NOT NULL,
                skill_id TEXT,
                strategy TEXT NOT NULL
            )
        """)

        conn.commit()
        conn.close()

    # ── Registration APIs ────────────────────────────────────
    def register_skill(
        self,
        skill_id: str,
        version: str = "1.0.0",
        description: str = "",
        abi_schema: Optional[dict] = None,
        ast_examples: Optional[list] = None,
        benchmarks: Optional[dict] = None,
        policies: Optional[dict] = None,
    ):
        """Index or update a versioned skill entry in the OS Registry."""
        conn = sqlite3.connect(str(self.db_path))
        conn.execute("""
            INSERT OR REPLACE INTO skill_registry
            (skill_id, version, description, abi_schema, ast_examples, benchmarks, policies, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            skill_id,
            version,
            description,
            json.dumps(abi_schema or {}),
            json.dumps(ast_examples or []),
            json.dumps(benchmarks or {"avg_latency_ms": 12.5, "throughput_tps": 100}),
            json.dumps(policies or {"sandbox": "isolated", "network": "restricted"}),
            time.time(),
        ))
        conn.commit()
        conn.close()
        logger.info(f"[EXECUTION REGISTRY] Registered {skill_id} v{version}")

    def register_hardware_profile(self, node_id: str, cpu: int, ram: float, gpu: str, latency: float, caps: list):
        conn = sqlite3.connect(str(self.db_path))
        conn.execute("""
            INSERT OR REPLACE INTO hardware_profiles
            (node_id, cpu_cores, ram_gb, gpu_name, latency_ms, trust_score, capabilities, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (node_id, cpu, ram, gpu, latency, 1.0, json.dumps(caps), time.time()))
        conn.commit()
        conn.close()

    def register_error_resolution(self, resolution_id: str, pattern: str, skill_id: str, strategy: str):
        conn = sqlite3.connect(str(self.db_path))
        conn.execute("""
            INSERT OR REPLACE INTO error_resolutions (id, error_pattern, skill_id, strategy)
            VALUES (?, ?, ?, ?)
        """, (resolution_id, pattern, skill_id, strategy))
        conn.commit()
        conn.close()

    # ── Universal OS Layer Queries ───────────────────────────
    def get_bundle_for_intent(self, prompt: str) -> KnowledgeBundle:
        """
        Retrieves a complete Knowledge Bundle (Skills, ABIs, Templates, Hardware, Policies)
        for an intent. Used by ContextBuilder, Optimizer, Compiler, and Runtime.
        """
        conn = sqlite3.connect(str(self.db_path))
        prompt_lower = prompt.lower()

        bundle = KnowledgeBundle(topic=prompt)

        # 1. Matching Skills & ABIs (Versioned)
        s_rows = conn.execute("SELECT skill_id, version, description, abi_schema, ast_examples, benchmarks, policies FROM skill_registry").fetchall()
        for r in s_rows:
            sid, ver, desc, abi, ast, bench, pol = r
            if sid.lower() in prompt_lower or any(w in desc.lower() for w in prompt_lower.split() if len(w) > 3):
                try:
                    bundle.skills.append({
                        "skill_id": sid,
                        "version": ver,
                        "description": desc,
                        "ast_examples": json.loads(ast),
                    })
                    bundle.abi_schemas.append({"skill_id": sid, "version": ver, "abi": json.loads(abi)})
                    bundle.benchmarks[sid] = json.loads(bench)
                    bundle.policies.append({"skill_id": sid, "policy": json.loads(pol)})
                except Exception:
                    pass

        # 2. Hardware Profiles
        h_rows = conn.execute("SELECT node_id, cpu_cores, ram_gb, gpu_name, latency_ms, capabilities FROM hardware_profiles").fetchall()
        for r in h_rows:
            try:
                bundle.hardware_profiles.append({
                    "node_id": r[0], "cpu": r[1], "ram": r[2], "gpu": r[3], "latency_ms": r[4], "capabilities": json.loads(r[5])
                })
            except Exception:
                pass

        # 3. Error Resolutions
        e_rows = conn.execute("SELECT id, error_pattern, skill_id, strategy FROM error_resolutions").fetchall()
        for r in e_rows:
            bundle.error_resolutions.append({"pattern": r[1], "skill_id": r[2], "strategy": r[3]})

        conn.close()
        return bundle

    def get_benchmark(self, skill_id: str) -> Dict[str, Any]:
        """Used by Optimizer for DAG parallelization & speedup estimation."""
        conn = sqlite3.connect(str(self.db_path))
        row = conn.execute("SELECT benchmarks FROM skill_registry WHERE skill_id = ? ORDER BY version DESC LIMIT 1", (skill_id,)).fetchone()
        conn.close()
        if row:
            try: return json.loads(row[0])
            except Exception: pass
        return {"avg_latency_ms": 15.0, "throughput_tps": 100}

    def get_error_strategy(self, skill_id: str, error_msg: str) -> Optional[str]:
        """Used by Runtime / Scheduler for automatic recovery strategy selection."""
        conn = sqlite3.connect(str(self.db_path))
        rows = conn.execute("SELECT error_pattern, strategy FROM error_resolutions WHERE skill_id = ?", (skill_id,)).fetchall()
        conn.close()
        for pattern, strategy in rows:
            if pattern.lower() in error_msg.lower():
                return strategy
        return None
