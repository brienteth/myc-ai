"""
Myca — Local-first P2P AI Engine & Autonomous Software Factory

Usage as SDK:
    from myca import Myca, generate, scrape

    # High-level async client
    async with Myca() as ai:
        res = await ai.generate("Hello world")
        page = await ai.scrape("https://example.com")

    # One-shot sync helpers
    text = generate("Explain quantum computing")
"""

__version__ = "0.1.0"
__codename__ = "Rhizome"

from myca.sdk import Myca, generate, scrape
from myca.inference.engine import InferenceEngine
from myca.inference.registry import BackendRegistry

__all__ = [
    "Myca",
    "generate",
    "scrape",
    "InferenceEngine",
    "BackendRegistry",
    "__version__",
    "__codename__",
]

