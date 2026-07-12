from abc import ABC, abstractmethod
from typing import List, Dict, Any

class VectorProvider(ABC):
    """
    Abstract interface for vector database operations.
    Implementations could be ChromaDB, LanceDB, Faiss, SQLite, etc.
    """
    @abstractmethod
    async def embed(self, text: str) -> List[float]:
        pass
        
    @abstractmethod
    async def insert(self, collection_name: str, data: Dict[str, Any], vector: List[float]):
        pass
        
    @abstractmethod
    async def search(self, collection_name: str, query_vector: List[float], top_k: int) -> List[Dict[str, Any]]:
        pass

class ExperienceProvider(ABC):
    """
    Abstract interface for logging execution experiences (Evolution Engine).
    """
    @abstractmethod
    async def log_experience(self, intent_action: str, target_node: str, success: bool, latency: float, cost: float):
        pass
