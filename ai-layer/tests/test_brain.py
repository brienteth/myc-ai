"""
Tests for the Second Brain & Session Memory module.

Covers:
  - VaultDB CRUD (notes, handovers)
  - SecondBrainVault handover create/load
  - Vault indexing
  - Auto-linking
  - Scrape ingestion
  - Helper methods (title/tag/wikilink extraction)
"""

import asyncio
import json
import os
import sqlite3
import tempfile
import time
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

TEST_DB = Path(tempfile.mktemp(suffix=".db"))
TEST_VAULT = Path(tempfile.mkdtemp())


@pytest.fixture(autouse=True)
def patch_paths(monkeypatch):
    """Redirect DB and vault paths to temp locations for isolation."""
    monkeypatch.setattr("myca.automation.brain.DB_PATH", TEST_DB)
    monkeypatch.setattr("myca.automation.brain.VAULT_PATH", TEST_VAULT)
    monkeypatch.setattr("myca.automation.brain.HANDOVER_PATH", TEST_VAULT / "handovers")
    from myca.automation.brain import VaultDB
    VaultDB.init_tables()
    yield
    if TEST_DB.exists():
        TEST_DB.unlink()
    import shutil
    if TEST_VAULT.exists():
        shutil.rmtree(TEST_VAULT, ignore_errors=True)


class TestVaultDB:
    """Unit tests for VaultDB CRUD operations."""

    def test_save_and_get_note(self):
        from myca.automation.brain import VaultDB

        note = {
            "id": "note-001",
            "title": "Test Note",
            "file_path": "/tmp/test.md",
            "content_preview": "This is a test note about Python.",
            "tags": ["python", "test"],
            "links": ["Other Note"],
            "word_count": 10,
            "source_type": "note",
            "created_at": time.time(),
        }
        VaultDB.save_note(note)

        notes = VaultDB.get_notes()
        assert len(notes) >= 1
        found = [n for n in notes if n["id"] == "note-001"]
        assert len(found) == 1
        assert found[0]["title"] == "Test Note"
        assert "python" in found[0]["tags"]

    def test_search_notes(self):
        from myca.automation.brain import VaultDB

        VaultDB.save_note({
            "id": "note-s1", "title": "Machine Learning Guide",
            "content_preview": "Deep learning basics",
            "tags": ["ml", "ai"], "links": [],
            "word_count": 50, "source_type": "note",
            "created_at": time.time()
        })

        results = VaultDB.search_notes("Machine Learning")
        assert len(results) >= 1
        assert results[0]["title"] == "Machine Learning Guide"

    def test_search_by_tag(self):
        from myca.automation.brain import VaultDB

        VaultDB.save_note({
            "id": "note-t1", "title": "Tagged Note",
            "content_preview": "Some content",
            "tags": ["unique-tag-xyz"], "links": [],
            "word_count": 5, "source_type": "note",
            "created_at": time.time()
        })

        results = VaultDB.search_notes("unique-tag-xyz")
        assert len(results) >= 1

    def test_delete_note(self):
        from myca.automation.brain import VaultDB

        VaultDB.save_note({
            "id": "note-d1", "title": "Delete Me",
            "content_preview": "", "tags": [], "links": [],
            "word_count": 0, "source_type": "note",
            "created_at": time.time()
        })
        VaultDB.delete_note("note-d1")

        notes = VaultDB.get_notes()
        assert not any(n["id"] == "note-d1" for n in notes)

    def test_save_and_get_handover(self):
        from myca.automation.brain import VaultDB

        handover = {
            "id": "handover-001",
            "summary": "Completed API refactoring",
            "decisions": ["Use FastAPI instead of Flask"],
            "next_steps": ["Write unit tests", "Update docs"],
            "open_questions": ["Should we add rate limiting?"],
            "context_files": ["api.py", "models.py"],
            "session_start": time.time() - 3600,
            "session_end": time.time(),
        }
        VaultDB.save_handover(handover)

        latest = VaultDB.get_latest_handover()
        assert latest is not None
        assert latest["summary"] == "Completed API refactoring"
        assert len(latest["decisions"]) == 1
        assert len(latest["next_steps"]) == 2

    def test_handover_history(self):
        from myca.automation.brain import VaultDB

        for i in range(3):
            VaultDB.save_handover({
                "id": f"handover-h{i}",
                "summary": f"Session {i}",
                "session_end": time.time(),
            })

        history = VaultDB.get_handover_history(limit=10)
        assert len(history) >= 3


class TestSecondBrainVault:
    """Integration tests for the SecondBrainVault class."""

    @pytest.mark.asyncio
    async def test_create_handover(self):
        from myca.automation.brain import SecondBrainVault

        vault = SecondBrainVault(vault_path=str(TEST_VAULT))
        handover = await vault.create_handover(
            summary="Finished implementing the crawler module",
            decisions=["Used httpx for async HTTP"],
            next_steps=["Add rate limiting", "Write more tests"],
            open_questions=["Should we cache responses?"]
        )

        assert handover["id"].startswith("handover-")
        assert handover["summary"] == "Finished implementing the crawler module"
        assert len(handover["decisions"]) == 1
        assert len(handover["next_steps"]) == 2

        # Check that the Markdown file was created
        handover_dir = TEST_VAULT / "handovers"
        md_files = list(handover_dir.glob("*.md"))
        assert len(md_files) >= 1

    @pytest.mark.asyncio
    async def test_load_handover(self):
        from myca.automation.brain import SecondBrainVault

        vault = SecondBrainVault(vault_path=str(TEST_VAULT))
        created = await vault.create_handover(summary="Test session for loading")
        loaded = await vault.load_handover(created["id"])

        assert loaded is not None
        assert loaded["summary"] == "Test session for loading"

    @pytest.mark.asyncio
    async def test_load_latest_handover(self):
        from myca.automation.brain import SecondBrainVault

        vault = SecondBrainVault(vault_path=str(TEST_VAULT))
        await vault.create_handover(summary="Older session")
        await vault.create_handover(summary="Latest session")

        latest = await vault.load_handover()
        assert latest is not None
        assert latest["summary"] == "Latest session"

    @pytest.mark.asyncio
    async def test_index_vault(self):
        from myca.automation.brain import SecondBrainVault

        # Create test Markdown files
        (TEST_VAULT / "note1.md").write_text("# First Note\nSome content about #python\n", encoding="utf-8")
        (TEST_VAULT / "note2.md").write_text("# Second Note\nLinks to [[First Note]]\n", encoding="utf-8")

        vault = SecondBrainVault(vault_path=str(TEST_VAULT))
        result = await vault.index_vault()

        assert result["indexed"] >= 2
        assert result["errors"] == 0

    @pytest.mark.asyncio
    async def test_auto_link_notes(self):
        from myca.automation.brain import SecondBrainVault, VaultDB

        # Create notes that reference each other
        VaultDB.save_note({
            "id": "note-al1", "title": "Python Guide",
            "content_preview": "This guide covers machine learning basics",
            "tags": ["python", "ml"], "links": [],
            "word_count": 20, "source_type": "note",
            "created_at": time.time()
        })
        VaultDB.save_note({
            "id": "note-al2", "title": "Machine Learning",
            "content_preview": "See the python guide for details",
            "tags": ["ml"], "links": [],
            "word_count": 15, "source_type": "note",
            "created_at": time.time()
        })

        vault = SecondBrainVault(vault_path=str(TEST_VAULT))
        result = await vault.auto_link_notes()

        assert result["links_created"] >= 1

    @pytest.mark.asyncio
    async def test_ingest_scrape(self):
        from myca.automation.brain import SecondBrainVault

        scrape_result = {
            "url": "https://example.com/article",
            "title": "Example Article",
            "markdown": "# Example\n\nThis is the content of the article.",
            "word_count": 8,
            "metadata": {"url": "https://example.com/article"}
        }

        vault = SecondBrainVault(vault_path=str(TEST_VAULT))
        note = await vault.ingest_scrape(scrape_result)

        assert note["id"].startswith("scrape-")
        assert note["source_type"] == "scrape"
        assert note["title"] == "Example Article"

        # Check file was created
        scrapes_dir = TEST_VAULT / "scrapes"
        assert scrapes_dir.exists()
        md_files = list(scrapes_dir.glob("*.md"))
        assert len(md_files) >= 1


class TestHelperMethods:
    """Tests for the utility/helper methods."""

    def test_extract_title_from_h1(self):
        from myca.automation.brain import SecondBrainVault
        title = SecondBrainVault._extract_title("# My Title\nSome content", "fallback")
        assert title == "My Title"

    def test_extract_title_from_yaml(self):
        from myca.automation.brain import SecondBrainVault
        content = "---\ntitle: YAML Title\ndate: 2024-01-01\n---\n# Content"
        title = SecondBrainVault._extract_title(content, "fallback")
        assert title == "YAML Title"

    def test_extract_title_fallback(self):
        from myca.automation.brain import SecondBrainVault
        title = SecondBrainVault._extract_title("No heading here", "my_fallback")
        assert title == "my_fallback"

    def test_extract_tags_hashtag(self):
        from myca.automation.brain import SecondBrainVault
        tags = SecondBrainVault._extract_tags("This is about #python and #testing")
        assert "python" in tags
        assert "testing" in tags

    def test_extract_wikilinks(self):
        from myca.automation.brain import SecondBrainVault
        links = SecondBrainVault._extract_wikilinks("See [[Other Note]] and [[Another One]]")
        assert "Other Note" in links
        assert "Another One" in links

    def test_extract_wikilinks_empty(self):
        from myca.automation.brain import SecondBrainVault
        links = SecondBrainVault._extract_wikilinks("No wikilinks here")
        assert links == []
