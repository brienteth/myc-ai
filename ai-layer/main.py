import asyncio
import logging
import uvicorn
from myca.node import MycaNode
from myca.api import create_app
from myca.startup import get_or_create_node_id, ensure_model_ready
from myca.database import init_db

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
    node = MycaNode(node_id=node_id, role="inference", port=8420, simulate=True)
    app = create_app(node)

    # ── Step 4: Ensure model is ready (downloads if needed)
    #    broadcast_fn is set after node.start() — here we just log
    model = await ensure_model_ready(broadcast_fn=None)
    logger.info(f"[MAIN] Active model: {model}")

    # ── Step 5: Start node layers (discovery, connection, crypto)
    await node.start()

    # ── Step 6: Broadcast NODE_READY over WebSocket
    await node.event_callback("NODE_READY", {
        "type": "NODE_READY",
        "node_id": node_id,
        "model": model,
    })

    # ── Step 7: Run API server
    config = uvicorn.Config(app, host="127.0.0.1", port=8420, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()

    await node.stop()


if __name__ == "__main__":
    asyncio.run(main())
