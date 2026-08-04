"""
Myca Configuration and Path Management
"""
import os
import logging
from pathlib import Path

logger = logging.getLogger("myca.core.config")

class MycaConfig:
    """Manages the ~/.myca directory structure."""
    
    @classmethod
    def get_home_dir(cls) -> Path:
        home = Path.home() / ".myca"
        cls._ensure_dirs(home)
        return home
        
    @classmethod
    def get_models_dir(cls) -> Path:
        return cls.get_home_dir() / "models"
        
    @classmethod
    def get_cache_dir(cls) -> Path:
        return cls.get_home_dir() / "cache"
        
    @classmethod
    def get_experience_dir(cls) -> Path:
        return cls.get_home_dir() / "experience"
        
    @classmethod
    def get_runtime_dir(cls) -> Path:
        return cls.get_home_dir() / "runtime"
        
    @classmethod
    def get_logs_dir(cls) -> Path:
        return cls.get_home_dir() / "logs"

    @classmethod
    def _ensure_dirs(cls, base_path: Path):
        dirs = [
            base_path,
            base_path / "models",
            base_path / "cache",
            base_path / "experience",
            base_path / "runtime",
            base_path / "skills",
            base_path / "logs"
        ]
        for d in dirs:
            d.mkdir(parents=True, exist_ok=True)

# Initialize directories on import
MycaConfig.get_home_dir()
