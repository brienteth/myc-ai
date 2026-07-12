"""
Inference Manager
Orchestrates the 5-stage model lifecycle: Download -> Load -> Warmup -> Benchmark -> Ready
"""
import logging
import time
import asyncio
import os
from typing import Optional
from .engine import InferenceEngine

logger = logging.getLogger("myca.inference.manager")

class InferenceManager:
    def __init__(self, engine: InferenceEngine):
        self.engine = engine
        self.state = "Uninitialized"
        self.benchmark_tok_s = 0.0

    async def boot_capability(self, capability_key: str):
        """
        Executes the 5-stage lifecycle for a specific capability (e.g., 'chat', 'embedding').
        """
        logger.info(f"Booting capability: {capability_key}")
        loop = asyncio.get_running_loop()
        
        # 1. Download / Verify
        self.state = "Downloading"
        logger.info(f"[{self.state}] Verifying model files in ~/.myca/models...")
        # LlamaCppBackend handles checking on init, let's trigger it by checking attributes
        if hasattr(self.engine, "model_path"):
            model_path = getattr(self.engine, "model_path")
            if not model_path or not os.path.exists(model_path):
                raise FileNotFoundError(f"Model file not found for boot: {model_path}")
        await asyncio.sleep(0.1)
        
        # 2. Load
        self.state = "Loading"
        logger.info(f"[{self.state}] Loading model into RAM/VRAM...")
        if hasattr(self.engine, "load"):
            await loop.run_in_executor(None, self.engine.load)
        else:
            await asyncio.sleep(0.1)
        
        # 3. Warmup
        self.state = "Warmup"
        logger.info(f"[{self.state}] Compiling KV Cache with dummy prompt...")
        if hasattr(self.engine, "warmup"):
            await loop.run_in_executor(None, self.engine.warmup)
        else:
            try:
                await self.engine.generate("warmup")
            except NotImplementedError:
                pass
            
        # 4. Benchmark
        self.state = "Benchmark"
        logger.info(f"[{self.state}] Benchmarking device speed...")
        if hasattr(self.engine, "benchmark"):
            self.benchmark_tok_s = await loop.run_in_executor(None, self.engine.benchmark)
        else:
            start = time.time()
            try:
                async for _ in self.engine.stream("benchmark"):
                    pass
                elapsed = time.time() - start
                self.benchmark_tok_s = 50.0 / (elapsed if elapsed > 0 else 1)
            except NotImplementedError:
                self.benchmark_tok_s = 0.0
            
        logger.info(f"Benchmark Result: {self.benchmark_tok_s:.2f} tok/s")
        
        # 5. Ready
        self.state = "Ready"
        logger.info(f"[{self.state}] Inference Engine Ready.")
