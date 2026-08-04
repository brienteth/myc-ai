"""
Myca SDK — Standalone Python Client for Myca AI

Usage:
    import asyncio
    from myca.sdk import Myca

    async def main():
        async with Myca() as ai:
            # Text generation
            result = await ai.generate("Explain quantum computing")
            print(result)

            # Streaming
            async for token in ai.stream("Write a haiku"):
                print(token, end="", flush=True)

            # Embeddings
            vec = await ai.embed("Hello world")

            # Web scraping
            page = await ai.scrape("https://example.com")

            # Session memory
            await ai.handover("Today's progress", next_steps=["Write tests"])
            ctx = await ai.resume()

    asyncio.run(main())

---

Supported backends:
    - "llamacpp"  → Local in-process inference (llama-cpp-python)
    - "mock"      → Lightweight test backend (no GPU needed)
    - "remote"    → Connect to a running Myca node via HTTP
    - "auto"      → Auto-detect best available backend
"""

import asyncio
import json
import logging
import os
import time
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional, Union

logger = logging.getLogger("myca.sdk")


class Myca:
    """
    High-level Myca AI client.

    Provides a unified interface to Myca's capabilities:
      - LLM: generate, stream, embed, classify, rerank
      - Web: scrape, crawl, extract
      - Brain: handover, resume, index, search, ingest
      - Factory: spec, build, review, loop

    Can run locally (in-process inference) or connect to a remote Myca node.

    Example:
        async with Myca(backend="llamacpp") as ai:
            print(await ai.generate("Hello!"))
    """

    def __init__(
        self,
        backend: str = "auto",
        model_path: Optional[str] = None,
        remote_url: Optional[str] = None,
        gpu_layers: int = -1,
        ctx_size: int = 4096,
        system_prompt: Optional[str] = None,
        data_dir: Optional[str] = None,
        verbose: bool = False,
    ):
        """
        Initialize the Myca SDK client.

        Args:
            backend: Inference backend - "auto", "llamacpp", "mock", or "remote"
            model_path: Path to GGUF model file (for llamacpp)
            remote_url: URL of a running Myca node (for remote backend)
            gpu_layers: Number of GPU layers (-1 = all)
            ctx_size: Context window size
            system_prompt: Default system prompt for all generations
            data_dir: Data directory (default: ~/.myca)
            verbose: Enable verbose logging
        """
        self.backend_name = backend
        self.model_path = model_path
        self.remote_url = remote_url
        self.gpu_layers = gpu_layers
        self.ctx_size = ctx_size
        self.system_prompt = system_prompt
        self.data_dir = Path(data_dir or "~/.myca").expanduser()
        self.verbose = verbose

        self._engine = None
        self._crawler = None
        self._brain = None
        self._factory = None
        self._initialized = False

        if verbose:
            logging.basicConfig(level=logging.DEBUG)

    # ── Lifecycle ──────────────────────────────────────────────

    async def __aenter__(self):
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.shutdown()

    async def initialize(self):
        """Boot the inference engine and supporting modules."""
        if self._initialized:
            return

        if self.backend_name == "remote":
            self._engine = _RemoteEngine(self.remote_url)
        else:
            self._engine = self._create_local_engine()

        self._initialized = True
        logger.info(f"[SDK] Myca initialized (backend={self.backend_name})")

    async def shutdown(self):
        """Clean up resources."""
        if hasattr(self._engine, "unload"):
            try:
                self._engine.unload()
            except Exception:
                pass
        self._initialized = False
        logger.info("[SDK] Myca shut down")

    def _create_local_engine(self):
        """Create a local inference engine based on backend selection."""
        # Apply environment overrides
        if self.model_path:
            os.environ["MYCA_MODEL_PATH"] = self.model_path
        if self.backend_name != "auto":
            os.environ["MYCA_BACKEND"] = self.backend_name
        os.environ["MYCA_GPU_LAYERS"] = str(self.gpu_layers)
        os.environ["MYCA_CTX"] = str(self.ctx_size)
        if self.verbose:
            os.environ["MYCA_VERBOSE"] = "true"

        from myca.inference.registry import BackendRegistry
        # Ensure backends are registered
        import myca.inference.backends  # noqa: F401

        return BackendRegistry.create_backend(self.backend_name)

    def _ensure_init(self):
        if not self._initialized:
            raise RuntimeError("Myca not initialized. Use 'async with Myca() as ai:' or call 'await ai.initialize()'")

    # ── LLM: Text Generation ──────────────────────────────────

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs
    ) -> str:
        """
        Generate a complete text response.

        Args:
            prompt: The user prompt / question
            system_prompt: Override the default system prompt
            temperature: Sampling temperature (0.0 = deterministic, 1.0 = creative)
            max_tokens: Maximum tokens to generate

        Returns:
            Generated text string
        """
        self._ensure_init()
        sys = system_prompt or self.system_prompt

        if isinstance(self._engine, _RemoteEngine):
            return await self._engine.generate(prompt, system_prompt=sys,
                                                temperature=temperature,
                                                max_tokens=max_tokens, **kwargs)

        full_prompt = self._build_prompt(prompt, sys)
        return await self._engine.generate(full_prompt,
                                            temperature=temperature,
                                            max_tokens=max_tokens, **kwargs)

    async def stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Stream generated text token by token.

        Usage:
            async for token in ai.stream("Write a story"):
                print(token, end="", flush=True)
        """
        self._ensure_init()
        sys = system_prompt or self.system_prompt

        if isinstance(self._engine, _RemoteEngine):
            async for token in self._engine.stream(prompt, system_prompt=sys,
                                                    temperature=temperature,
                                                    max_tokens=max_tokens, **kwargs):
                yield token
            return

        full_prompt = self._build_prompt(prompt, sys)
        async for token in self._engine.stream(full_prompt,
                                                temperature=temperature,
                                                max_tokens=max_tokens, **kwargs):
            yield token

    async def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs
    ) -> str:
        """
        Chat with message history (OpenAI-compatible format).

        Args:
            messages: [{"role": "user"|"assistant"|"system", "content": "..."}]

        Returns:
            Assistant's response text
        """
        self._ensure_init()

        if isinstance(self._engine, _RemoteEngine):
            return await self._engine.chat(messages, temperature=temperature,
                                            max_tokens=max_tokens, **kwargs)

        # Convert messages to a single prompt for local inference
        prompt_parts = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                prompt_parts.append(f"<|system|>\n{content}\n")
            elif role == "user":
                prompt_parts.append(f"<|user|>\n{content}\n")
            elif role == "assistant":
                prompt_parts.append(f"<|assistant|>\n{content}\n")

        prompt_parts.append("<|assistant|>\n")
        full_prompt = "".join(prompt_parts)

        return await self._engine.generate(full_prompt,
                                            temperature=temperature,
                                            max_tokens=max_tokens, **kwargs)

    # ── LLM: Embeddings & Classification ──────────────────────

    async def embed(self, text: str) -> List[float]:
        """Generate vector embeddings for text."""
        self._ensure_init()
        return await self._engine.embed(text)

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts."""
        self._ensure_init()
        return [await self._engine.embed(t) for t in texts]

    async def rerank(self, query: str, documents: List[str]) -> List[float]:
        """Rerank documents by relevance to query."""
        self._ensure_init()
        return await self._engine.rerank(query, documents)

    async def classify(self, text: str, labels: List[str]) -> Dict[str, float]:
        """Classify text against labels."""
        self._ensure_init()
        return await self._engine.classify(text, labels)

    # ── Web Crawler ────────────────────────────────────────────

    async def scrape(self, url: str, only_main_content: bool = True) -> dict:
        """
        Scrape a URL and return clean Markdown + metadata.

        Returns:
            {"url", "title", "markdown", "metadata", "word_count"}
        """
        self._ensure_init()
        crawler = self._get_crawler()
        return await crawler.scrape_url(url, only_main_content)

    async def crawl(self, url: str, max_pages: int = 10) -> List[dict]:
        """Crawl a website following internal links. Returns list of scraped pages."""
        self._ensure_init()
        crawler = self._get_crawler()
        return await crawler.crawl_site(url, max_pages)

    async def extract(self, url: str, schema: Optional[dict] = None) -> dict:
        """Extract structured data from a URL using optional LLM parsing."""
        self._ensure_init()
        crawler = self._get_crawler()
        return await crawler.extract_structured_data(url, schema, self._engine)

    # ── Second Brain / Session Memory ─────────────────────────

    async def handover(
        self,
        summary: str,
        decisions: Optional[List[str]] = None,
        next_steps: Optional[List[str]] = None,
        open_questions: Optional[List[str]] = None,
        context_files: Optional[List[str]] = None
    ) -> dict:
        """
        Save a session handover — snapshot of the current work context.

        Use at the end of a work session to preserve context for later resumption.
        """
        self._ensure_init()
        brain = self._get_brain()
        return await brain.create_handover(summary, decisions, next_steps,
                                            open_questions, context_files)

    async def resume(self, handover_id: Optional[str] = None) -> Optional[dict]:
        """
        Resume from the latest (or specific) handover session.

        Returns the handover context with summary, decisions, next_steps, etc.
        """
        self._ensure_init()
        brain = self._get_brain()
        return await brain.load_handover(handover_id)

    async def vault_index(self, vault_path: Optional[str] = None) -> dict:
        """Index all Markdown files in a vault directory."""
        self._ensure_init()
        brain = self._get_brain()
        return await brain.index_vault(vault_path)

    async def vault_search(self, query: str, limit: int = 20) -> List[dict]:
        """Search the knowledge vault."""
        self._ensure_init()
        from myca.automation.brain import VaultDB
        VaultDB.init_tables()
        return VaultDB.search_notes(query, limit)

    async def vault_autolink(self) -> dict:
        """Auto-link related notes in the vault."""
        self._ensure_init()
        brain = self._get_brain()
        return await brain.auto_link_notes()

    async def ingest(self, url: str) -> dict:
        """Scrape a URL and ingest it into the knowledge vault as a note."""
        self._ensure_init()
        crawler = self._get_crawler()
        scrape_result = await crawler.scrape_url(url)
        brain = self._get_brain()
        return await brain.ingest_scrape(scrape_result)

    # ── Software Factory ──────────────────────────────────────

    async def factory_spec(self, prompt: str, repo_path: Optional[str] = None) -> dict:
        """Create a structured spec with acceptance criteria from a description."""
        self._ensure_init()
        factory = self._get_factory()
        return await factory.spec_interview(prompt, repo_path)

    async def factory_build(self, spec_id: str) -> dict:
        """Build an AGENT_READY spec on an isolated branch."""
        self._ensure_init()
        factory = self._get_factory()
        return await factory.build_spec(spec_id)

    async def factory_review(self, spec_id: str) -> dict:
        """Review built changes against spec acceptance criteria."""
        self._ensure_init()
        factory = self._get_factory()
        return await factory.review_build(spec_id)

    async def factory_loop(self, repo_path: Optional[str] = None) -> dict:
        """Run one full autonomous factory cycle (spec→build→review)."""
        self._ensure_init()
        factory = self._get_factory()
        return await factory.run_loop(repo_path)

    # ── Utilities ──────────────────────────────────────────────

    @property
    def engine(self):
        """Access the raw inference engine for advanced use cases."""
        self._ensure_init()
        return self._engine

    def _build_prompt(self, user_prompt: str, system_prompt: Optional[str] = None) -> str:
        """Build a formatted prompt with optional system instructions."""
        if system_prompt:
            return f"<|system|>\n{system_prompt}\n<|user|>\n{user_prompt}\n<|assistant|>\n"
        return user_prompt

    def _get_crawler(self):
        if self._crawler is None:
            from myca.automation.crawler import LocalWebCrawler
            self._crawler = LocalWebCrawler()
        return self._crawler

    def _get_brain(self):
        if self._brain is None:
            from myca.automation.brain import SecondBrainVault
            self._brain = SecondBrainVault(inference_engine=self._engine)
        return self._brain

    def _get_factory(self):
        if self._factory is None:
            from myca.automation.factory import SoftwareFactoryEngine
            self._factory = SoftwareFactoryEngine(inference_engine=self._engine)
        return self._factory


# ── Remote Engine (HTTP Client to Myca Node) ──────────────────

class _RemoteEngine:
    """
    HTTP client that connects to a running Myca node's API.
    Implements the same interface as InferenceEngine but over HTTP.
    """

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or "http://localhost:8420").rstrip("/")

    async def generate(self, prompt: str, system_prompt: Optional[str] = None, **kwargs) -> str:
        import httpx
        payload = {"prompt": prompt, "stream": False}
        if system_prompt:
            payload["system_prompt"] = system_prompt

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(f"{self.base_url}/query", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", data.get("content", ""))

    async def stream(self, prompt: str, system_prompt: Optional[str] = None, **kwargs) -> AsyncGenerator[str, None]:
        import httpx
        payload = {"prompt": prompt, "stream": True}
        if system_prompt:
            payload["system_prompt"] = system_prompt

        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream("POST", f"{self.base_url}/query", json=payload) as resp:
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            parsed = json.loads(data)
                            token = parsed.get("token", parsed.get("content", ""))
                            if token:
                                yield token
                        except json.JSONDecodeError:
                            yield data

    async def chat(self, messages: List[Dict[str, str]], **kwargs) -> str:
        import httpx
        payload = {
            "model": "myca",
            "messages": messages,
            "stream": False,
            **kwargs
        }
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(f"{self.base_url}/v1/chat/completions", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("choices", [{}])[0].get("message", {}).get("content", "")

    async def embed(self, text: str) -> List[float]:
        import httpx
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{self.base_url}/v1/embeddings",
                                      json={"input": text, "model": "myca"})
            resp.raise_for_status()
            data = resp.json()
            return data.get("data", [{}])[0].get("embedding", [])

    async def rerank(self, query: str, documents: List[str]) -> List[float]:
        return [0.5] * len(documents)  # Placeholder for remote rerank

    async def classify(self, text: str, labels: List[str]) -> Dict[str, float]:
        return {l: 1.0 / len(labels) for l in labels}  # Placeholder


# ── Convenience Functions (Sync Wrappers) ─────────────────────

def generate(prompt: str, backend: str = "auto", **kwargs) -> str:
    """
    One-shot synchronous text generation.

    Usage:
        from myca.sdk import generate
        result = generate("What is Python?")
    """
    async def _run():
        async with Myca(backend=backend, **kwargs) as ai:
            return await ai.generate(prompt)
    return asyncio.run(_run())


def scrape(url: str, **kwargs) -> dict:
    """
    One-shot synchronous URL scraping.

    Usage:
        from myca.sdk import scrape
        page = scrape("https://example.com")
        print(page["markdown"])
    """
    async def _run():
        async with Myca(backend="mock", **kwargs) as ai:
            return await ai.scrape(url)
    return asyncio.run(_run())
