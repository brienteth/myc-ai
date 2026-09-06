"""
Unit and Integration Tests for Myca OS P0.5 — Memory Controller

Verifies:
  1. Durable Memory Classifier (rejects casual greetings, accepts project metadata / decisions).
  2. Core SQLite insertions: memories, decisions, experiences, projects, entities, relations, embeddings, events.
  3. Relevance Scoring and Cosine Similarity: stores memories and retrieves them by semantic matching.
"""

import tempfile
import sqlite3
import pytest
import numpy as np
from pathlib import Path
from myca.memory import MemoryController
from myca.database import init_db

TEST_DB = Path(tempfile.mktemp(suffix=".db"))

@pytest.fixture(autouse=True)
def patch_db_path(monkeypatch):
    """Redirect DB_PATH to isolated temp database for testing."""
    monkeypatch.setattr("myca.database.DB_PATH", TEST_DB)
    monkeypatch.setattr("myca.memory.DB_PATH", TEST_DB)
    init_db()
    yield
    if TEST_DB.exists():
        try:
            TEST_DB.unlink()
        except Exception:
            pass


def test_01_durable_memory_classifier():
    """Verify that casual chat is filtered, while design choices and projects are persisted."""
    controller = MemoryController()

    # Superficial Chat
    assert controller.is_durable_memory("selam") is False
    assert controller.is_durable_memory("Merhaba, nasılsın?") is False
    assert controller.is_durable_memory("ok") is False
    assert controller.is_durable_memory("Teşekkürler, harika!") is False

    # Durable Memories
    assert controller.is_durable_memory("Myca OS projesi otonom otomasyon iş akışı mimarisine sahiptir.") is True
    assert controller.is_durable_memory("PostgreSQL veritabanı şifresi 'secret_pass_123' olarak ayarlandı.") is True
    assert controller.is_durable_memory("Cihaz eşleştirme yetki seviyesi ALLOWED olarak güncellendi.") is True


def test_02_database_operations():
    """Verify all schema-validated SQLite insertions succeed."""
    controller = MemoryController()

    # 1. Add Memory
    mem_id = controller.add_memory("Proje hedeflerinden biri yerel yapay zeka entegrasyonudur.", "project")
    assert mem_id != ""

    # 2. Add Decision
    dec_id = controller.add_decision(
        context="Pairing authorization model",
        choice="Ed25519 signature checks",
        rationale="Prevents replay attacks and verifies key ownership"
    )
    assert dec_id != ""

    # 3. Add Experience
    exp_id = controller.add_experience(
        prompt="PDF summary request",
        plan={"nodes": [{"skill": "pdf_reader"}, {"skill": "summarizer"}]},
        latency_ms=120.5,
        energy_cost=0.05,
        success=True
    )
    assert exp_id != ""

    # 4. Add Project
    proj_id = controller.add_project(
        title="Myca Intelligence",
        description="Core multi-agent planner and brain controller",
        repo_path="/projects/myca-intelligence"
    )
    assert proj_id != ""

    # 5. Add Entity & Relation
    ent_id_1 = controller.add_entity("MacBook", "hardware", {"cpu": "M1", "ram": "16GB"})
    ent_id_2 = controller.add_entity("iPhone", "hardware", {"camera": "12MP"})
    assert ent_id_1 != ""
    assert ent_id_2 != ""

    rel_id = controller.add_relation(ent_id_1, ent_id_2, "mesh_connection", {"status": "trusted"})
    assert rel_id != ""

    # 6. Add Event
    evt_id = controller.add_event("NODE_PAIRING_APPROVED", {"peer_id": "iphone_remote"})
    assert evt_id != ""

    # Check rows in DB
    conn = sqlite3.connect(str(TEST_DB))
    assert conn.execute("SELECT count(*) FROM memories").fetchone()[0] == 1
    assert conn.execute("SELECT count(*) FROM decisions").fetchone()[0] == 1
    assert conn.execute("SELECT count(*) FROM experiences").fetchone()[0] == 1
    assert conn.execute("SELECT count(*) FROM projects").fetchone()[0] == 1
    assert conn.execute("SELECT count(*) FROM entities").fetchone()[0] == 2
    assert conn.execute("SELECT count(*) FROM relations").fetchone()[0] == 1
    assert conn.execute("SELECT count(*) FROM events").fetchone()[0] == 1
    conn.close()


def test_03_relevance_scoring_and_semantic_retrieval():
    """Verify storing memories and retrieving closest semantic matches."""
    # Set threshold lower for test verification
    controller = MemoryController(threshold=0.30)

    # Insert two target memories
    controller.add_memory("PostgreSQL database credentials are user=admin password=supersecret.", "credential")
    controller.add_memory("The user prefers using the dark mode theme for the user interface.", "preference")

    # Search for database credentials
    matches = controller.retrieve_relevant_memories("PostgreSQL database credentials")
    assert len(matches) > 0
    # The database credential memory should rank first
    assert "PostgreSQL database credentials" in matches[0]["text"]

    # Search for theme preference
    matches_theme = controller.retrieve_relevant_memories("dark mode theme preference")
    assert len(matches_theme) > 0
    assert "dark mode theme" in matches_theme[0]["text"]
