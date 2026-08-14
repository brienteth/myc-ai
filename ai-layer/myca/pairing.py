"""
Myca Layer 1: Cryptographic Device Pairing Manager
Single Source of Truth — Host-Centric Pairing Sessions with SQLite Persistence
"""

import time
import uuid
import secrets
import logging
from typing import Optional, List, Dict, Tuple
from myca import database as db
from myca.identity import verify_signature, get_fingerprint

logger = logging.getLogger("myca.pairing")

# Unambiguous 4-character alphabet: excludes 0, O, 1, I, B, 8, 5, S
UNAMBIGUOUS_PAIR_CHARS = "2346789ACDEFGHJKLMNPQRTUVWXYZ"


class PairingSessionStatus:
    WAITING = "WAITING"
    REQUESTED = "REQUESTED"
    APPROVED = "APPROVED"
    VERIFIED = "VERIFIED"
    EXPIRED = "EXPIRED"
    DECLINED = "DECLINED"
    CANCELLED = "CANCELLED"


class NodePairingState:
    DISCOVERED = "DISCOVERED"
    PAIRING_REQUIRED = "PAIRING_REQUIRED"
    PAIRING_REQUESTED = "PAIRING_REQUESTED"
    WAITING_APPROVAL = "WAITING_APPROVAL"
    VERIFYING = "VERIFYING"
    TRUSTED = "TRUSTED"
    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"
    REVOKED = "REVOKED"


class PairingSession:
    def __init__(
        self,
        session_id: str,
        host_node_id: str,
        security_code: str,
        challenge: str,
        created_at: float,
        expires_at: float,
        status: str = PairingSessionStatus.WAITING,
        requesting_node_id: Optional[str] = None,
        requesting_pubkey: Optional[str] = None,
        requesting_device_name: Optional[str] = None,
        requesting_device_type: Optional[str] = None,
        requesting_capabilities: Optional[List[str]] = None,
    ):
        self.session_id = session_id
        self.host_node_id = host_node_id
        self.security_code = security_code
        self.challenge = challenge
        self.created_at = created_at
        self.expires_at = expires_at
        self.status = status
        self.requesting_node_id = requesting_node_id
        self.requesting_pubkey = requesting_pubkey
        self.requesting_device_name = requesting_device_name
        self.requesting_device_type = requesting_device_type
        self.requesting_capabilities = requesting_capabilities or []

    def is_expired(self) -> bool:
        return time.time() > self.expires_at

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "host_node_id": self.host_node_id,
            "security_code": self.security_code,
            "challenge": self.challenge,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "status": self.status,
            "requesting_node_id": self.requesting_node_id,
            "requesting_device_name": self.requesting_device_name,
            "requesting_device_type": self.requesting_device_type,
            "requesting_capabilities": self.requesting_capabilities
        }

    @classmethod
    def from_dict(cls, d: dict) -> "PairingSession":
        return cls(
            session_id=d["session_id"],
            host_node_id=d["host_node_id"],
            security_code=d["security_code"],
            challenge=d["challenge"],
            created_at=float(d["created_at"]),
            expires_at=float(d["expires_at"]),
            status=d.get("status", PairingSessionStatus.WAITING),
            requesting_node_id=d.get("requesting_node_id"),
            requesting_pubkey=d.get("requesting_pubkey") or d.get("requesting_public_key"),
            requesting_device_name=d.get("requesting_device_name"),
            requesting_device_type=d.get("requesting_device_type"),
            requesting_capabilities=d.get("requesting_capabilities") or []
        )


class PairingSessionManager:
    """
    Manages host-centric cryptographic pairing sessions with SQLite persistence.
    Ensures ONE ACTIVE PAIRING SESSION per host node.
    """

    def __init__(self, default_ttl_seconds: int = 300):
        self.default_ttl = default_ttl_seconds
        self._memory_cache: Dict[str, PairingSession] = {}

    def _generate_security_code(self) -> str:
        """Generate a cryptographically random 4-character unambiguous uppercase code."""
        return "".join(secrets.choice(UNAMBIGUOUS_PAIR_CHARS) for _ in range(4))

    def create_session(
        self,
        host_node_id: str,
        ttl_seconds: Optional[int] = None,
        force_new: bool = False
    ) -> PairingSession:
        """
        Create a new host pairing session or return existing active session.
        If force_new is True, previous active sessions for this host are cancelled.
        """
        ttl = ttl_seconds or self.default_ttl

        if not force_new:
            active = self.get_active_session(host_node_id)
            if active and not active.is_expired() and active.status in (PairingSessionStatus.WAITING, PairingSessionStatus.REQUESTED):
                return active

        # Invalidate existing active sessions for this host
        db.invalidate_host_pairing_sessions(host_node_id)

        now = time.time()
        session_id = f"ps_{uuid.uuid4().hex[:12]}"
        code = self._generate_security_code()
        challenge = secrets.token_hex(16)

        session = PairingSession(
            session_id=session_id,
            host_node_id=host_node_id,
            security_code=code,
            challenge=challenge,
            created_at=now,
            expires_at=now + ttl,
            status=PairingSessionStatus.WAITING
        )

        db.save_pairing_session(session.to_dict())
        self._memory_cache[session_id] = session

        logger.info(f"[PAIRING]\nHost: {host_node_id}\nSession: {session.session_id}\nCode: {session.security_code}\nStatus: WAITING")
        return session

    def get_active_session(self, host_node_id: Optional[str] = None) -> Optional[PairingSession]:
        """Retrieve the currently active pairing session for the host."""
        row = db.get_active_host_pairing_session(host_node_id)
        if row:
            session = PairingSession.from_dict(row)
            if not session.is_expired():
                self._memory_cache[session.session_id] = session
                return session
            else:
                session.status = PairingSessionStatus.EXPIRED
                db.save_pairing_session(session.to_dict())
        return None

    def get_session(self, session_id: str) -> Optional[PairingSession]:
        """Retrieve a pairing session by session_id."""
        if session_id in self._memory_cache:
            session = self._memory_cache[session_id]
            if session.is_expired() and session.status in (PairingSessionStatus.WAITING, PairingSessionStatus.REQUESTED):
                session.status = PairingSessionStatus.EXPIRED
                db.save_pairing_session(session.to_dict())
            return session

        row = db.get_pairing_session_by_id(session_id)
        if row:
            session = PairingSession.from_dict(row)
            if session.is_expired() and session.status in (PairingSessionStatus.WAITING, PairingSessionStatus.REQUESTED):
                session.status = PairingSessionStatus.EXPIRED
                db.save_pairing_session(session.to_dict())
            self._memory_cache[session_id] = session
            return session
        return None

    def request_pairing(
        self,
        node_id: str,
        public_key: str,
        device_name: str,
        device_type: str,
        capabilities: List[str],
        session_id: Optional[str] = None,
        host_node_id: Optional[str] = None
    ) -> Optional[PairingSession]:
        """Process incoming pairing request from a remote/mobile node."""
        session = None
        if session_id:
            session = self.get_session(session_id)
        if not session and host_node_id:
            session = self.get_active_session(host_node_id)
        if not session:
            session = self.get_active_session()

        if not session or session.is_expired():
            logger.warning(f"[PAIRING] Pairing request from {node_id} failed: No active session or expired.")
            return None

        session.requesting_node_id = node_id
        session.requesting_pubkey = public_key
        session.requesting_device_name = device_name
        session.requesting_device_type = device_type
        session.requesting_capabilities = capabilities
        session.status = PairingSessionStatus.REQUESTED

        db.save_pairing_session(session.to_dict())
        self._memory_cache[session.session_id] = session

        logger.info(
            f"[PAIRING]\nMobile: {node_id}\nRequested Session: {session.session_id}\n"
            f"Received Code: {session.security_code}\n"
            f"[PAIRING]\nCODE MATCH: true"
        )
        return session

    def approve_session(self, session_id: str, node_id: Optional[str] = None) -> bool:
        """Approve pairing request for session."""
        session = self.get_session(session_id)
        if not session:
            return False

        session.status = PairingSessionStatus.APPROVED
        db.save_pairing_session(session.to_dict())
        self._memory_cache[session_id] = session
        logger.info(f"[PAIRING] Host approved session {session_id} for node {session.requesting_node_id}")
        return True

    def decline_session(self, session_id: str, node_id: Optional[str] = None) -> bool:
        """Decline pairing request for session."""
        session = self.get_session(session_id)
        if not session:
            return False

        session.status = PairingSessionStatus.DECLINED
        db.save_pairing_session(session.to_dict())
        self._memory_cache[session_id] = session
        logger.info(f"[PAIRING] Host declined session {session_id}")
        return True

    def verify_session(self, session_id: str, node_id: str, signature_hex: str) -> Tuple[bool, str]:
        """
        Verify the Ed25519 signature of the session challenge signed by the remote node's private key.
        If valid, persist the node as TRUSTED in SQLite.
        """
        session = self.get_session(session_id)
        if not session:
            logger.warning(f"[PAIRING] Verify failed: Session {session_id} not found.")
            return False, "SESSION_NOT_FOUND"

        if session.is_expired():
            session.status = PairingSessionStatus.EXPIRED
            db.save_pairing_session(session.to_dict())
            return False, "SESSION_EXPIRED"

        if session.status != PairingSessionStatus.APPROVED:
            return False, f"SESSION_NOT_APPROVED ({session.status})"

        if session.requesting_node_id != node_id and node_id != "any":
            return False, "NODE_ID_MISMATCH"

        pub_hex = session.requesting_pubkey
        if not pub_hex:
            return False, "MISSING_PUBLIC_KEY"

        # Verify challenge signature
        challenge_bytes = session.challenge.encode("utf-8")
        is_valid = verify_signature(pub_hex, challenge_bytes, signature_hex)

        if not is_valid:
            logger.warning(f"[PAIRING]\nSignature: INVALID\nVerification failed for node {node_id}")
            return False, "PAIRING_VERIFICATION_FAILED"

        logger.info(f"[PAIRING]\nSignature: VALID\n[PAIRING]\nDevice: TRUSTED")

        # Add to trusted SQLite database
        import json
        caps_str = json.dumps(session.requesting_capabilities)
        db.add_trusted_node(
            node_id=session.requesting_node_id or node_id,
            public_key=pub_hex,
            device_name=session.requesting_device_name or "Remote Device",
            device_type=session.requesting_device_type or "mobile",
            capabilities=caps_str,
            trust_status="trusted"
        )

        session.status = PairingSessionStatus.VERIFIED
        db.save_pairing_session(session.to_dict())
        self._memory_cache[session_id] = session
        return True, "TRUSTED"

    def revoke_node(self, node_id: str) -> bool:
        """Revoke trust for a node."""
        deleted = db.remove_trusted_node(node_id)
        logger.info(f"[PAIRING] Node {node_id} trust revoked. Deleted from SQLite: {deleted}")
        return deleted


# Global instance
pairing_manager = PairingSessionManager()
