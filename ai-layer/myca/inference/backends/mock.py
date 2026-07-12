"""
Mock Backend
Simulates the Unified Inference API without loading heavy models.
"""
import asyncio
from typing import AsyncGenerator, Dict, List
from ..engine import InferenceEngine
from ..registry import BackendRegistry

class MockBackend(InferenceEngine):
    async def generate(self, prompt: str, **kwargs) -> str:
        return f"Mock response for: {prompt[:20]}..."
        
    async def stream(self, prompt: str, **kwargs) -> AsyncGenerator[str, None]:
        words = ["Mock", "streaming", "response", "for", "testing", "capabilities."]
        for word in words:
            await asyncio.sleep(0.05)
            yield word + " "
            
    async def embed(self, text: str) -> List[float]:
        return [0.1, 0.2, 0.3, 0.4]
        
    async def rerank(self, query: str, documents: List[str]) -> List[float]:
        return [0.9] * len(documents)
        
    async def classify(self, text: str, labels: List[str]) -> Dict[str, float]:
        return {label: 1.0 / len(labels) for label in labels}
        
    async def tokenize(self, text: str) -> List[int]:
        return [1, 2, 3]
        
    async def detokenize(self, tokens: List[int]) -> str:
        return "mock detokenized text"
        
    async def vision(self, image_path: str, prompt: str) -> str:
        return "mock vision analysis"
        
    async def transcribe(self, audio_path: str) -> str:
        return "mock transcription"
        
    async def synthesize(self, text: str) -> bytes:
        return b"mock audio data"

BackendRegistry.register("mock", MockBackend)
