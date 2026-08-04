"""
Myca Need Protocol — The core abstraction of Myca.

A Need is what the user actually wants.
Not a request to a server. A requirement from the network.
The network finds who can satisfy it.
The user never specifies where.

Philosophy:
- Never move data if compute can move
- Never compute if memory already knows
- Never discover if experience predicts
- Never centralize if locality satisfies
"""

import os
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum


class PrivacyLevel(Enum):
    LOCAL_ONLY = "local_only"          # never leave this device
    LOCAL_NETWORK = "local_network"    # same Wi-Fi only
    TRUSTED_NODES = "trusted_nodes"    # H3 registry nodes only
    ANY = "any"                        # cloud ok as last resort


class QualityLevel(Enum):
    DRAFT = "draft"       # fastest, lowest quality
    NORMAL = "normal"     # balanced
    HIGH = "high"         # best available model
    EXACT = "exact"       # specific model required


@dataclass
class Need:
    """
    A Need is what the user actually wants.
    Not a request to a server. A requirement from the network.
    
    The network finds who can satisfy it.
    The user never specifies where.
    """

    # What
    action: str                        # summarize, translate, code, chat, ocr
    prompt: str                        # the actual content

    # Constraints
    privacy: PrivacyLevel = PrivacyLevel.LOCAL_NETWORK
    quality: QualityLevel = QualityLevel.NORMAL
    max_latency_ms: int = 5000         # deadline
    max_energy: str = "normal"         # minimum, normal, high

    # Context
    conv_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    need_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: float = field(default_factory=time.time)
    stream: bool = True

    # Data reference (NOT the data itself)
    data_refs: list = field(default_factory=list)
    # e.g. ["library://doc_id_123"] — data stays local,
    # compute comes to it

    def to_dict(self) -> dict:
        return {
            "need_id": self.need_id,
            "action": self.action,
            "prompt": self.prompt,
            "privacy": self.privacy.value,
            "quality": self.quality.value,
            "max_latency_ms": self.max_latency_ms,
            "conv_id": self.conv_id,
            "stream": self.stream,
            "data_refs": self.data_refs,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "Need":
        return cls(
            action=d.get("action", "chat"),
            prompt=d.get("prompt", ""),
            privacy=PrivacyLevel(d.get("privacy", "local_network")),
            quality=QualityLevel(d.get("quality", "normal")),
            max_latency_ms=d.get("max_latency_ms", 5000),
            conv_id=d.get("conv_id", str(uuid.uuid4())),
            need_id=d.get("need_id", str(uuid.uuid4())),
            stream=d.get("stream", True),
            data_refs=d.get("data_refs", []),
        )

    @classmethod
    def from_simple_prompt(cls, prompt: str, conv_id: str = None) -> "Need":
        """
        Backward compatibility: convert old-style prompt string
        to a Need. Infer action from prompt content.
        """
        action = "chat"
        lower = prompt.lower()
        if any(w in lower for w in ["çevir", "translate", "translation"]):
            action = "translate"
        elif any(w in lower for w in ["özetle", "summarize", "summary", "özet"]):
            action = "summarize"
        elif any(w in lower for w in ["kod", "code", "yaz", "write", "python", "javascript"]):
            action = "code"

        return cls(
            action=action,
            prompt=prompt,
            conv_id=conv_id or str(uuid.uuid4()),
        )


@dataclass
class ExecutionCost:
    energy: float       # Relative energy cost (e.g. 1 for cache, 20 for local GPU)
    latency: float      # Expected latency in ms
    privacy: float      # Risk score (0 = local, higher = network/cloud)
    compute: float      # Compute intensity score
    trust: float        # Trust penalty (0 = self, higher = unknown peer)
    availability: float # 0 = immediately available, higher = queue wait time

    @property
    def total(self) -> float:
        return self.energy + self.latency + self.privacy + self.compute + self.trust + self.availability


@dataclass
class Experience:
    """
    Stores successful execution paths, costs, and results.
    Replaces naive cache strings.
    """
    need_id: str
    context: str
    execution_path: str
    cost: ExecutionCost
    latency_ms: float
    result: str
    confidence: float
    timestamp: float = field(default_factory=time.time)


@dataclass
class KnowledgeObject:
    """
    Semantic memory representation.
    """
    id: str
    embedding: list[float]
    concepts: list[str]
    source: str
    freshness: float
    confidence: float
    dependencies: list[str]
    last_verified: float = field(default_factory=time.time)


@dataclass
class Capability:
    """
    What a Cell broadcasts to the Colony.
    Not an IP address. A list of what it can do.
    """
    cell_id: str
    can_do: list                       # actions this cell handles
    model: str                         # which model is loaded
    load_pct: int                      # 0-100
    tokens_per_second: float
    privacy_level: PrivacyLevel        # what data can come here
    model_loaded: bool
    source: str                        # mdns_local or h3_global
    last_seen: float = field(default_factory=time.time)
    
    # Scoring logic moved to DecisionEngine/Policies
