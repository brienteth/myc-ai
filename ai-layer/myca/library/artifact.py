"""
First-Class Artifact Subsystem
Represents OS-level execution outputs with cryptographic integrity, metadata, MIME types, and previews.
"""
import uuid
import time
import hashlib
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

class Artifact(BaseModel):
    id: str = Field(default_factory=lambda: f"art-{uuid.uuid4().hex[:12]}")
    filename: str
    mime_type: str = "application/octet-stream"
    content_hash: str
    size: int
    created_at: float = Field(default_factory=time.time)
    owner: str = "local"
    permissions: list[str] = Field(default_factory=list)
    storage_path: Optional[str] = None
    preview: Optional[str] = None
    bytes_data: Optional[bytes] = None

    def get_text(self) -> str:
        if self.bytes_data:
            try:
                return self.bytes_data.decode("utf-8", errors="ignore")
            except Exception:
                return str(self.bytes_data)
        return ""

class ArtifactManager:
    _artifacts: Dict[str, Artifact] = {}

    @classmethod
    def create_artifact(cls, content: bytes, filename: str, mime_type: str = "application/octet-stream", owner: str = "local", permissions: list[str] = None) -> Artifact:
        content_hash = hashlib.sha256(content).hexdigest()
        preview = content[:200].decode("utf-8", errors="ignore") if content else ""
        
        art = Artifact(
            filename=filename,
            mime_type=mime_type,
            content_hash=content_hash,
            size=len(content),
            created_at=time.time(),
            owner=owner,
            permissions=permissions or ["read"],
            preview=preview,
            bytes_data=content
        )
        cls._artifacts[art.id] = art
        return art

    @classmethod
    def get_artifact(cls, artifact_id: str) -> Optional[Artifact]:
        return cls._artifacts.get(artifact_id)

    @classmethod
    def verify_hash(cls, artifact_id: str) -> bool:
        art = cls._artifacts.get(artifact_id)
        if not art or not art.bytes_data:
            return False
        current_hash = hashlib.sha256(art.bytes_data).hexdigest()
        return current_hash == art.content_hash

    @classmethod
    def list_artifacts(cls) -> list[Artifact]:
        return list(cls._artifacts.values())
