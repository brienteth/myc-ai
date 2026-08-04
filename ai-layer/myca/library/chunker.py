"""
Myca Chunker
Splits document text into overlapping chunks for vector embedding.
"""
from typing import List, Tuple

class TextChunker:
    @staticmethod
    def chunk_text(text: str, chunk_words: int = 400, overlap_words: int = 50) -> List[Tuple[str, int, int]]:
        """
        Splits text into chunks by word count with specified overlap.
        Returns a list of tuples: (chunk_text, start_offset, end_offset)
        """
        if not text:
            return []

        words = text.split()
        if not words:
            return []

        chunks = []
        step = chunk_words - overlap_words
        if step <= 0:
            step = chunk_words

        # Reconstruct indices and slices
        for i in range(0, len(words), step):
            chunk_slice = words[i:i + chunk_words]
            chunk_str = " ".join(chunk_slice)
            
            # Find character offsets in the original text (heuristic/best-effort)
            # To be fast and simple, we do a find or just approximate.
            # Let's search from the last found position or start from 0.
            start_offset = text.find(chunk_str[:30]) if len(chunk_str) > 30 else 0
            if start_offset == -1:
                start_offset = 0
            end_offset = start_offset + len(chunk_str)
            
            chunks.append((chunk_str, start_offset, end_offset))
            if i + chunk_words >= len(words):
                break

        return chunks
