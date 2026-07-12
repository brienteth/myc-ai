"""
Load backends to trigger registration.
"""
from .mock import MockBackend
from .llamacpp import LlamaCppBackend
from .mlx import MLXBackend

__all__ = ["MockBackend", "LlamaCppBackend", "MLXBackend"]
