"""
Universal Extractor Pipeline
Routes incoming files to the appropriate specialized extractor.
"""
from pathlib import Path
from typing import Dict, Any

from .document import DocumentExtractor
from .image import ImageExtractor
from .audio import AudioExtractor
from .video import VideoExtractor
from .code import CodeExtractor

class UniversalExtractor:
    # Extension groupings
    DOCS = {".pdf", ".docx", ".txt", ".md", ".html", ".htm", ".rtf", ".odt", ".epub"}
    IMAGES = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".tiff", ".heic"}
    AUDIO = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac"}
    VIDEO = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
    CODE = {
        ".py", ".rs", ".go", ".js", ".jsx", ".ts", ".tsx",
        ".cpp", ".h", ".hpp", ".c", ".cs", ".java", ".swift",
        ".kt", ".sh", ".json", ".yaml", ".yml", ".toml", ".css"
    }

    @staticmethod
    def extract_all(file_path: Path, file_type: str = "all") -> Dict[str, Any]:
        """
        Main routing function for file extraction.
        Returns a dict: { "content": str, "metadata": dict, "thumbnail": bytes | None, "type": str }
        """
        suffix = file_path.suffix.lower()
        
        # Determine specific extractor
        if suffix in UniversalExtractor.DOCS or file_type == "document":
            res = DocumentExtractor.extract(file_path)
            res["type"] = "document"
        elif suffix in UniversalExtractor.IMAGES or file_type == "image":
            res = ImageExtractor.extract(file_path)
            res["type"] = "image"
        elif suffix in UniversalExtractor.AUDIO or file_type == "audio":
            res = AudioExtractor.extract(file_path)
            res["type"] = "audio"
        elif suffix in UniversalExtractor.VIDEO or file_type == "video":
            res = VideoExtractor.extract(file_path)
            res["type"] = "video"
        elif suffix in UniversalExtractor.CODE or file_type == "code":
            res = CodeExtractor.extract(file_path)
            res["type"] = "code"
        else:
            # Catchall document/text fallback
            res = DocumentExtractor.extract(file_path)
            res["type"] = "document"

        # Ensure standard keys are present
        if "thumbnail" not in res:
            res["thumbnail"] = None

        return res
