"""
Myca Secure Local Identity (Ed25519)
Provides stable cryptographic node identity and signature validation.
"""

import os
import logging
import hashlib
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization

logger = logging.getLogger("myca.identity")

IDENTITY_KEY_FILE = Path("~/.myca/identity.pem").expanduser()

def get_or_create_identity_key() -> ed25519.Ed25519PrivateKey:
    """Load or generate the stable Ed25519 private key for this node."""
    IDENTITY_KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    if IDENTITY_KEY_FILE.exists():
        try:
            pem_data = IDENTITY_KEY_FILE.read_bytes()
            private_key = serialization.load_pem_private_key(pem_data, password=None)
            if isinstance(private_key, ed25519.Ed25519PrivateKey):
                return private_key
            logger.warning("Stored key is not an Ed25519 key. Regenerating.")
        except Exception as e:
            logger.error(f"Failed to load identity key: {e}. Regenerating.")

    # Generate a new Ed25519 key
    private_key = ed25519.Ed25519PrivateKey.generate()
    pem_data = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.OpenSSH,
        encryption_algorithm=serialization.NoEncryption()
    )
    IDENTITY_KEY_FILE.write_bytes(pem_data)
    logger.info(f"Generated new Ed25519 node identity key at {IDENTITY_KEY_FILE}")
    return private_key

def generate_keypair() -> ed25519.Ed25519PrivateKey:
    """Generate an ephemeral in-memory Ed25519 keypair."""
    return ed25519.Ed25519PrivateKey.generate()

def get_public_key_bytes(private_key: ed25519.Ed25519PrivateKey) -> bytes:
    """Return the raw public key bytes (32 bytes)."""
    return private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw
    )

def get_public_key_hex(private_key: ed25519.Ed25519PrivateKey) -> str:
    """Return the hex representation of the public key."""
    return get_public_key_bytes(private_key).hex()

def get_fingerprint(public_key_hex: str) -> str:
    """Create a colons-separated uppercase fingerprint of the public key (using SHA-256)."""
    try:
        pub_bytes = bytes.fromhex(public_key_hex)
        sha = hashlib.sha256(pub_bytes).digest()
        hex_digest = sha.hex().upper()
        # Form group of 2 characters: "XX:XX:XX..."
        return ":".join(hex_digest[i:i+2] for i in range(0, 16, 2))  # first 8 bytes for readability
    except Exception:
        return "UNKNOWN_FINGERPRINT"

def sign_message(private_key: ed25519.Ed25519PrivateKey, message: bytes) -> bytes:
    """Sign message bytes using Ed25519 private key."""
    return private_key.sign(message)

def verify_signature(public_key_hex: str, message: bytes, signature_hex: str) -> bool:
    """Verify Ed25519 signature over a message using public key hex."""
    try:
        pub_bytes = bytes.fromhex(public_key_hex)
        sig_bytes = bytes.fromhex(signature_hex)
        public_key = ed25519.Ed25519PublicKey.from_public_bytes(pub_bytes)
        public_key.verify(sig_bytes, message)
        return True
    except Exception as e:
        logger.warning(f"Signature verification failed: {e}")
        return False
