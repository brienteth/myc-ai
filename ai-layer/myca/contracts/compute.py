from abc import ABC, abstractmethod
from typing import List

class ComputeProvider(ABC):
    """Abstract Interface for Compute resource providers."""

    @abstractmethod
    def get_capabilities(self) -> List[str]:
        """Return list of supported model tags or logic capabilities."""
        pass

    @abstractmethod
    def get_load_pct(self) -> float:
        """Return current compute resource load percent."""
        pass
