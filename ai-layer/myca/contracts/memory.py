from abc import ABC, abstractmethod
from typing import List, Dict, Any

class MemoryStore(ABC):
    """Abstract Interface for Memory/Experience Storage (VaultDB, Semantic Store)."""

    @abstractmethod
    def store_experience(self, experience: Dict[str, Any]) -> None:
        """Store a structured user behavior or session experience."""
        pass

    @abstractmethod
    def retrieve_context(self, prompt: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Retrieve relevant context for a given prompt."""
        pass
