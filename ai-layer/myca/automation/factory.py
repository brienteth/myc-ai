"""
Software Factory Engine (Finn-loop Inspired)

Autonomous 3-phase development loop:
  1. Spec  — analyze codebase, interview user, produce acceptance criteria (AC-N) & non-goals (NG-N)
  2. Build — claim an AGENT_READY spec, implement changes, run local tests
  3. Review — compare changes against spec criteria, produce a 3-level verdict

All state is stored in the local SQLite database (~/.myca/myca_automation.db).
No Linear, no GitHub API, no cloud lock-in — works 100% offline.
"""

import json
import logging
import os
import re
import subprocess
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("myca.automation.factory")

# ── Status Constants ───────────────────────────────────────────
SPEC_STATUS_DRAFT = "DRAFT"
SPEC_STATUS_SPECIFIED = "SPECIFIED"
SPEC_STATUS_AGENT_READY = "AGENT_READY"
SPEC_STATUS_IN_PROGRESS = "IN_PROGRESS"
SPEC_STATUS_BLOCKED = "BLOCKED"
SPEC_STATUS_NEEDS_HUMAN_REVIEW = "NEEDS_HUMAN_REVIEW"
SPEC_STATUS_APPROVED = "APPROVED"
SPEC_STATUS_MERGED = "MERGED"

REVIEW_LOOP_APPROVED = "LOOP_APPROVED"
REVIEW_CHANGES_REQUESTED = "LOOP_CHANGES_REQUESTED"
REVIEW_NEEDS_HUMAN = "NEEDS_HUMAN_REVIEW"


# ── Database Helpers (factory_specs & factory_reviews) ─────────
class FactoryDB:
    """Manages factory_specs and factory_reviews tables in the automation DB."""

    DB_PATH = Path("~/.myca/myca_automation.db").expanduser()

    @classmethod
    def _conn(cls):
        import sqlite3
        return sqlite3.connect(str(cls.DB_PATH))

    @classmethod
    def init_tables(cls):
        conn = cls._conn()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS factory_specs (
                id              TEXT PRIMARY KEY,
                title           TEXT NOT NULL,
                description     TEXT,
                repo_path       TEXT,
                acceptance_criteria TEXT,   -- JSON array of AC strings
                non_goals       TEXT,       -- JSON array of NG strings
                status          TEXT NOT NULL DEFAULT 'DRAFT',
                assigned_to     TEXT,
                branch_name     TEXT,
                diff_summary    TEXT,
                created_at      REAL,
                updated_at      REAL
            );

            CREATE TABLE IF NOT EXISTS factory_reviews (
                id              TEXT PRIMARY KEY,
                spec_id         TEXT NOT NULL,
                verdict         TEXT NOT NULL,  -- LOOP_APPROVED, LOOP_CHANGES_REQUESTED, NEEDS_HUMAN_REVIEW
                findings        TEXT,           -- JSON: {must_fix:[], suggestions:[], praise:[]}
                reviewed_at     REAL,
                FOREIGN KEY (spec_id) REFERENCES factory_specs(id)
            );

            CREATE INDEX IF NOT EXISTS idx_specs_status ON factory_specs(status);
        """)
        conn.commit()
        conn.close()

    # ── Spec CRUD ──────────────────────────────────────────────

    @classmethod
    def save_spec(cls, spec: dict):
        conn = cls._conn()
        conn.execute("""
            INSERT OR REPLACE INTO factory_specs
            (id, title, description, repo_path, acceptance_criteria, non_goals,
             status, assigned_to, branch_name, diff_summary, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            spec["id"], spec["title"], spec.get("description", ""),
            spec.get("repo_path", ""), json.dumps(spec.get("acceptance_criteria", [])),
            json.dumps(spec.get("non_goals", [])),
            spec.get("status", SPEC_STATUS_DRAFT),
            spec.get("assigned_to"), spec.get("branch_name"),
            spec.get("diff_summary"),
            spec.get("created_at", time.time()), time.time()
        ))
        conn.commit()
        conn.close()

    @classmethod
    def get_spec(cls, spec_id: str) -> Optional[dict]:
        conn = cls._conn()
        conn.row_factory = _dict_factory
        row = conn.execute("SELECT * FROM factory_specs WHERE id = ?", (spec_id,)).fetchone()
        conn.close()
        if row:
            row["acceptance_criteria"] = json.loads(row.get("acceptance_criteria") or "[]")
            row["non_goals"] = json.loads(row.get("non_goals") or "[]")
        return row

    @classmethod
    def list_specs(cls, status: Optional[str] = None) -> List[dict]:
        conn = cls._conn()
        conn.row_factory = _dict_factory
        if status:
            rows = conn.execute("SELECT * FROM factory_specs WHERE status = ? ORDER BY updated_at DESC", (status,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM factory_specs ORDER BY updated_at DESC").fetchall()
        conn.close()
        for r in rows:
            r["acceptance_criteria"] = json.loads(r.get("acceptance_criteria") or "[]")
            r["non_goals"] = json.loads(r.get("non_goals") or "[]")
        return rows

    @classmethod
    def update_spec_status(cls, spec_id: str, status: str):
        conn = cls._conn()
        conn.execute("UPDATE factory_specs SET status = ?, updated_at = ? WHERE id = ?",
                      (status, time.time(), spec_id))
        conn.commit()
        conn.close()

    @classmethod
    def delete_spec(cls, spec_id: str):
        conn = cls._conn()
        conn.execute("DELETE FROM factory_reviews WHERE spec_id = ?", (spec_id,))
        conn.execute("DELETE FROM factory_specs WHERE id = ?", (spec_id,))
        conn.commit()
        conn.close()

    # ── Review CRUD ────────────────────────────────────────────

    @classmethod
    def save_review(cls, review: dict):
        conn = cls._conn()
        conn.execute("""
            INSERT OR REPLACE INTO factory_reviews (id, spec_id, verdict, findings, reviewed_at)
            VALUES (?, ?, ?, ?, ?)
        """, (
            review["id"], review["spec_id"], review["verdict"],
            json.dumps(review.get("findings", {})), time.time()
        ))
        conn.commit()
        conn.close()

    @classmethod
    def get_reviews(cls, spec_id: str) -> List[dict]:
        conn = cls._conn()
        conn.row_factory = _dict_factory
        rows = conn.execute("SELECT * FROM factory_reviews WHERE spec_id = ? ORDER BY reviewed_at DESC",
                             (spec_id,)).fetchall()
        conn.close()
        for r in rows:
            r["findings"] = json.loads(r.get("findings") or "{}")
        return rows


def _dict_factory(cursor, row):
    return {col[0]: row[idx] for idx, col in enumerate(cursor.description)}


# ── Git Helpers ────────────────────────────────────────────────

class LocalGit:
    """Lightweight local git wrapper. No GitHub API needed."""

    @staticmethod
    def run(cmd: str, cwd: str, check: bool = True) -> str:
        result = subprocess.run(
            cmd, shell=True, cwd=cwd,
            capture_output=True, text=True, timeout=30
        )
        if check and result.returncode != 0:
            raise RuntimeError(f"git command failed: {cmd}\n{result.stderr}")
        return result.stdout.strip()

    @staticmethod
    def is_repo(path: str) -> bool:
        try:
            LocalGit.run("git rev-parse --is-inside-work-tree", cwd=path)
            return True
        except Exception:
            return False

    @staticmethod
    def default_branch(cwd: str) -> str:
        try:
            return LocalGit.run("git symbolic-ref --short HEAD", cwd=cwd)
        except Exception:
            return "main"

    @staticmethod
    def create_branch(branch_name: str, cwd: str):
        LocalGit.run(f"git checkout -b {branch_name}", cwd=cwd)

    @staticmethod
    def get_diff(cwd: str) -> str:
        return LocalGit.run("git diff --stat", cwd=cwd, check=False)

    @staticmethod
    def get_diff_detailed(cwd: str) -> str:
        return LocalGit.run("git diff", cwd=cwd, check=False)

    @staticmethod
    def get_status(cwd: str) -> str:
        return LocalGit.run("git status --porcelain", cwd=cwd, check=False)

    @staticmethod
    def checkout(branch: str, cwd: str):
        LocalGit.run(f"git checkout {branch}", cwd=cwd)

    @staticmethod
    def get_file_list(cwd: str) -> List[str]:
        output = LocalGit.run("git ls-files", cwd=cwd, check=False)
        return [f for f in output.split("\n") if f]


# ── Software Factory Engine ───────────────────────────────────

class SoftwareFactoryEngine:
    """
    Three-phase autonomous development loop.

    Phase 1 — Spec:    Analyze the repo, produce AC/NG criteria
    Phase 2 — Build:   Implement the spec on an isolated branch
    Phase 3 — Review:  Compare changes against spec, produce verdict
    """

    def __init__(self, inference_engine=None):
        """
        Args:
            inference_engine: Myca's local LLM inference engine (optional).
                              When None, the factory still works for manual spec/review
                              but cannot generate AI-powered analysis.
        """
        self.inference = inference_engine
        FactoryDB.init_tables()

    # ── Phase 1: Spec ──────────────────────────────────────────

    async def spec_interview(self, prompt: str, repo_path: Optional[str] = None) -> dict:
        """
        Analyze the codebase and user request to produce a structured spec
        with Acceptance Criteria (AC-1..N) and Non-Goals (NG-1..N).
        """
        spec_id = f"spec-{uuid.uuid4().hex[:8]}"
        now = time.time()

        # Gather repo context
        repo_context = ""
        if repo_path and os.path.isdir(repo_path):
            if LocalGit.is_repo(repo_path):
                files = LocalGit.get_file_list(repo_path)
                repo_context = f"Repository file tree ({len(files)} files):\n"
                repo_context += "\n".join(files[:100])  # Cap for LLM context
                if len(files) > 100:
                    repo_context += f"\n... and {len(files) - 100} more files"

        # Use LLM to generate structured spec
        if self.inference:
            system_prompt = """You are a precise software specification writer.
Given a user's feature request and the repository context, produce a JSON object with:
{
  "title": "Short descriptive title",
  "description": "Detailed description of what needs to be built",
  "acceptance_criteria": ["AC-1: ...", "AC-2: ...", ...],
  "non_goals": ["NG-1: ...", "NG-2: ..."]
}
Output ONLY valid JSON. No markdown, no commentary."""

            user_input = f"User Request: {prompt}"
            if repo_context:
                user_input += f"\n\nRepository Context:\n{repo_context}"

            try:
                raw = await self.inference.generate(user_input, system_prompt=system_prompt)
                raw = raw.strip()
                # Clean markdown wrappers
                if raw.startswith("```"):
                    lines = raw.splitlines()
                    lines = [l for l in lines if not l.startswith("```")]
                    raw = "\n".join(lines).strip()
                start = raw.find("{")
                end = raw.rfind("}")
                if start != -1 and end != -1:
                    raw = raw[start:end + 1]
                spec_data = json.loads(raw)
            except Exception as e:
                logger.warning(f"LLM spec generation failed: {e}, using fallback")
                spec_data = {
                    "title": prompt[:80],
                    "description": prompt,
                    "acceptance_criteria": [f"AC-1: {prompt}"],
                    "non_goals": []
                }
        else:
            spec_data = {
                "title": prompt[:80],
                "description": prompt,
                "acceptance_criteria": [f"AC-1: {prompt}"],
                "non_goals": []
            }

        spec = {
            "id": spec_id,
            "title": spec_data.get("title", prompt[:80]),
            "description": spec_data.get("description", prompt),
            "repo_path": repo_path or "",
            "acceptance_criteria": spec_data.get("acceptance_criteria", []),
            "non_goals": spec_data.get("non_goals", []),
            "status": SPEC_STATUS_SPECIFIED,
            "created_at": now,
        }
        FactoryDB.save_spec(spec)
        logger.info(f"[FACTORY] Spec created: {spec_id} — {spec['title']}")
        return spec

    # ── Phase 2: Build ─────────────────────────────────────────

    async def build_spec(self, spec_id: str) -> dict:
        """
        Claim an AGENT_READY spec, create an isolated branch,
        generate implementation plan, and record changes.
        Returns the updated spec with build metadata.
        """
        spec = FactoryDB.get_spec(spec_id)
        if not spec:
            raise ValueError(f"Spec {spec_id} not found")
        if spec["status"] != SPEC_STATUS_AGENT_READY:
            raise ValueError(f"Spec {spec_id} is not AGENT_READY (current: {spec['status']})")

        # Transition to IN_PROGRESS
        FactoryDB.update_spec_status(spec_id, SPEC_STATUS_IN_PROGRESS)
        spec["status"] = SPEC_STATUS_IN_PROGRESS

        repo_path = spec.get("repo_path", "")
        branch_name = f"factory/{spec_id}"

        # Create isolated branch if repo exists
        if repo_path and os.path.isdir(repo_path) and LocalGit.is_repo(repo_path):
            try:
                LocalGit.create_branch(branch_name, cwd=repo_path)
                spec["branch_name"] = branch_name
            except Exception as e:
                logger.warning(f"Could not create branch: {e}")

        # Generate implementation plan via LLM
        if self.inference:
            ac_text = "\n".join(spec.get("acceptance_criteria", []))
            ng_text = "\n".join(spec.get("non_goals", []))

            system_prompt = """You are a senior software engineer. Given a spec with acceptance criteria and non-goals,
produce a concise implementation plan as a JSON object:
{
  "plan_steps": ["Step 1: ...", "Step 2: ...", ...],
  "files_to_modify": ["path/to/file1.py", ...],
  "files_to_create": ["path/to/new_file.py", ...],
  "estimated_complexity": "low|medium|high"
}
Output ONLY valid JSON."""

            user_input = f"""Spec: {spec['title']}
Description: {spec['description']}
Acceptance Criteria:
{ac_text}
Non-Goals:
{ng_text}"""

            try:
                raw = await self.inference.generate(user_input, system_prompt=system_prompt)
                raw = raw.strip()
                if raw.startswith("```"):
                    lines = raw.splitlines()
                    lines = [l for l in lines if not l.startswith("```")]
                    raw = "\n".join(lines).strip()
                start = raw.find("{")
                end = raw.rfind("}")
                if start != -1 and end != -1:
                    raw = raw[start:end + 1]
                build_plan = json.loads(raw)
                spec["diff_summary"] = json.dumps(build_plan)
            except Exception as e:
                logger.warning(f"LLM build plan failed: {e}")
                spec["diff_summary"] = json.dumps({"plan_steps": ["Manual implementation required"], "estimated_complexity": "medium"})
        else:
            spec["diff_summary"] = json.dumps({"plan_steps": ["Manual implementation required"], "estimated_complexity": "medium"})

        FactoryDB.save_spec(spec)
        logger.info(f"[FACTORY] Build started for spec: {spec_id}")
        return spec

    # ── Phase 3: Review ────────────────────────────────────────

    async def review_build(self, spec_id: str) -> dict:
        """
        Review the build changes against the spec's acceptance criteria.
        Produces a three-group verdict:
          - must_fix:     blocking issues
          - suggestions:  non-blocking improvements
          - praise:       things done well

        Verdict: LOOP_APPROVED, LOOP_CHANGES_REQUESTED, or NEEDS_HUMAN_REVIEW
        """
        spec = FactoryDB.get_spec(spec_id)
        if not spec:
            raise ValueError(f"Spec {spec_id} not found")

        repo_path = spec.get("repo_path", "")
        diff_text = ""
        if repo_path and os.path.isdir(repo_path) and LocalGit.is_repo(repo_path):
            diff_text = LocalGit.get_diff_detailed(cwd=repo_path)

        review_id = f"review-{uuid.uuid4().hex[:8]}"
        findings = {"must_fix": [], "suggestions": [], "praise": []}

        if self.inference:
            ac_text = "\n".join(spec.get("acceptance_criteria", []))
            ng_text = "\n".join(spec.get("non_goals", []))

            system_prompt = """You are a strict code reviewer. Given a spec (acceptance criteria + non-goals) and a git diff,
produce a JSON review:
{
  "verdict": "LOOP_APPROVED" | "LOOP_CHANGES_REQUESTED" | "NEEDS_HUMAN_REVIEW",
  "must_fix": ["Issue 1: ...", ...],
  "suggestions": ["Suggestion 1: ...", ...],
  "praise": ["Good: ...", ...]
}
Rules:
- LOOP_APPROVED: All AC met, no blocking issues.
- LOOP_CHANGES_REQUESTED: AC partially met or code issues found.
- NEEDS_HUMAN_REVIEW: Cannot determine correctness, needs human eyes.
Output ONLY valid JSON."""

            user_input = f"""Spec: {spec['title']}
Acceptance Criteria:
{ac_text}
Non-Goals:
{ng_text}

Git Diff:
{diff_text[:4000]}"""

            try:
                raw = await self.inference.generate(user_input, system_prompt=system_prompt)
                raw = raw.strip()
                if raw.startswith("```"):
                    lines = raw.splitlines()
                    lines = [l for l in lines if not l.startswith("```")]
                    raw = "\n".join(lines).strip()
                start = raw.find("{")
                end = raw.rfind("}")
                if start != -1 and end != -1:
                    raw = raw[start:end + 1]
                review_data = json.loads(raw)
                verdict = review_data.get("verdict", REVIEW_NEEDS_HUMAN)
                findings = {
                    "must_fix": review_data.get("must_fix", []),
                    "suggestions": review_data.get("suggestions", []),
                    "praise": review_data.get("praise", [])
                }
            except Exception as e:
                logger.warning(f"LLM review failed: {e}")
                verdict = REVIEW_NEEDS_HUMAN
                findings["must_fix"].append(f"Automated review failed: {e}")
        else:
            # Without LLM, escalate to human
            verdict = REVIEW_NEEDS_HUMAN
            findings["suggestions"].append("No local LLM available — manual review required.")

        review = {
            "id": review_id,
            "spec_id": spec_id,
            "verdict": verdict,
            "findings": findings,
        }
        FactoryDB.save_review(review)

        # Update spec status based on verdict
        if verdict == REVIEW_LOOP_APPROVED:
            FactoryDB.update_spec_status(spec_id, SPEC_STATUS_APPROVED)
        elif verdict == REVIEW_CHANGES_REQUESTED:
            FactoryDB.update_spec_status(spec_id, SPEC_STATUS_IN_PROGRESS)
        else:
            FactoryDB.update_spec_status(spec_id, SPEC_STATUS_NEEDS_HUMAN_REVIEW)

        logger.info(f"[FACTORY] Review for {spec_id}: {verdict}")
        return review

    # ── Autonomous Loop ────────────────────────────────────────

    async def run_loop(self, repo_path: Optional[str] = None) -> dict:
        """
        Run one full cycle of the autonomous factory loop:
          1. Find next AGENT_READY spec
          2. Build it
          3. Review the build

        Returns summary of the loop iteration.
        """
        # Find next AGENT_READY spec
        ready_specs = FactoryDB.list_specs(status=SPEC_STATUS_AGENT_READY)
        if not ready_specs:
            return {"status": "idle", "message": "No AGENT_READY specs found. Create specs and mark them as AGENT_READY."}

        spec = ready_specs[0]
        spec_id = spec["id"]

        # Override repo_path if provided
        if repo_path:
            spec["repo_path"] = repo_path
            FactoryDB.save_spec(spec)

        logger.info(f"[FACTORY LOOP] Processing spec: {spec_id} — {spec['title']}")

        # Build
        try:
            build_result = await self.build_spec(spec_id)
        except Exception as e:
            FactoryDB.update_spec_status(spec_id, SPEC_STATUS_BLOCKED)
            return {"status": "error", "phase": "build", "spec_id": spec_id, "error": str(e)}

        # Review
        try:
            review_result = await self.review_build(spec_id)
        except Exception as e:
            return {"status": "error", "phase": "review", "spec_id": spec_id, "error": str(e)}

        return {
            "status": "completed",
            "spec_id": spec_id,
            "title": spec["title"],
            "verdict": review_result["verdict"],
            "findings": review_result["findings"],
        }
