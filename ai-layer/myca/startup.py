"""
Myca Startup — Pre-flight checks before API server starts.

1. get_or_create_node_id()   — stable identity in ~/.myca/node_id
2. ensure_model_ready()      — auto-download best available Ollama model
"""

import asyncio
import logging
import uuid
from pathlib import Path

import httpx

logger = logging.getLogger("myca.startup")

# Priority order — largest/best to smallest/fastest
PREFERRED_MODELS = [
    "qwen2.5-coder:7b",
    "llama3.1:8b",
    "llama3.2:3b",
    "phi3.5:mini",
    "phi3:mini",
    "tinyllama:latest",
]

# Fallback to download if nothing installed
FALLBACK_DOWNLOAD = "phi3:mini"

NODE_ID_FILE = Path("~/.myca/node_id").expanduser()


def get_or_create_node_id() -> str:
    """
    Return this device's permanent Myca node ID.
    Cryptographically derived from the persistent Ed25519 public key.
    """
    from myca.identity import get_or_create_identity_key, get_public_key_hex
    private_key = get_or_create_identity_key()
    pub_hex = get_public_key_hex(private_key)
    node_id = "m_" + pub_hex[:12]
    
    NODE_ID_FILE.parent.mkdir(parents=True, exist_ok=True)
    NODE_ID_FILE.write_text(node_id)
    logger.info(f"[STARTUP] Node identity loaded: {node_id} (Pubkey: {pub_hex[:16]}...)")
    return node_id


async def ensure_model_ready(broadcast_fn=None) -> str:
    """
    Check Ollama for installed models and return the best one.
    Downloads the fallback model if nothing is installed.
    Streams download progress events via broadcast_fn if provided.
    """

    async def emit(event_type: str, data: dict):
        if broadcast_fn:
            await broadcast_fn(event_type, {"type": event_type, **data})

    # 1. Check what's installed
    installed = []
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get("http://localhost:11434/api/tags")
            if resp.status_code == 200:
                installed = [m["name"] for m in resp.json().get("models", [])]
                logger.info(f"[STARTUP] Ollama models installed: {installed}")
    except Exception as e:
        logger.warning(f"[STARTUP] Ollama unreachable: {e}")

    # 2. Pick first preferred model that is installed in Ollama
    for model in PREFERRED_MODELS:
        if any(model in m for m in installed):
            logger.info(f"[STARTUP] Using installed Ollama model: {model}")
            await emit("MODEL_READY", {"model": model})
            return model

    # 2.5 Check for local GGUF models in ~/.myca/models/
    models_dir = Path("~/.myca/models").expanduser()
    if models_dir.exists():
        ggufs = list(models_dir.glob("*.gguf"))
        if ggufs:
            selected_gguf = ggufs[0].name
            logger.info(f"[STARTUP] Using local GGUF model: {selected_gguf}")
            await emit("MODEL_READY", {"model": selected_gguf})
            return selected_gguf

    # 3. Nothing found — download fallback
    logger.info(f"[STARTUP] No model found — downloading {FALLBACK_DOWNLOAD}")
    await emit("MODEL_DOWNLOAD", {
        "progress": f"{FALLBACK_DOWNLOAD} indiriliyor...",
        "pct": 0,
        "phase": "start",
    })

    try:
        proc = await asyncio.create_subprocess_exec(
            "ollama", "pull", FALLBACK_DOWNLOAD,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )

        async for raw_line in proc.stdout:
            line = raw_line.decode(errors="replace").strip()
            if not line:
                continue

            # Parse percentage from lines like "pulling ... 45%"
            pct = 0
            if "%" in line:
                try:
                    pct = int(line.split("%")[0].split()[-1])
                except Exception:
                    pass

            logger.info(f"[OLLAMA PULL] {line}")
            await emit("MODEL_DOWNLOAD", {
                "progress": line,
                "pct": pct,
                "phase": "downloading",
            })

        await proc.wait()
        logger.info(f"[STARTUP] {FALLBACK_DOWNLOAD} ready")
        await emit("MODEL_DOWNLOAD", {
            "progress": "done",
            "pct": 100,
            "phase": "done",
        })
        await emit("MODEL_READY", {"model": FALLBACK_DOWNLOAD})
        return FALLBACK_DOWNLOAD

    except FileNotFoundError:
        logger.error("[STARTUP] 'ollama' command not found. Is Ollama installed?")
        await emit("MODEL_DOWNLOAD", {
            "progress": "error: ollama not found",
            "pct": 0,
            "phase": "error",
        })
        return FALLBACK_DOWNLOAD
    except Exception as e:
        logger.error(f"[STARTUP] Model download failed: {e}")
        return FALLBACK_DOWNLOAD
