import asyncio
import logging
import uvicorn
from myca.node import MycaNode
from myca.api import create_app
from myca.startup import get_or_create_node_id, ensure_model_ready
from myca.database import init_db

import os
from pathlib import Path

# Load .env file from root/docs/.env or local .env
for env_candidate in [Path(__file__).parent / ".env", Path(__file__).parent.parent / "docs" / ".env"]:
    if env_candidate.exists():
        with open(env_candidate, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    if key.strip() not in os.environ:
                        os.environ[key.strip()] = val.strip()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("myca.main")


async def main():
    print("╔══════════════════════════════════╗")
    print("║        Myca başlatılıyor...       ║")
    print("╚══════════════════════════════════╝")

    # ── Step 1: Initialize databases
    init_db()
    from myca.automation.history import AutomationDB
    AutomationDB.init_db()
    logger.info("[MAIN] Databases ready")

    # ── Step 2: Persistent node identity
    node_id = get_or_create_node_id()
    logger.info(f"[MAIN] Identity: {node_id}")

    # ── Step 3: Create node (needed for broadcast_fn before API starts)
    node = MycaNode(node_id=node_id, role="inference", port=8420, simulate=False)
    app = create_app(node)

    # ── Step 4: Setup async background startup on FastAPI start
    @app.on_event("startup")
    async def startup_bg_task():
        async def bg_startup():
            try:
                # Wait briefly for uvicorn server to bind and start listening
                await asyncio.sleep(0.5)
                
                # Check model and auto-download if needed, sending logs to WS
                model = await ensure_model_ready(broadcast_fn=node.event_callback)
                logger.info(f"[MAIN] Active model: {model}")
                
                # Start all layers (discovery, connection, library, LLM registry)
                await node.start()
                
                # Broadcast final ready state to frontend
                if node.event_callback:
                    await node.event_callback("NODE_READY", {
                        "type": "NODE_READY",
                        "node_id": node_id,
                        "model": model,
                    })
            except Exception as bg_err:
                logger.error(f"[STARTUP BG] Error in background startup: {bg_err}")
        
        asyncio.create_task(bg_startup())

    # ── Step 5: Run API server (FastAPI will execute background startup)
    config = uvicorn.Config(app, host="127.0.0.1", port=8420, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()

    await node.stop()


if __name__ == "__main__":
    asyncio.run(main())
