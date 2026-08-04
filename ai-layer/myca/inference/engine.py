"""
Myca Inference Engine Interface
Defines the universal Rust-compatible API for all underlying hardware backends.
"""
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, List, Any

# Define the Capabilities required by the OS
CAPABILITIES = {
    "chat": {"name": "Llama-3.1-8B-Q4", "repo": "unsloth/Meta-Llama-3.1-8B-Instruct-GGUF", "type": "gguf"},
    "coding": {"name": "Qwen2.5-Coder-1.5B", "repo": "Qwen/Qwen2.5-Coder-1.5B-GGUF", "type": "gguf"},
    "embedding": {"name": "bge-micro", "repo": "BAAI/bge-micro", "type": "onnx"},
    "reranker": {"name": "bge-reranker", "repo": "BAAI/bge-reranker-base", "type": "onnx"}
}

class InferenceEngine(ABC):
    """
    Core OS execution engine interface.
    The Planner and Skills must ONLY interact with this abstraction.
    """
    
    @abstractmethod
    async def generate(self, prompt: str, **kwargs) -> str:
        """Generate a complete text response."""
        pass
        
    @abstractmethod
    async def stream(self, prompt: str, **kwargs) -> AsyncGenerator[str, None]:
        """Stream generated text response."""
        pass
        
    @abstractmethod
    async def embed(self, text: str) -> List[float]:
        """Generate vector embeddings for text."""
        pass
        
    @abstractmethod
    async def rerank(self, query: str, documents: List[str]) -> List[float]:
        """Rerank documents based on a query."""
        pass
        
    @abstractmethod
    async def classify(self, text: str, labels: List[str]) -> Dict[str, float]:
        """Classify text against a set of labels."""
        pass
        
    @abstractmethod
    async def tokenize(self, text: str) -> List[int]:
        """Convert text to tokens."""
        pass
        
    @abstractmethod
    async def detokenize(self, tokens: List[int]) -> str:
        """Convert tokens to text."""
        pass
        
    @abstractmethod
    async def vision(self, image_path: str, prompt: str) -> str:
        """Process image with text prompt (Future/Phase 3)."""
        pass
        
    @abstractmethod
    async def transcribe(self, audio_path: str) -> str:
        """Transcribe audio to text (Future/Phase 3)."""
        pass
        
    @abstractmethod
    async def synthesize(self, text: str) -> bytes:
        """Synthesize text to audio (Future/Phase 3)."""
        pass
