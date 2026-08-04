"""
Tests for the Myca SDK client (myca.sdk).

Covers:
  - Client initialization and context manager
  - Mock backend generation & streaming
  - Mock backend embed, classify, rerank
  - Web scraping & crawling integration via SDK
  - Brain handover & resume integration via SDK
  - Factory spec & loop integration via SDK
"""

import asyncio
import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

TEST_DB = Path(tempfile.mktemp(suffix=".db"))
TEST_VAULT = Path(tempfile.mkdtemp())


@pytest.fixture(autouse=True)
def patch_env_and_paths(monkeypatch):
    monkeypatch.setattr("myca.automation.factory.FactoryDB.DB_PATH", TEST_DB)
    monkeypatch.setattr("myca.automation.brain.DB_PATH", TEST_DB)
    monkeypatch.setattr("myca.automation.brain.VAULT_PATH", TEST_VAULT)
    monkeypatch.setattr("myca.automation.brain.HANDOVER_PATH", TEST_VAULT / "handovers")
    yield
    if TEST_DB.exists():
        TEST_DB.unlink()
    import shutil
    if TEST_VAULT.exists():
        shutil.rmtree(TEST_VAULT, ignore_errors=True)


class TestMycaSDK:

    @pytest.mark.asyncio
    async def test_sdk_context_manager_mock_backend(self):
        from myca.sdk import Myca

        async with Myca(backend="mock") as ai:
            assert ai._initialized is True
            assert ai._engine is not None

        assert ai._initialized is False

    @pytest.mark.asyncio
    async def test_sdk_generate(self):
        from myca.sdk import Myca

        async with Myca(backend="mock") as ai:
            response = await ai.generate("What is quantum computing?")
            assert "Mock response" in response

    @pytest.mark.asyncio
    async def test_sdk_stream(self):
        from myca.sdk import Myca

        async with Myca(backend="mock") as ai:
            tokens = []
            async for token in ai.stream("Tell me a story"):
                tokens.append(token)
            assert len(tokens) > 0
            full_text = "".join(tokens)
            assert "Mock" in full_text

    @pytest.mark.asyncio
    async def test_sdk_embed_and_classify(self):
        from myca.sdk import Myca

        async with Myca(backend="mock") as ai:
            embedding = await ai.embed("hello world")
            assert isinstance(embedding, list)
            assert len(embedding) > 0

            classification = await ai.classify("good morning", labels=["greeting", "farewell"])
            assert "greeting" in classification

    @pytest.mark.asyncio
    async def test_sdk_scrape(self):
        from myca.sdk import Myca

        async with Myca(backend="mock") as ai:
            with patch("myca.automation.crawler.LocalWebCrawler._fetch_html", new_callable=AsyncMock) as mock_fetch:
                mock_fetch.return_value = "<html><body><h1>Hello SDK</h1><p>Test page</p></body></html>"
                result = await ai.scrape("https://example.com")
                assert result["url"] == "https://example.com"
                assert "Hello SDK" in result["markdown"]

    @pytest.mark.asyncio
    async def test_sdk_handover_and_resume(self):
        from myca.sdk import Myca

        async with Myca(backend="mock") as ai:
            handover = await ai.handover(
                summary="SDK test session completed",
                decisions=["Decided to build standalone SDK"],
                next_steps=["Write tests"]
            )
            assert handover["id"].startswith("handover-")

            resumed = await ai.resume(handover["id"])
            assert resumed is not None
            assert resumed["summary"] == "SDK test session completed"

    @pytest.mark.asyncio
    async def test_sdk_factory_workflow(self):
        from myca.sdk import Myca

        async with Myca(backend="mock") as ai:
            spec = await ai.factory_spec("Add REST API endpoint for user profile")
            assert spec["id"].startswith("spec-")
            assert "acceptance_criteria" in spec
