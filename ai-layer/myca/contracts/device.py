"""
Myca OS — Device Identity & Capability Contracts (P0.1)

Defines the canonical schemas for device identity, capability advertisement,
and authorization scopes used across the Colony mesh.

Key Invariants:
  - Pairing ≠ Authorization: TRUSTED only establishes identity, not full access.
  - Scheduling is capability-driven: "camera.capture" not "device_type == iphone".
  - Capability scopes restrict what a remote device is allowed to do.
"""

import enum
import logging
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any

logger = logging.getLogger("myca.contracts.device")


class TrustState(str, enum.Enum):
    DISCOVERED = "DISCOVERED"
    PAIRING_REQUESTED = "PAIRING_REQUESTED"
    TRUSTED = "TRUSTED"
    REVOKED = "REVOKED"


class CapabilityScope(str, enum.Enum):
    """Authorization scope for a specific capability on a device.
    Pairing ≠ Authorization: A TRUSTED device still needs explicit scope grants."""
    ALLOWED = "ALLOWED"
    PROMPT = "PROMPT"       # Ask user before granting
    DENIED = "DENIED"


# ── Standard Capability IDs ────────────────────────────────────────────────
# These are the canonical capability strings used system-wide.
# The scheduler matches tasks to devices using these exact strings.

CAPABILITY_CAMERA_CAPTURE = "camera.capture"
CAPABILITY_MICROPHONE_CAPTURE = "microphone.capture"
CAPABILITY_STORAGE_READ = "storage.read"
CAPABILITY_STORAGE_WRITE = "storage.write"
CAPABILITY_FILESYSTEM_READ = "filesystem.read"
CAPABILITY_FILESYSTEM_WRITE = "filesystem.write"
CAPABILITY_GPU_COMPUTE = "gpu.compute"
CAPABILITY_LOCAL_LLM = "local_llm.inference"
CAPABILITY_VISION = "vision.analyze"
CAPABILITY_NETWORK_OUT = "network.outbound"
CAPABILITY_BROWSER = "browser.navigate"
CAPABILITY_VAULT_READ = "vault.read"
CAPABILITY_VAULT_WRITE = "vault.write"
CAPABILITY_TELEGRAM_SEND = "telegram.send"
CAPABILITY_EMAIL_SEND = "email.send"


@dataclass
class DeviceCapability:
    """A single capability advertised by a device."""
    capability_id: str          # e.g. "camera.capture"
    available: bool = True      # Is the hardware/software present?
    scope: str = CapabilityScope.ALLOWED  # Authorization scope for remote access


@dataclass
class DeviceIdentity:
    """
    Complete identity and capability advertisement for a Myca device.
    
    Broadcast during discovery and stored in the device_capabilities table.
    The scheduler uses this to resolve "which TRUSTED node has camera.capture?"
    rather than "which device is an iPhone?"
    """
    device_id: str
    public_key: str = ""
    device_type: str = ""       # "mac", "iphone", "android", "linux", "windows"
    device_name: str = ""       # Human-readable name e.g. "Egemen's MacBook Pro"
    os: str = ""                # "macos", "ios", "android", "linux", "windows"
    cpu: str = ""               # e.g. "Apple M3 Pro"
    memory_gb: float = 0.0      # Total RAM in GB
    gpu: str = ""               # e.g. "Apple M3 Pro GPU 18-core"
    capabilities: List[DeviceCapability] = field(default_factory=list)
    local_llm: bool = False     # Does this device have a local LLM loaded?
    local_llm_model: str = ""   # e.g. "Qwen2.5-3B"
    trust_state: str = TrustState.DISCOVERED
    is_self: bool = False       # True for the local device
    last_seen: float = field(default_factory=time.time)

    # ── Serialization ──────────────────────────────────────────────────

    def to_dict(self) -> dict:
        return {
            "device_id": self.device_id,
            "public_key": self.public_key,
            "device_type": self.device_type,
            "device_name": self.device_name,
            "os": self.os,
            "cpu": self.cpu,
            "memory_gb": self.memory_gb,
            "gpu": self.gpu,
            "capabilities": [
                {"capability_id": c.capability_id, "available": c.available, "scope": c.scope}
                for c in self.capabilities
            ],
            "local_llm": self.local_llm,
            "local_llm_model": self.local_llm_model,
            "trust_state": self.trust_state,
            "is_self": self.is_self,
            "last_seen": self.last_seen,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "DeviceIdentity":
        caps_raw = d.get("capabilities", [])
        capabilities = []
        for c in caps_raw:
            if isinstance(c, dict):
                capabilities.append(DeviceCapability(
                    capability_id=c.get("capability_id", ""),
                    available=c.get("available", True),
                    scope=c.get("scope", CapabilityScope.ALLOWED),
                ))
            elif isinstance(c, str):
                # Legacy format: plain capability string list
                capabilities.append(DeviceCapability(capability_id=c))
        return cls(
            device_id=d.get("device_id", ""),
            public_key=d.get("public_key", ""),
            device_type=d.get("device_type", ""),
            device_name=d.get("device_name", ""),
            os=d.get("os", ""),
            cpu=d.get("cpu", ""),
            memory_gb=d.get("memory_gb", 0.0),
            gpu=d.get("gpu", ""),
            capabilities=capabilities,
            local_llm=d.get("local_llm", False),
            local_llm_model=d.get("local_llm_model", ""),
            trust_state=d.get("trust_state", TrustState.DISCOVERED),
            is_self=d.get("is_self", False),
            last_seen=d.get("last_seen", time.time()),
        )

    # ── Capability Queries ─────────────────────────────────────────────

    def has_capability(self, capability_id: str) -> bool:
        """Check if this device has a specific capability available."""
        return any(
            c.capability_id == capability_id and c.available
            for c in self.capabilities
        )

    def get_capability_scope(self, capability_id: str) -> Optional[str]:
        """Get the authorization scope for a specific capability."""
        for c in self.capabilities:
            if c.capability_id == capability_id:
                return c.scope
        return None

    def get_allowed_capabilities(self) -> List[str]:
        """Return list of capability IDs that are both available and ALLOWED."""
        return [
            c.capability_id for c in self.capabilities
            if c.available and c.scope == CapabilityScope.ALLOWED
        ]

    def capability_ids(self) -> List[str]:
        """Return all available capability IDs regardless of scope."""
        return [c.capability_id for c in self.capabilities if c.available]
