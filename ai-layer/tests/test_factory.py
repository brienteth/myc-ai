"""
Tests for the Software Factory Engine (Finn-loop Inspired).

Covers:
  - Spec creation and CRUD
  - Status transitions
  - Build simulation
  - Review verdict logic
  - Full loop cycle
"""

import asyncio
import json
import os
import sqlite3
import tempfile
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Patch DB path before importing factory module
TEST_DB = Path(tempfile.mktemp(suffix=".db"))


@pytest.fixture(autouse=True)
def patch_db_path(monkeypatch):
    """Redirect factory DB to a temp file for test isolation."""
    monkeypatch.setattr("myca.automation.factory.FactoryDB.DB_PATH", TEST_DB)
    from myca.automation.factory import FactoryDB
    FactoryDB.init_tables()
    yield
    if TEST_DB.exists():
        TEST_DB.unlink()


class TestFactoryDB:
    """Unit tests for FactoryDB CRUD operations."""

    def test_save_and_get_spec(self):
        from myca.automation.factory import FactoryDB, SPEC_STATUS_DRAFT

        spec = {
            "id": "spec-test001",
            "title": "Test Feature",
            "description": "Add a test feature",
            "repo_path": "/tmp/test-repo",
            "acceptance_criteria": ["AC-1: It works", "AC-2: It has tests"],
            "non_goals": ["NG-1: No UI changes"],
            "status": SPEC_STATUS_DRAFT,
            "created_at": time.time(),
        }
        FactoryDB.save_spec(spec)

        result = FactoryDB.get_spec("spec-test001")
        assert result is not None
        assert result["title"] == "Test Feature"
        assert result["status"] == SPEC_STATUS_DRAFT
        assert len(result["acceptance_criteria"]) == 2
        assert result["acceptance_criteria"][0] == "AC-1: It works"
        assert result["non_goals"][0] == "NG-1: No UI changes"

    def test_list_specs_no_filter(self):
        from myca.automation.factory import FactoryDB

        FactoryDB.save_spec({"id": "spec-a", "title": "A", "status": "DRAFT", "created_at": time.time()})
        FactoryDB.save_spec({"id": "spec-b", "title": "B", "status": "AGENT_READY", "created_at": time.time()})

        all_specs = FactoryDB.list_specs()
        assert len(all_specs) >= 2

    def test_list_specs_filtered(self):
        from myca.automation.factory import FactoryDB

        FactoryDB.save_spec({"id": "spec-f1", "title": "F1", "status": "DRAFT", "created_at": time.time()})
        FactoryDB.save_spec({"id": "spec-f2", "title": "F2", "status": "AGENT_READY", "created_at": time.time()})

        ready = FactoryDB.list_specs(status="AGENT_READY")
        for s in ready:
            assert s["status"] == "AGENT_READY"

    def test_update_spec_status(self):
        from myca.automation.factory import FactoryDB

        FactoryDB.save_spec({"id": "spec-u1", "title": "Update Me", "status": "DRAFT", "created_at": time.time()})
        FactoryDB.update_spec_status("spec-u1", "AGENT_READY")

        spec = FactoryDB.get_spec("spec-u1")
        assert spec["status"] == "AGENT_READY"

    def test_delete_spec(self):
        from myca.automation.factory import FactoryDB

        FactoryDB.save_spec({"id": "spec-d1", "title": "Delete Me", "status": "DRAFT", "created_at": time.time()})
        FactoryDB.delete_spec("spec-d1")

        assert FactoryDB.get_spec("spec-d1") is None

    def test_save_and_get_review(self):
        from myca.automation.factory import FactoryDB

        FactoryDB.save_spec({"id": "spec-r1", "title": "Review Target", "status": "IN_PROGRESS", "created_at": time.time()})
        review = {
            "id": "review-001",
            "spec_id": "spec-r1",
            "verdict": "LOOP_APPROVED",
            "findings": {"must_fix": [], "suggestions": ["Consider adding more tests"], "praise": ["Clean code"]}
        }
        FactoryDB.save_review(review)

        reviews = FactoryDB.get_reviews("spec-r1")
        assert len(reviews) == 1
        assert reviews[0]["verdict"] == "LOOP_APPROVED"
        assert "Clean code" in reviews[0]["findings"]["praise"]


class TestSoftwareFactoryEngine:
    """Integration tests for the Factory Engine."""

    @pytest.mark.asyncio
    async def test_spec_interview_without_llm(self):
        from myca.automation.factory import SoftwareFactoryEngine

        engine = SoftwareFactoryEngine(inference_engine=None)
        spec = await engine.spec_interview("Add dark mode toggle to settings page")

        assert spec["id"].startswith("spec-")
        assert spec["status"] == "SPECIFIED"
        assert "dark mode" in spec["title"].lower() or "dark mode" in spec["description"].lower()
        assert len(spec["acceptance_criteria"]) >= 1

    @pytest.mark.asyncio
    async def test_build_rejects_non_ready_spec(self):
        from myca.automation.factory import SoftwareFactoryEngine, FactoryDB

        engine = SoftwareFactoryEngine(inference_engine=None)
        FactoryDB.save_spec({"id": "spec-nr", "title": "Not Ready", "status": "DRAFT", "created_at": time.time()})

        with pytest.raises(ValueError, match="not AGENT_READY"):
            await engine.build_spec("spec-nr")

    @pytest.mark.asyncio
    async def test_build_transitions_to_in_progress(self):
        from myca.automation.factory import SoftwareFactoryEngine, FactoryDB

        engine = SoftwareFactoryEngine(inference_engine=None)
        FactoryDB.save_spec({"id": "spec-bp", "title": "Build Me", "status": "AGENT_READY", "created_at": time.time()})

        result = await engine.build_spec("spec-bp")
        assert result["status"] == "IN_PROGRESS"

    @pytest.mark.asyncio
    async def test_review_without_llm_escalates(self):
        from myca.automation.factory import SoftwareFactoryEngine, FactoryDB, REVIEW_NEEDS_HUMAN

        engine = SoftwareFactoryEngine(inference_engine=None)
        FactoryDB.save_spec({"id": "spec-rv", "title": "Review Me", "status": "IN_PROGRESS", "created_at": time.time()})

        review = await engine.review_build("spec-rv")
        assert review["verdict"] == REVIEW_NEEDS_HUMAN

    @pytest.mark.asyncio
    async def test_run_loop_idle_when_no_ready_specs(self):
        from myca.automation.factory import SoftwareFactoryEngine

        engine = SoftwareFactoryEngine(inference_engine=None)
        result = await engine.run_loop()
        assert result["status"] == "idle"

    @pytest.mark.asyncio
    async def test_full_loop_cycle(self):
        from myca.automation.factory import SoftwareFactoryEngine, FactoryDB

        engine = SoftwareFactoryEngine(inference_engine=None)

        # Create and approve a spec
        spec = await engine.spec_interview("Add logging to API endpoints")
        FactoryDB.update_spec_status(spec["id"], "AGENT_READY")

        # Run the loop
        result = await engine.run_loop()
        assert result["status"] == "completed"
        assert result["spec_id"] == spec["id"]
        assert result["verdict"] in ["LOOP_APPROVED", "LOOP_CHANGES_REQUESTED", "NEEDS_HUMAN_REVIEW"]
