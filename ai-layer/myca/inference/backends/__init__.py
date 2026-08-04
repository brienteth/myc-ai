"""
Load backends to trigger registration.
"""
from .mock import MockBackend
from .llamacpp import LlamaCppBackend
from .mlx import MLXBackend
from .ollama import OllamaBackend
from .zgcompute import ZeroGComputeBackend

__all__ = ["MockBackend", "LlamaCppBackend", "MLXBackend", "OllamaBackend", "ZeroGComputeBackend"]
