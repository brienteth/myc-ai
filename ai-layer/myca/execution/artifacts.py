"""
Myca Artifact System

First-class typed data objects flowing between execution nodes.
Replaces raw text→text piping with typed Artifact containers.

Supported artifact types:
  text, json, pdf, image, audio, video, spreadsheet, html, archive, dom_snapshot, embedding

Every artifact has:
  - Unique ID
  - MIME type
  - Content hash (integrity)
  - Size
  - Optional preview
  - Lineage (which node produced it)
"""

import hashlib
import os
import time
import uuid
import logging
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field

logger = logging.getLogger("myca.execution.artifacts")


@dataclass
class ExecutionArtifact:
    """First-class artifact flowing through the Execution DAG."""
    id: str = field(default_factory=lambda: f"art-{uuid.uuid4().hex[:8]}")
    artifact_type: str = "text"          # text, json, pdf, image, audio, video, spreadsheet, ...
    mime: str = "text/plain"
    content: Optional[bytes] = None       # Raw bytes (for in-memory artifacts)
    path: Optional[str] = None            # Disk path (for file-backed artifacts)
    content_hash: str = ""
    size: int = 0
    preview: Optional[str] = None         # First 200 chars or thumbnail URL
    producer_node: Optional[str] = None   # Which DAG node created this
    workflow_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)

    def compute_hash(self) -> str:
        """Compute SHA-256 of artifact content."""
        if self.content:
            self.content_hash = hashlib.sha256(self.content).hexdigest()
        elif self.path and os.path.exists(self.path):
            h = hashlib.sha256()
            with open(self.path, "rb") as f:
                for chunk in iter(lambda: f.read(8192), b""):
                    h.update(chunk)
            self.content_hash = h.hexdigest()
        return self.content_hash

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.artifact_type,
            "mime": self.mime,
            "path": self.path,
            "hash": self.content_hash,
            "size": self.size,
            "preview": self.preview,
            "producer_node": self.producer_node,
            "workflow_id": self.workflow_id,
            "metadata": self.metadata,
            "created_at": self.created_at,
        }


# MIME lookup table
MIME_MAP = {
    "text": "text/plain",
    "json": "application/json",
    "pdf": "application/pdf",
    "image": "image/png",
    "audio": "audio/wav",
    "video": "video/mp4",
    "spreadsheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "html": "text/html",
    "archive": "application/zip",
    "dom_snapshot": "application/json",
    "embedding": "application/octet-stream",
}


class ArtifactStore:
    """
    In-process artifact registry.
    Tracks all artifacts produced during workflow execution.
    Supports lookup by ID, by node, and by workflow.
    """

    def __init__(self):
        self._artifacts: Dict[str, ExecutionArtifact] = {}

    def create(
        self,
        artifact_type: str,
        content: Optional[bytes] = None,
        path: Optional[str] = None,
        producer_node: Optional[str] = None,
        workflow_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        preview: Optional[str] = None,
    ) -> ExecutionArtifact:
        """Create and register a new artifact."""
        mime = MIME_MAP.get(artifact_type, "application/octet-stream")
        size = len(content) if content else (os.path.getsize(path) if path and os.path.exists(path) else 0)

        art = ExecutionArtifact(
            artifact_type=artifact_type,
            mime=mime,
            content=content,
            path=path,
            size=size,
            preview=preview or (content[:200].decode("utf-8", errors="replace") if content else None),
            producer_node=producer_node,
            workflow_id=workflow_id,
            metadata=metadata or {},
        )
        art.compute_hash()
        self._artifacts[art.id] = art
        logger.info(f"[ARTIFACT] Created {art.artifact_type} artifact {art.id} ({art.size} bytes) from node={producer_node}")
        return art

    def get(self, artifact_id: str) -> Optional[ExecutionArtifact]:
        return self._artifacts.get(artifact_id)

    def get_by_node(self, node_id: str) -> List[ExecutionArtifact]:
        return [a for a in self._artifacts.values() if a.producer_node == node_id]

    def get_by_workflow(self, workflow_id: str) -> List[ExecutionArtifact]:
        return [a for a in self._artifacts.values() if a.workflow_id == workflow_id]

    def list_all(self) -> List[dict]:
        return [a.to_dict() for a in self._artifacts.values()]

    def clear(self):
        self._artifacts.clear()
