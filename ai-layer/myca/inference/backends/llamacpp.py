"""
Llama.cpp Backend
Real local inference using llama-cpp-python with Metal support.
No Ollama. Runs in-process.
"""
import asyncio
import logging
import os
import time
from pathlib import Path
from typing import AsyncGenerator, Dict, List

from ..engine import InferenceEngine
from ..registry import BackendRegistry

logger = logging.getLogger("myca.inference.backends.llamacpp")

class LlamaCppBackend(InferenceEngine):
    """
    Real local inference using llama-cpp-python.
    No Ollama. No external process. Runs in-process.
    """
    
    SYSTEM_PROMPT = """Sen Myca'sın — kullanıcının cihazında çalışan lokal AI asistan.
Kurallar:
- Kullanıcı hangi dilde yazarsa o dilde cevap ver
- Kod isterse direkt yaz, açıklama minimumda tut
- Asla Türkçe-İngilizce karıştırma
- Kısa ve net ol"""

    def __init__(
        self,
        model_path: str | None = None,
        n_ctx: int = 4096,
        n_threads: int | None = None,
        n_gpu_layers: int = -1,  # -1 means all layers to GPU if available
        verbose: bool = False,
    ):
        self.model_path = model_path or self._find_model()
        self.n_ctx = n_ctx
        self.n_threads = n_threads or os.cpu_count()
        self.n_gpu_layers = n_gpu_layers
        self.verbose = verbose
        self._llm = None
        self._lock = asyncio.Lock()
        
    def _find_model(self) -> str:
        """Auto-detect GGUF model in ~/.myca/models/"""
        models_dir = Path("~/.myca/models").expanduser()
        models_dir.mkdir(parents=True, exist_ok=True)
        
        gguf_files = sorted(
            models_dir.glob("*.gguf"),
            key=lambda f: f.stat().st_size,
            reverse=True
        )
        
        if not gguf_files:
            raise FileNotFoundError(
                f"No GGUF model found in {models_dir}\n"
                f"Please download a model to ~/.myca/models/"
            )
        
        chosen = gguf_files[0]
        logger.info(f"Model selected: {chosen.name} ({chosen.stat().st_size // 1024 // 1024}MB)")
        return str(chosen)

    def load(self):
        """Loads the model into RAM/VRAM."""
        from llama_cpp import Llama
        
        logger.info(f"Loading {Path(self.model_path).name}...")
        start = time.time()
        
        self._llm = Llama(
            model_path=self.model_path,
            n_ctx=self.n_ctx,
            n_threads=self.n_threads,
            n_gpu_layers=self.n_gpu_layers,
            verbose=self.verbose,
            chat_format="llama-3",
        )
        
        elapsed = time.time() - start
        logger.info(f"Model loaded in {elapsed:.1f}s")
        
    def warmup(self):
        """Warm up the KV Cache."""
        if not self._llm:
            raise RuntimeError("Model not loaded")
        logger.info("Warming up KV cache...")
        self._llm(
            "Hello",
            max_tokens=1,
            stream=False
        )
        logger.info("Warmup complete")
        
    def benchmark(self) -> float:
        """Run a simple benchmark to check hardware performance."""
        if not self._llm:
            return 0.0
        logger.info("Benchmarking device...")
        start = time.time()
        tokens = 0
        for chunk in self._llm(
            "Count from 1 to 20:",
            max_tokens=30,
            stream=True,
            temperature=0.0
        ):
            tokens += 1
        elapsed = time.time() - start
        tps = tokens / elapsed if elapsed > 0 else 0
        logger.info(f"Benchmark: {tps:.1f} tok/s")
        return round(tps, 1)

    def _build_messages(self, prompt: str) -> list[dict]:
        return [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]

    # InferenceEngine API implementations
    async def generate(self, prompt: str, **kwargs) -> str:
        if not self._llm:
            raise RuntimeError("Model not loaded. Call load() first.")
            
        async with self._lock:
            loop = asyncio.get_running_loop()
            max_tokens = kwargs.get("max_tokens", 512)
            system_prompt = kwargs.get("system_prompt", None)
            
            def _run():
                messages = self._build_messages(prompt)
                if system_prompt:
                    messages[0] = {"role": "system", "content": system_prompt}
                response = self._llm.create_chat_completion(
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=0.7,
                    top_p=0.9,
                    repeat_penalty=1.1,
                    stream=False
                )
                return response["choices"][0]["message"]["content"]
                
            return await loop.run_in_executor(None, _run)

    async def stream(self, prompt: str, **kwargs) -> AsyncGenerator[str, None]:
        if not self._llm:
            raise RuntimeError("Model not loaded. Call load() first.")
            
        loop = asyncio.get_running_loop()
        queue = asyncio.Queue()
        max_tokens = kwargs.get("max_tokens", 512)
        
        def _run_sync():
            try:
                for chunk in self._llm.create_chat_completion(
                    messages=self._build_messages(prompt),
                    max_tokens=max_tokens,
                    temperature=0.7,
                    top_p=0.9,
                    repeat_penalty=1.1,
                    stream=True,
                ):
                    delta = chunk["choices"][0].get("delta", {})
                    token = delta.get("content", "")
                    if token:
                        loop.call_soon_threadsafe(queue.put_nowait, token)
                loop.call_soon_threadsafe(queue.put_nowait, None)
            except Exception as e:
                loop.call_soon_threadsafe(queue.put_nowait, f"\n[Hata: {e}]")
                loop.call_soon_threadsafe(queue.put_nowait, None)
                
        async with self._lock:
            loop.run_in_executor(None, _run_sync)
            while True:
                token = await queue.get()
                if token is None:
                    break
                yield token

    async def embed(self, text: str) -> list[float]:
        if not self._llm:
            raise RuntimeError("Model not loaded")
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, lambda: self._llm.create_embedding(text))
        return result["data"][0]["embedding"]

    async def rerank(self, query: str, documents: list[str]) -> list[float]:
        raise NotImplementedError("Reranking not natively supported in llama.cpp stub")

    async def classify(self, text: str, labels: list[str]) -> dict:
        raise NotImplementedError("Classification not natively supported in llama.cpp stub")

    async def tokenize(self, text: str) -> list[int]:
        if not self._llm:
            raise RuntimeError("Model not loaded")
        return self._llm.tokenize(text.encode("utf-8"))

    async def detokenize(self, tokens: list[int]) -> str:
        if not self._llm:
            raise RuntimeError("Model not loaded")
        return self._llm.detokenize(tokens).decode("utf-8")

    async def vision(self, image_path: str, prompt: str) -> str:
        raise NotImplementedError("Vision not supported in basic llama.cpp stub")

    async def transcribe(self, audio_path: str) -> str:
        raise NotImplementedError("Speech transcription not supported in llama.cpp")

    async def synthesize(self, text: str) -> bytes:
        raise NotImplementedError("Speech synthesis not supported in llama.cpp")

    @property
    def is_loaded(self) -> bool:
        return self._llm is not None

    def unload(self):
        if self._llm:
            del self._llm
            self._llm = None
            import gc; gc.collect()
            logger.info("Model unloaded — RAM freed")

BackendRegistry.register("llamacpp", LlamaCppBackend)
