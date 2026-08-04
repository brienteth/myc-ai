"""
Myca Layer 5: Inference — Multi-Backend LLM Integration

Abstract InferenceBackend with concrete implementations:
- OllamaBackend: calls http://localhost:11434 for real LLM inference
- MockBackend: returns fake tokens for testing when no LLM available
- LlamaCppBackend: stub — raises NotImplementedError with install instructions

Backend selection via MYCA_BACKEND env var or auto-detection.
Streams tokens as async generators for real-time WebSocket delivery.
"""

import asyncio
import json
import logging
import os
import time
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Optional, Callable, Awaitable

import httpx

logger = logging.getLogger("myca.inference")

# Protocol event types
INFERENCE_START = "INFERENCE_START"
INFERENCE_TOKEN = "INFERENCE_TOKEN"
INFERENCE_COMPLETE = "INFERENCE_COMPLETE"
INFERENCE_ERROR = "INFERENCE_ERROR"
INFERENCE_BACKEND = "INFERENCE_BACKEND"

OLLAMA_BASE_URL = "http://localhost:11434"


class InferenceBackend(ABC):
    """
    Abstract base class for LLM inference backends.
    
    To add a new backend:
    1. Subclass InferenceBackend
    2. Implement generate() as an async generator yielding token strings
    3. Implement check_available() to verify the backend is ready
    4. Register in BACKENDS dict below
    """

    name: str = "abstract"

    @abstractmethod
    async def check_available(self) -> tuple[bool, str]:
        """Check if this backend is available. Returns (available, message)."""
        ...

    @abstractmethod
    async def generate(self, prompt: str, model: str = None) -> AsyncGenerator[str, None]:
        """Generate tokens from a prompt. Yields token strings."""
        ...

    @abstractmethod
    async def list_models(self) -> list[str]:
        """List available models for this backend."""
        ...


class SpeculativeDecoder:
    def __init__(self, draft_model="phi3:mini", 
                       verify_model="qwen2.5-coder:7b",
                       draft_tokens=5):
        self.draft = draft_model
        self.verify = verify_model  
        self.N = draft_tokens  # tokens per speculation round
    
    async def stream(self, prompt: str):
        context = prompt
        
        while True:
            # Step 1: Draft model generates N tokens fast
            draft_output = await self._ollama_complete(
                self.draft, context, max_tokens=self.N
            )
            draft_tokens = draft_output.split()[:self.N]
            if not draft_tokens:
                break
            
            # Step 2: Verify model checks all N tokens in parallel
            verify_input = context + " " + " ".join(draft_tokens)
            verify_output = await self._ollama_complete(
                self.verify, verify_input, max_tokens=1
            )
            
            # Step 3: Find acceptance point
            accepted = []
            for i, token in enumerate(draft_tokens):
                # Simple acceptance: draft token matches verify direction
                accepted.append(token)
                # In real impl: compare logprobs
                # For MVP: accept all, verify just steers
            
            # Step 4: Yield accepted tokens
            for token in accepted:
                yield token + " "
            
            # Step 5: Update context
            context += " " + " ".join(accepted)
            
            # Check if done
            if any(t in [".", "!", "?"] for t in accepted[-1:]):
                break
    
    async def _ollama_complete(self, model, prompt, max_tokens):
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"num_predict": max_tokens}
                },
                timeout=10.0
            )
            return resp.json().get("response", "")

class OllamaBackend(InferenceBackend):
    """
    Ollama backend — calls http://localhost:11434/api/generate with streaming.
    Requires Ollama to be installed and running locally.
    """

    name = "ollama"

    def __init__(self, base_url: str = OLLAMA_BASE_URL):
        self.base_url = base_url
        self._available_models: list[str] = []

    async def check_available(self) -> tuple[bool, str]:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                if resp.status_code == 200:
                    data = resp.json()
                    self._available_models = [m["name"] for m in data.get("models", [])]
                    if self._available_models:
                        return True, f"Ollama running, models: {', '.join(self._available_models)}"
                    return True, "Ollama running but no models installed. Run: ollama pull llama3.2"
                return False, f"Ollama returned status {resp.status_code}"
        except Exception as e:
            return False, f"Ollama not reachable: {e}"

    async def list_models(self) -> list[str]:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                if resp.status_code == 200:
                    data = resp.json()
                    return [m["name"] for m in data.get("models", [])]
        except Exception:
            pass
        return self._available_models

    async def generate(self, prompt: str, model: str = None) -> AsyncGenerator[str, None]:
        model_env = os.getenv("MYCA_MODEL", "")
        if model_env:
            model = model_env
        elif not model:
            models = await self.list_models()
            for preferred in ["qwen2.5-coder:7b", "llama3.1:8b", "llama3.1:latest", "phi3:latest"]:
                if preferred in models:
                    model = preferred
                    break
            if not model and models:
                model = models[0]
            if not model:
                model = "qwen2.5-coder:7b"  # fallback

        system_prompt = """Sen Myca'sın — kullanıcının cihazında 
çalışan lokal AI asistan.

Kurallar:
- Kullanıcı hangi dilde yazarsa o dilde cevap ver
- Kod isterse direkt yaz, soru sorma
- "Yapamam" deme, dene
- Kısa ve net ol
- Asla Türkçe-İngilizce karıştırma

Kod görevlerinde:
- Direkt çalışan kod yaz
- Açıklama minimumda tut
- Önce kod, sonra kısa not"""

        payload = {
            "model": model,
            "prompt": prompt,
            "system": system_prompt,
            "stream": True,
            "options": {
                "num_ctx": 4096,
                "temperature": 0.7,
                "top_p": 0.9,
                "repeat_penalty": 1.1,
                "num_predict": 512
            }
        }

        if os.environ.get("MYCA_SPECULATIVE", "").lower() == "true":
            draft_model = os.environ.get("MYCA_DRAFT_MODEL", "phi3:mini")
            verify_model = os.environ.get("MYCA_VERIFY_MODEL", model)
            # Combine for speculative since it doesn't use Ollama's system prompt processing natively if it hits phi3 directly
            spec_prompt = f"{system_prompt}\n\nUser: {prompt}\n\nMyca:"
            async for token in decoder.stream(spec_prompt):
                yield token
            return

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/generate",
                json=payload,
            ) as resp:
                async for line in resp.aiter_lines():
                    if line.strip():
                        try:
                            data = json.loads(line)
                            token = data.get("response", "")
                            if token:
                                yield token
                            if data.get("done", False):
                                break
                        except json.JSONDecodeError:
                            continue


class MockBackend(InferenceBackend):
    """
    Mock backend for testing — returns fake tokens without any LLM.
    Simulates realistic token-by-token generation with variable delays.
    """

    name = "mock"

    MOCK_RESPONSES = [
        "I'm Myca, a distributed AI inference system running across your local network. "
        "Right now I'm operating in simulation mode with 3 virtual nodes: "
        "myca-alpha handles context encoding (layers 0-16), "
        "myca-beta handles generation (layers 17-32), "
        "and myca-gamma provides storage. "
        "All nodes discovered each other via mDNS, connected via HTTP/2, "
        "and are communicating through AES-256-GCM encrypted channels "
        "with X25519 key exchange. "
        "The dormant technologies powering this conversation: "
        "mDNS (1999), WebRTC DataChannel (2011), HTTP 103 Early Hints (2017). "
        "All existed. None were used this way. Until now.",

        "This response is being generated by Myca's distributed inference pipeline. "
        "Here's what happened when you sent your prompt: "
        "1) The orchestrator sent HTTP 103 Early Hints to pre-warm all nodes. "
        "2) Model shards were loaded in parallel across inference nodes. "
        "3) Your prompt was encoded by myca-alpha (layers 0-16). "
        "4) Tokens are being generated by myca-beta (layers 17-32). "
        "5) Each token is encrypted with AES-256-GCM before transmission. "
        "6) Keys rotate every 60 seconds via X25519 ECDH exchange. "
        "The total pipeline latency is under 25ms between nodes.",

        "Myca demonstrates that the infrastructure for decentralized AI "
        "has been hiding in plain sight. mDNS discovers neighbors without "
        "any central server. WebRTC punches through NATs. HTTP 103 coordinates "
        "pipeline stages before results are ready. X25519 provides quantum-safe-ready "
        "encryption. None of these required invention — only assembly. "
        "Like mycorrhizal networks in a forest, the connections were always there. "
        "We just needed to look underground.",
    ]

    def __init__(self):
        self._response_index = 0

    async def check_available(self) -> tuple[bool, str]:
        return True, "Mock backend always available (no LLM required)"

    async def list_models(self) -> list[str]:
        return ["mock-v1"]

    async def generate(self, prompt: str, model: str = None) -> AsyncGenerator[str, None]:
        response = self.MOCK_RESPONSES[self._response_index % len(self.MOCK_RESPONSES)]
        self._response_index += 1

        words = response.split(" ")
        for i, word in enumerate(words):
            token = word if i == 0 else " " + word
            await asyncio.sleep(0.03 + 0.02 * (hash(word) % 3) / 3)  # 30-50ms per token
            yield token


class LlamaCppBackend(InferenceBackend):
    """
    llama.cpp backend — the lightest option, runs on Raspberry Pi.
    
    STUB: Not implemented in MVP. Raises NotImplementedError with
    installation instructions. The interface demonstrates how to
    add new backends to the InferenceBackend abstract class.
    """

    name = "llamacpp"

    async def check_available(self) -> tuple[bool, str]:
        return False, (
            "LlamaCppBackend not yet implemented. To use llama.cpp:\n"
            "  1. pip install llama-cpp-python\n"
            "  2. Download a GGUF model file\n"
            "  3. Set MYCA_BACKEND=llamacpp\n"
            "  4. Set MYCA_LLAMACPP_MODEL=/path/to/model.gguf"
        )

    async def list_models(self) -> list[str]:
        raise NotImplementedError(
            "LlamaCppBackend not implemented. Install llama-cpp-python and provide a GGUF model."
        )

    async def generate(self, prompt: str, model: str = None) -> AsyncGenerator[str, None]:
        raise NotImplementedError(
            "LlamaCppBackend not implemented. Install llama-cpp-python and provide a GGUF model."
        )
        yield  # Make it a generator


# Backend registry
BACKENDS: dict[str, type[InferenceBackend]] = {
    "ollama": OllamaBackend,
    "mock": MockBackend,
    "llamacpp": LlamaCppBackend,
}


async def auto_detect_backend(
    event_callback: Optional[Callable[[str, dict], Awaitable[None]]] = None,
) -> InferenceBackend:
    """
    Auto-detect the best available backend.
    
    Priority:
    1. MYCA_BACKEND env var (explicit choice)
    2. Ollama (if running and has models)
    3. Mock (always available fallback)
    """
    async def emit(event_type: str, data: dict):
        if event_callback:
            event = {"type": event_type, "timestamp": time.time(), "layer": "inference", **data}
            await event_callback(event_type, event)
        logger.info(f"[INFERENCE] {event_type}: {data}")

    env_backend = os.environ.get("MYCA_BACKEND", "").lower()

    if env_backend:
        if env_backend in BACKENDS:
            backend = BACKENDS[env_backend]()
            available, msg = await backend.check_available()
            if available:
                await emit(INFERENCE_BACKEND, {
                    "backend": backend.name,
                    "source": "MYCA_BACKEND env var",
                    "message": msg,
                })
                return backend
            else:
                logger.warning(f"Requested backend '{env_backend}' not available: {msg}")
                await emit(INFERENCE_BACKEND, {
                    "backend": env_backend,
                    "source": "MYCA_BACKEND env var",
                    "status": "unavailable",
                    "message": msg,
                    "fallback": "auto-detect",
                })
        else:
            logger.warning(f"Unknown backend '{env_backend}'. Available: {list(BACKENDS.keys())}")

    # Auto-detect: try Ollama first
    ollama = OllamaBackend()
    available, msg = await ollama.check_available()
    if available:
        await emit(INFERENCE_BACKEND, {
            "backend": "ollama",
            "source": "auto-detect",
            "message": msg,
        })
        return ollama

    # Fallback to mock
    mock = MockBackend()
    await emit(INFERENCE_BACKEND, {
        "backend": "mock",
        "source": "auto-detect (Ollama not available)",
        "message": "Using mock backend — no real LLM inference. Install Ollama for real inference.",
    })
    return mock
