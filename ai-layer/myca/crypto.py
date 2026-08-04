"""
Myca Layer 4: Trust — Quantum-Safe-Ready Encryption

PQC-ready placeholder using X25519 ECDH key exchange + AES-256-GCM.
When liboqs becomes available for Python 3.14+, swap X25519 for CRYSTALS-Kyber.

Key rotation every 60 seconds. On rotation failure, cached key extended 30s.
"""

import asyncio
import os
import time
import logging
from dataclasses import dataclass, field
from typing import Optional, Callable, Awaitable

from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import serialization

logger = logging.getLogger("myca.crypto")

# Protocol event types
KYBER_KEYGEN = "KYBER_KEYGEN"
KYBER_EXCHANGE = "KYBER_EXCHANGE"
KYBER_ROTATE = "KYBER_ROTATE"
KYBER_ROTATE_FAIL = "KYBER_ROTATE_FAIL"
KYBER_ENCRYPT = "KYBER_ENCRYPT"
KYBER_DECRYPT = "KYBER_DECRYPT"


@dataclass
class KeyState:
    """Current cryptographic key material for a peer connection."""
    private_key: X25519PrivateKey
    public_key_bytes: bytes
    shared_key: Optional[bytes] = None
    created_at: float = field(default_factory=time.time)
    expires_at: float = 0.0
    extended: bool = False


class MycaCrypto:
    """
    PQC-ready encryption layer using X25519 + AES-256-GCM.
    
    Labeled 'PQC-ready placeholder' — when CRYSTALS-Kyber becomes available
    via liboqs Python bindings for 3.14+, the key exchange is swappable
    without changing the symmetric encryption or message format.
    """

    ROTATION_INTERVAL = 60.0  # seconds
    EXTENSION_PERIOD = 30.0   # seconds on rotation failure
    NONCE_SIZE = 12           # bytes for AES-256-GCM

    def __init__(self, event_callback: Optional[Callable[[str, dict], Awaitable[None]]] = None):
        self.event_callback = event_callback
        self._peer_keys: dict[str, KeyState] = {}  # peer_id -> KeyState
        self._local_state: Optional[KeyState] = None
        self._rotation_task: Optional[asyncio.Task] = None
        self._running = False

    async def _emit(self, event_type: str, data: dict):
        """Emit a protocol event."""
        event = {"type": event_type, "timestamp": time.time(), "layer": "crypto", **data}
        logger.info(f"[CRYPTO] {event_type}: {data}")
        if self.event_callback:
            await self.event_callback(event_type, event)

    def generate_keypair(self) -> KeyState:
        """Generate a new X25519 keypair."""
        private_key = X25519PrivateKey.generate()
        public_bytes = private_key.public_key().public_bytes(
            serialization.Encoding.Raw,
            serialization.PublicFormat.Raw
        )
        state = KeyState(
            private_key=private_key,
            public_key_bytes=public_bytes,
            expires_at=time.time() + self.ROTATION_INTERVAL
        )
        return state

    async def initialize(self):
        """Generate initial keypair and start rotation."""
        self._local_state = self.generate_keypair()
        self._running = True
        await self._emit(KYBER_KEYGEN, {
            "public_key": self._local_state.public_key_bytes.hex()[:16] + "...",
            "algorithm": "X25519 (PQC-ready placeholder)",
            "rotation_interval_s": self.ROTATION_INTERVAL
        })
        self._rotation_task = asyncio.create_task(self._rotation_loop())

    async def stop(self):
        """Stop key rotation."""
        self._running = False
        if self._rotation_task:
            self._rotation_task.cancel()
            try:
                await self._rotation_task
            except asyncio.CancelledError:
                pass

    def get_public_key_bytes(self) -> bytes:
        """Get our public key for sharing with peers."""
        if not self._local_state:
            raise RuntimeError("Crypto not initialized")
        return self._local_state.public_key_bytes

    async def derive_shared_key(self, peer_id: str, peer_public_bytes: bytes) -> bytes:
        """Perform X25519 key exchange with a peer."""
        if not self._local_state:
            raise RuntimeError("Crypto not initialized")

        peer_public_key = X25519PublicKey.from_public_bytes(peer_public_bytes)
        shared_secret = self._local_state.private_key.exchange(peer_public_key)

        # Use first 32 bytes of shared secret as AES-256 key
        aes_key = shared_secret[:32]

        self._peer_keys[peer_id] = KeyState(
            private_key=self._local_state.private_key,
            public_key_bytes=self._local_state.public_key_bytes,
            shared_key=aes_key,
            expires_at=time.time() + self.ROTATION_INTERVAL
        )

        await self._emit(KYBER_EXCHANGE, {
            "peer_id": peer_id,
            "algorithm": "X25519-ECDH → AES-256-GCM",
            "key_hash": aes_key.hex()[:8] + "..."
        })

        return aes_key

    def encrypt(self, peer_id: str, plaintext: bytes) -> bytes:
        """Encrypt a message for a peer using AES-256-GCM."""
        key_state = self._peer_keys.get(peer_id)
        if not key_state or not key_state.shared_key:
            raise RuntimeError(f"No shared key for peer {peer_id}")

        nonce = os.urandom(self.NONCE_SIZE)
        aesgcm = AESGCM(key_state.shared_key)
        ciphertext = aesgcm.encrypt(nonce, plaintext, None)

        # Prepend nonce to ciphertext
        return nonce + ciphertext

    def decrypt(self, peer_id: str, data: bytes) -> bytes:
        """Decrypt a message from a peer using AES-256-GCM."""
        key_state = self._peer_keys.get(peer_id)
        if not key_state or not key_state.shared_key:
            raise RuntimeError(f"No shared key for peer {peer_id}")

        nonce = data[:self.NONCE_SIZE]
        ciphertext = data[self.NONCE_SIZE:]
        aesgcm = AESGCM(key_state.shared_key)
        return aesgcm.decrypt(nonce, ciphertext, None)

    async def _rotation_loop(self):
        """Background task: rotate keys every ROTATION_INTERVAL seconds."""
        while self._running:
            await asyncio.sleep(self.ROTATION_INTERVAL)
            if not self._running:
                break
            await self._rotate_keys()

    async def _rotate_keys(self):
        """Rotate all peer keys. On failure, extend cached key."""
        try:
            old_state = self._local_state
            self._local_state = self.generate_keypair()

            await self._emit(KYBER_ROTATE, {
                "old_key_hash": old_state.public_key_bytes.hex()[:8] + "...",
                "new_key_hash": self._local_state.public_key_bytes.hex()[:8] + "...",
                "peers_to_rekey": len(self._peer_keys)
            })

            # In a real system, we'd re-exchange with each peer here.
            # For simulation, we just update the local state.
            for peer_id, key_state in self._peer_keys.items():
                key_state.expires_at = time.time() + self.ROTATION_INTERVAL

        except Exception as e:
            # Rotation failed — extend cached keys
            await self._emit(KYBER_ROTATE_FAIL, {
                "error": str(e),
                "action": f"extending cached keys by {self.EXTENSION_PERIOD}s"
            })
            for peer_id, key_state in self._peer_keys.items():
                key_state.expires_at = time.time() + self.EXTENSION_PERIOD
                key_state.extended = True
            logger.warning(f"Key rotation failed: {e}. Cached keys extended {self.EXTENSION_PERIOD}s.")

    async def force_rotation_failure(self):
        """Simulate a rotation failure for testing."""
        await self._emit(KYBER_ROTATE_FAIL, {
            "error": "simulated rotation failure",
            "action": f"extending cached keys by {self.EXTENSION_PERIOD}s"
        })
        for peer_id, key_state in self._peer_keys.items():
            key_state.expires_at = time.time() + self.EXTENSION_PERIOD
            key_state.extended = True
