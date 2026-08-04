from abc import ABC, abstractmethod
from typing import AsyncGenerator

class InferenceProvider(ABC):
    """
    Abstract interface for model inference.
    Implementations could be Ollama, vLLM, MLX, etc.
    """
    @abstractmethod
    async def generate(self, prompt: str) -> str:
        """Generate a complete string response."""
        pass

    @abstractmethod
    async def stream(self, prompt: str) -> AsyncGenerator[str, None]:
        """Stream the response as a generator of tokens."""
        pass
        
    @abstractmethod
    async def get_available_models(self) -> list[str]:
        """Return a list of available models."""
        pass
