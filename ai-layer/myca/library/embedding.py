"""
Myca Embedding Engine
Generates dense vector embeddings using local sentence-transformers models.
"""
import logging
import numpy as np
from typing import List, Optional

logger = logging.getLogger("myca.library.embedding")

class EmbeddingEngine:
    MODEL_NAME = "all-MiniLM-L6-v2"

    def __init__(self):
        self.model = None
        self._init_model()

    def _init_model(self):
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"[EMBEDDING] Loading sentence-transformer model: {self.MODEL_NAME}")
            self.model = SentenceTransformer(self.MODEL_NAME)
            logger.info("[EMBEDDING] Model loaded successfully.")
        except Exception as e:
            logger.warning(f"[EMBEDDING] Failed to load SentenceTransformer: {e}. Semantic search will be disabled.")

    async def embed_text(self, text: str) -> Optional[np.ndarray]:
        """Generate vector embedding for a single text string."""
        if not self.model or not text:
            return None
        try:
            # sentence-transformers is synchronous, run in executor if needed or direct if fast
            emb = self.model.encode(text, normalize_embeddings=True)
            return emb.astype(np.float32)
        except Exception as e:
            logger.error(f"[EMBEDDING] Error encoding text: {e}")
            return None

    async def embed_chunks(self, chunks: List[str]) -> List[np.ndarray]:
        """Generate vector embeddings for a list of text chunks."""
        if not self.model or not chunks:
            return []
        try:
            embs = self.model.encode(chunks, normalize_embeddings=True)
            return [emb.astype(np.float32) for emb in embs]
        except Exception as e:
            logger.error(f"[EMBEDDING] Error encoding chunks: {e}")
            return []

    @staticmethod
    def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        dot = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(dot / (norm_a * norm_b))
