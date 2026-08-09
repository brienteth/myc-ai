from abc import ABC, abstractmethod
from typing import AsyncGenerator, List, Any

class InferenceProvider(ABC):
    """Abstract Interface for Inference Providers (Local, Mesh, Cloud)."""

    @abstractmethod
    async def generate(self, prompt: str, system_prompt: str = None, **kwargs) -> str:
        """Generate response text for a given prompt."""
        pass

    @abstractmethod
    async def stream(self, prompt: str, system_prompt: str = None, **kwargs) -> AsyncGenerator[str, None]:
        """Stream response tokens for a given prompt."""
        pass

    @abstractmethod
    async def embed(self, text: str) -> List[float]:
        """Generate text embeddings."""
        pass
