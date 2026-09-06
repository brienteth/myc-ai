"""
Myca OS — Device Capability Registry (P0.1)

Runtime component that:
  1. Detects local device hardware capabilities (CPU, GPU, RAM, camera, LLM).
  2. Maintains an in-memory + SQLite-backed registry of all known devices.
  3. Provides capability-driven queries: "find me a TRUSTED node with camera.capture".
  4. Integrates with discovery/pairing to update device records on handshake.

Key Design Decisions:
  - Scheduler resolves tasks by capability_id, never by device_type.
  - Remote device capabilities are stored on pairing approval.
  - Local device capabilities are auto-detected on boot.
"""

import json
import logging
import os
import platform
import sqlite3
import time
from pathlib import Path
from typing import Dict, List, Optional

from myca.contracts.device import (
    DeviceIdentity,
    DeviceCapability,
    CapabilityScope,
    TrustState,
    CAPABILITY_CAMERA_CAPTURE,
    CAPABILITY_MICROPHONE_CAPTURE,
    CAPABILITY_STORAGE_READ,
    CAPABILITY_STORAGE_WRITE,
    CAPABILITY_FILESYSTEM_READ,
    CAPABILITY_FILESYSTEM_WRITE,
    CAPABILITY_GPU_COMPUTE,
    CAPABILITY_LOCAL_LLM,
    CAPABILITY_VISION,
    CAPABILITY_NETWORK_OUT,
    CAPABILITY_BROWSER,
    CAPABILITY_VAULT_READ,
    CAPABILITY_VAULT_WRITE,
)

logger = logging.getLogger("myca.registry.device")

DB_PATH = Path("~/.myca/myca.db").expanduser()


class DeviceCapabilityRegistry:
    """
    Central registry of all device identities and capabilities.
    
    Usage:
        registry = DeviceCapabilityRegistry(node_id="myca-abc123")
        registry.init_db()
        registry.detect_local_capabilities()
        
        # Find a device for camera capture
        devices = registry.find_devices_with_capability("camera.capture")
    """

    def __init__(self, node_id: str):
        self.node_id = node_id
        self._devices: Dict[str, DeviceIdentity] = {}
        self._local_device: Optional[DeviceIdentity] = None

    # ── Database Schema ────────────────────────────────────────────────

    def init_db(self):
        """Create the device_capabilities table if it doesn't exist."""
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(DB_PATH))
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS device_capabilities (
                device_id       TEXT PRIMARY KEY,
                public_key      TEXT,
                device_type     TEXT,
                device_name     TEXT,
                os              TEXT,
                cpu             TEXT,
                memory_gb       REAL,
                gpu             TEXT,
                capabilities    TEXT,       -- JSON array of capability objects
                local_llm       INTEGER DEFAULT 0,
                local_llm_model TEXT,
                trust_state     TEXT DEFAULT 'DISCOVERED',
                is_self         INTEGER DEFAULT 0,
                last_seen       REAL,
                created_at      REAL
            );

            CREATE INDEX IF NOT EXISTS idx_device_trust
                ON device_capabilities(trust_state);
        """)
        conn.commit()
        conn.close()
        logger.info("[DEVICE REGISTRY] Database table initialized.")

    # ── Local Device Detection ─────────────────────────────────────────

    def detect_local_capabilities(self, inference_engine=None) -> DeviceIdentity:
        """
        Auto-detect local device hardware and software capabilities.
        Returns and caches a DeviceIdentity for the local machine.
        """
        system = platform.system().lower()
        machine = platform.machine()

        # Detect OS type
        if system == "darwin":
            os_type = "macos"
            device_type = "mac"
        elif system == "linux":
            os_type = "linux"
            device_type = "linux"
        elif system == "windows":
            os_type = "windows"
            device_type = "windows"
        else:
            os_type = system
            device_type = system

        # Detect CPU
        cpu_info = f"{platform.processor()} ({machine})" if platform.processor() else machine

        # Detect Memory
        memory_gb = 0.0
        try:
            if system == "darwin":
                import subprocess
                result = subprocess.run(
                    ["sysctl", "-n", "hw.memsize"],
                    capture_output=True, text=True, timeout=5
                )
                if result.returncode == 0:
                    memory_gb = round(int(result.stdout.strip()) / (1024 ** 3), 1)
            else:
                # Fallback: try psutil
                try:
                    import psutil
                    memory_gb = round(psutil.virtual_memory().total / (1024 ** 3), 1)
                except ImportError:
                    pass
        except Exception as e:
            logger.warning(f"[DEVICE REGISTRY] Failed to detect memory: {e}")

        # Detect GPU
        gpu_info = ""
        try:
            if system == "darwin":
                import subprocess
                result = subprocess.run(
                    ["system_profiler", "SPDisplaysDataType", "-detailLevel", "mini"],
                    capture_output=True, text=True, timeout=10
                )
                if result.returncode == 0:
                    for line in result.stdout.splitlines():
                        if "Chipset Model" in line or "Chip" in line:
                            gpu_info = line.split(":")[-1].strip()
                            break
        except Exception as e:
            logger.warning(f"[DEVICE REGISTRY] Failed to detect GPU: {e}")

        # Detect hostname for device name
        device_name = platform.node() or "Myca Device"

        # Detect capabilities
        capabilities = []

        # Storage is always available on the local device
        capabilities.append(DeviceCapability(CAPABILITY_STORAGE_READ, True, CapabilityScope.ALLOWED))
        capabilities.append(DeviceCapability(CAPABILITY_STORAGE_WRITE, True, CapabilityScope.ALLOWED))
        capabilities.append(DeviceCapability(CAPABILITY_FILESYSTEM_READ, True, CapabilityScope.ALLOWED))
        capabilities.append(DeviceCapability(CAPABILITY_FILESYSTEM_WRITE, True, CapabilityScope.ALLOWED))

        # Vault is local-only by default
        capabilities.append(DeviceCapability(CAPABILITY_VAULT_READ, True, CapabilityScope.ALLOWED))
        capabilities.append(DeviceCapability(CAPABILITY_VAULT_WRITE, True, CapabilityScope.ALLOWED))

        # Network outbound
        capabilities.append(DeviceCapability(CAPABILITY_NETWORK_OUT, True, CapabilityScope.ALLOWED))

        # Browser
        capabilities.append(DeviceCapability(CAPABILITY_BROWSER, True, CapabilityScope.ALLOWED))

        # Camera detection (macOS has FaceTime camera)
        has_camera = False
        try:
            if system == "darwin":
                import subprocess
                result = subprocess.run(
                    ["system_profiler", "SPCameraDataType"],
                    capture_output=True, text=True, timeout=10
                )
                has_camera = "FaceTime" in result.stdout or "Camera" in result.stdout
        except Exception:
            pass
        capabilities.append(DeviceCapability(CAPABILITY_CAMERA_CAPTURE, has_camera, CapabilityScope.ALLOWED))

        # Microphone
        capabilities.append(DeviceCapability(CAPABILITY_MICROPHONE_CAPTURE, True, CapabilityScope.PROMPT))

        # GPU compute (Apple Silicon or NVIDIA)
        has_gpu = bool(gpu_info) or machine in ("arm64", "aarch64")
        capabilities.append(DeviceCapability(CAPABILITY_GPU_COMPUTE, has_gpu, CapabilityScope.ALLOWED))

        # Local LLM detection
        has_llm = False
        llm_model = ""
        if inference_engine is not None:
            engine_name = type(inference_engine).__name__
            if engine_name not in ("MockBackend",):
                has_llm = True
                llm_model = getattr(inference_engine, "model_name", "") or "Qwen2.5-3B"
        capabilities.append(DeviceCapability(CAPABILITY_LOCAL_LLM, has_llm, CapabilityScope.ALLOWED))

        # Vision capability (available if LLM or dedicated vision model exists)
        capabilities.append(DeviceCapability(CAPABILITY_VISION, has_llm, CapabilityScope.ALLOWED))

        device = DeviceIdentity(
            device_id=self.node_id,
            device_type=device_type,
            device_name=device_name,
            os=os_type,
            cpu=cpu_info,
            memory_gb=memory_gb,
            gpu=gpu_info,
            capabilities=capabilities,
            local_llm=has_llm,
            local_llm_model=llm_model,
            trust_state=TrustState.TRUSTED,
            is_self=True,
            last_seen=time.time(),
        )

        self._local_device = device
        self._devices[self.node_id] = device
        self._persist_device(device)

        logger.info(
            f"[DEVICE REGISTRY] Local device detected: {device_type} | "
            f"CPU: {cpu_info} | RAM: {memory_gb}GB | GPU: {gpu_info} | "
            f"LLM: {has_llm} | Capabilities: {len(capabilities)}"
        )
        return device

    # ── Device CRUD ────────────────────────────────────────────────────

    def register_remote_device(self, identity: DeviceIdentity) -> None:
        """Register or update a remote device in the registry."""
        identity.is_self = False
        identity.last_seen = time.time()
        self._devices[identity.device_id] = identity
        self._persist_device(identity)
        logger.info(
            f"[DEVICE REGISTRY] Remote device registered: {identity.device_id} "
            f"({identity.device_type}) with {len(identity.capabilities)} capabilities"
        )

    def update_trust_state(self, device_id: str, trust_state: str) -> None:
        """Update the trust state of a device."""
        if device_id in self._devices:
            self._devices[device_id].trust_state = trust_state
            self._persist_device(self._devices[device_id])
        else:
            # Update in DB directly
            conn = sqlite3.connect(str(DB_PATH))
            conn.execute(
                "UPDATE device_capabilities SET trust_state = ? WHERE device_id = ?",
                (trust_state, device_id)
            )
            conn.commit()
            conn.close()

    def remove_device(self, device_id: str) -> bool:
        """Remove a device from the registry."""
        removed = device_id in self._devices
        self._devices.pop(device_id, None)
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("DELETE FROM device_capabilities WHERE device_id = ?", (device_id,))
        conn.commit()
        conn.close()
        return removed

    def get_device(self, device_id: str) -> Optional[DeviceIdentity]:
        """Get a device by ID."""
        if device_id in self._devices:
            return self._devices[device_id]
        return self._load_device(device_id)

    def get_local_device(self) -> Optional[DeviceIdentity]:
        """Get the local device identity."""
        return self._local_device

    def get_all_devices(self) -> List[DeviceIdentity]:
        """Return all known devices."""
        self._load_all_devices()
        return list(self._devices.values())

    def get_trusted_devices(self) -> List[DeviceIdentity]:
        """Return all TRUSTED devices (including self)."""
        self._load_all_devices()
        return [d for d in self._devices.values() if d.trust_state == TrustState.TRUSTED]

    # ── Capability Queries (Scheduler Interface) ───────────────────────

    def find_devices_with_capability(
        self,
        capability_id: str,
        trusted_only: bool = True,
        allowed_only: bool = True,
    ) -> List[DeviceIdentity]:
        """
        Find devices that have a specific capability.
        
        This is the primary interface for the Capability Scheduler (P0.3).
        The scheduler asks: "Which TRUSTED node has camera.capture?"
        NOT: "Which node is an iPhone?"
        """
        self._load_all_devices()
        results = []
        for device in self._devices.values():
            # Trust filter
            if trusted_only and device.trust_state != TrustState.TRUSTED:
                continue
            # Capability filter
            if not device.has_capability(capability_id):
                continue
            # Scope filter
            if allowed_only:
                scope = device.get_capability_scope(capability_id)
                if scope == CapabilityScope.DENIED:
                    continue
            results.append(device)
        return results

    def find_best_device_for_capability(
        self,
        capability_id: str,
        prefer_local: bool = True,
    ) -> Optional[DeviceIdentity]:
        """
        Find the best device for a given capability.
        Prefers local device if it has the capability.
        """
        candidates = self.find_devices_with_capability(capability_id)
        if not candidates:
            return None

        # Prefer local device
        if prefer_local:
            for c in candidates:
                if c.is_self:
                    return c

        # Otherwise return first available
        return candidates[0]

    def verify_capability(self, device_id: str, capability_id: str) -> bool:
        """
        Strict capability validation. Checks if the paired device
        is trusted and has explicit permission (scope != DENIED) for the capability.
        """
        device = self.get_device(device_id)
        if not device:
            return False
        if device.trust_state != TrustState.TRUSTED:
            return False
        if not device.has_capability(capability_id):
            return False
        scope = device.get_capability_scope(capability_id)
        if scope == CapabilityScope.DENIED:
            return False
        return True

    # ── Persistence ────────────────────────────────────────────────────

    def _persist_device(self, device: DeviceIdentity) -> None:
        """Save a device to SQLite."""
        conn = sqlite3.connect(str(DB_PATH))
        caps_json = json.dumps([
            {"capability_id": c.capability_id, "available": c.available, "scope": c.scope}
            for c in device.capabilities
        ])
        conn.execute("""
            INSERT OR REPLACE INTO device_capabilities
            (device_id, public_key, device_type, device_name, os, cpu, memory_gb, gpu,
             capabilities, local_llm, local_llm_model, trust_state, is_self, last_seen, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            device.device_id, device.public_key, device.device_type,
            device.device_name, device.os, device.cpu, device.memory_gb,
            device.gpu, caps_json, int(device.local_llm),
            device.local_llm_model, device.trust_state, int(device.is_self),
            device.last_seen, time.time(),
        ))
        conn.commit()
        conn.close()

    def _load_device(self, device_id: str) -> Optional[DeviceIdentity]:
        """Load a single device from SQLite."""
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM device_capabilities WHERE device_id = ?", (device_id,)
        ).fetchone()
        conn.close()
        if not row:
            return None
        device = self._row_to_device(dict(row))
        self._devices[device.device_id] = device
        return device

    def _load_all_devices(self) -> None:
        """Load all devices from SQLite into memory cache."""
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM device_capabilities").fetchall()
        conn.close()
        for row in rows:
            d = dict(row)
            device = self._row_to_device(d)
            # Don't overwrite in-memory entries that may be more recent
            if device.device_id not in self._devices:
                self._devices[device.device_id] = device

    @staticmethod
    def _row_to_device(d: dict) -> DeviceIdentity:
        """Convert a SQLite row dict to a DeviceIdentity."""
        caps_raw = []
        try:
            caps_raw = json.loads(d.get("capabilities") or "[]")
        except (json.JSONDecodeError, TypeError):
            pass

        capabilities = []
        for c in caps_raw:
            if isinstance(c, dict):
                capabilities.append(DeviceCapability(
                    capability_id=c.get("capability_id", ""),
                    available=c.get("available", True),
                    scope=c.get("scope", CapabilityScope.ALLOWED),
                ))
            elif isinstance(c, str):
                capabilities.append(DeviceCapability(capability_id=c))

        return DeviceIdentity(
            device_id=d.get("device_id", ""),
            public_key=d.get("public_key", ""),
            device_type=d.get("device_type", ""),
            device_name=d.get("device_name", ""),
            os=d.get("os", ""),
            cpu=d.get("cpu", ""),
            memory_gb=d.get("memory_gb", 0.0),
            gpu=d.get("gpu", ""),
            capabilities=capabilities,
            local_llm=bool(d.get("local_llm", 0)),
            local_llm_model=d.get("local_llm_model", ""),
            trust_state=d.get("trust_state", TrustState.DISCOVERED),
            is_self=bool(d.get("is_self", 0)),
            last_seen=d.get("last_seen", 0.0),
        )
