"""
Myca API — FastAPI application for the node HTTP/WebSocket interface.

Endpoints:
  GET  /health          → node status, connected peers, latency map
  GET  /peers           → list of discovered nodes with roles and latency
  POST /query           → { "prompt": str, "stream": bool } or { "need": {...} }
  GET  /compute/stats   → compute avoidance statistics
  POST /compute/cache/clear → clear semantic cache
  WS   /ws              → real-time protocol log stream
  POST /node/register   → manual node registration for localhost testing
"""

import asyncio
import json
import logging
import os
import time
import uuid as _uuid
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

import httpx

from myca.node import MycaNode
from myca.core.need import Need, PrivacyLevel
from myca.experience.memory import ExperienceMemory
from myca.runtime import RuntimeEngine
from myca.speculative import SpeculativeDecoder
import myca.database as db

logger = logging.getLogger("myca.api")


class QueryRequest(BaseModel):
    prompt: str
    stream: bool = True
    conv_id: Optional[str] = None  # auto-generated if not provided


class RegisterRequest(BaseModel):
    node_id: str
    role: str = "inference"
    host: str = "127.0.0.1"
    port: int = 8420


def create_app(node: MycaNode) -> FastAPI:
    """Create the FastAPI application with a reference to the Myca node."""

    app = FastAPI(
        title="Myca — P2P Distributed AI Inference",
        description="Built on dormant technologies: mDNS, WebRTC DataChannel, HTTP 103, X25519+AES-256-GCM",
        version="0.1.0",
    )

    # CORS for frontend dev server
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    memory = ExperienceMemory()
    runtime = RuntimeEngine(node)
    
    def get_runtime():
        return runtime
    # WebSocket connections for protocol log
    ws_clients: list[WebSocket] = []

    # Protocol event buffer (last 500 events)
    event_buffer: list[dict] = []
    MAX_BUFFER = 500

    async def broadcast_event(event_type: str, event: dict):
        """Broadcast a protocol event to all WebSocket clients and buffer it."""
        event_buffer.append(event)
        if len(event_buffer) > MAX_BUFFER:
            event_buffer.pop(0)

        dead = []
        for ws in ws_clients:
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            ws_clients.remove(ws)

    # Set the event callback on the node
    node.event_callback = broadcast_event

    # ── Health ──────────────────────────────────────────────────

    @app.get("/health")
    async def health():
        """Node status, connected peers, latency map."""
        return node.get_health()

    # ── Peers ──────────────────────────────────────────────────

    @app.get("/peers")
    async def peers():
        """List of discovered nodes with roles and latency."""
        return {
            "node_id": node.node_id,
            "peers": node.get_peers(),
            "total": len(node.get_peers()),
        }

    # ── Query (Need Protocol) ───────────────────────────────────

    @app.post("/query")
    async def query(request: Request):
        """
        Process a prompt through the Need Protocol pipeline.
        Accepts both old format {prompt, stream} and new {need: {...}}.
        If stream=true, returns Server-Sent Events (text/event-stream).
        If stream=false, returns complete response as JSON.
        """
        body = await request.json()
        prompt = body.get("prompt", "")
        conv_id = body.get("conv_id") or str(_uuid.uuid4())
        stream = body.get("stream", True)

        # Support both old format and new Need format
        if "need" in body:
            need = Need.from_dict(body["need"])
            need.conv_id = conv_id
            prompt = need.prompt
        else:
            need = Need.from_simple_prompt(prompt, conv_id)

        need.stream = stream
        runtime = get_runtime()

        if stream:
            async def stream_tokens():
                try:
                    full_response = []
                    done_meta = {}
                    async for event in runtime.stream_schedule(need):
                        if event["type"] == "token":
                            full_response.append(event["token"])
                            data = json.dumps(event)
                            yield f"data: {data}\n\n"
                        elif event["type"] == "done":
                            done_meta = event
                            event["conv_id"] = conv_id
                            data = json.dumps(event)
                            yield f"data: {data}\n\n"

                    # Auto-save to history
                    try:
                        db.save_message(conv_id, "user", prompt)
                        db.save_message(conv_id, "assistant", "".join(full_response), meta={
                            "node_used": done_meta.get("node_used", "local"),
                            "node_display": done_meta.get("node_display", "bu cihaz"),
                            "source": done_meta.get("source", "full_model"),
                            "compute_avoided": done_meta.get("compute_avoided", False),
                        })
                    except Exception as db_err:
                        logger.warning(f"History save failed: {db_err}")

                    yield "data: [DONE]\n\n"
                except Exception as e:
                    error = json.dumps({"error": str(e)})
                    yield f"data: {error}\n\n"

            return StreamingResponse(
                stream_tokens(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )
        else:
            # Non-streaming
            try:
                result = await runtime.schedule(need)

                # Auto-save to history
                try:
                    db.save_message(conv_id, "user", prompt)
                    db.save_message(conv_id, "assistant", result.get("response", ""), meta={
                        "node_used": result.get("node_used", "local"),
                        "node_display": result.get("node_display", "bu cihaz"),
                        "source": result.get("source", "full_model"),
                        "compute_avoided": result.get("compute_avoided", False),
                    })
                except Exception as db_err:
                    logger.warning(f"History save failed: {db_err}")

                result["conv_id"] = conv_id
                result["done"] = True
                return JSONResponse(result)
            except Exception as e:
                return JSONResponse(
                    status_code=500,
                    content={"error": str(e), "done": True},
                )

    # ── Compute Stats (Need Protocol) ─────────────────────────

    @app.get("/compute/stats")
    async def compute_stats():
        """Returns compute avoidance statistics."""
        runtime = get_runtime()
        return JSONResponse(runtime.analytics.get_stats())

    @app.post("/compute/cache/clear")
    async def clear_cache():
        """Clear the semantic cache."""
        runtime = get_runtime()
        runtime.memory.clear() # Note: I will need to add clear() to ExperienceMemory
        return {"ok": True}


    # ── WebSocket Protocol Log ────────────────────────────────

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        """Real-time protocol log stream."""
        await websocket.accept()
        ws_clients.append(websocket)

        # Send buffered events
        for event in event_buffer[-50:]:  # Last 50 events
            try:
                await websocket.send_json(event)
            except Exception:
                break

        try:
            while True:
                # Keep connection alive, handle client messages
                data = await websocket.receive_text()
                # Client can send ping or commands
                if data == "ping":
                    await websocket.send_json({"type": "pong", "timestamp": time.time()})
        except WebSocketDisconnect:
            if websocket in ws_clients:
                ws_clients.remove(websocket)
        except Exception:
            if websocket in ws_clients:
                ws_clients.remove(websocket)

    # ── Manual Node Registration ──────────────────────────────

    @app.post("/node/register")
    async def register_node(req: RegisterRequest):
        """
        Manual node registration for testing multi-node on localhost.
        Adds a peer directly to the discovery layer.
        """
        from myca.discovery import PeerInfo

        peer = PeerInfo(
            node_id=req.node_id,
            role=req.role,
            host=req.host,
            port=req.port,
        )

        node.discovery.peers[req.node_id] = peer

        # Connect to the new peer
        try:
            await node.connection.connect_to_peer(peer)
        except Exception as e:
            logger.warning(f"Could not connect to manually registered node: {e}")

        await broadcast_event("NODE_REGISTER", {
            "type": "NODE_REGISTER",
            "timestamp": time.time(),
            "layer": "api",
            "node_id": req.node_id,
            "role": req.role,
            "host": req.host,
            "port": req.port,
            "source": "manual",
        })

        return {"status": "registered", "node_id": req.node_id}

    # ── Events History ────────────────────────────────────────

    @app.get("/events")
    async def get_events(limit: int = 50):
        """Get recent protocol events."""
        return {"events": event_buffer[-limit:], "total": len(event_buffer)}

    # ── Node Status & Debug Endpoints ─────────────────────────

    @app.get("/nodes/status")
    async def nodes_status():
        """Live status of all nodes: load, tps, model_loaded."""
        peers = node.discovery.get_active_peers()
        peer_list = [p.to_dict() for p in peers]

        local = {
            "node_id": node.node_id,
            "role": node.role,
            "host": "127.0.0.1",
            "port": node.port,
            "load_pct": 0.0,
            "tokens_per_second": node.inference_manager.benchmark_tok_s if node.inference_manager else 0.0,
            "model_loaded": node.inference_engine is not None,
            "status": node.status,
            "is_local": True,
        }

        return {
            "local": local,
            "peers": peer_list,
            "total": 1 + len(peer_list),
        }

    class SetLoadRequest(BaseModel):
        node_id: str
        load_pct: float

    class SetSpeedRequest(BaseModel):
        node_id: str
        tokens_per_second: float

    @app.post("/node/set-load")
    async def set_node_load(req: SetLoadRequest):
        """Manually set a node's CPU load for testing routing."""
        if not hasattr(node.discovery, "set_node_load"):
            return JSONResponse(status_code=400, content={"error": "Only available in simulation mode"})
        node.discovery.set_node_load(req.node_id, req.load_pct)
        await broadcast_event("NODE_LOAD_UPDATE", {
            "type": "NODE_LOAD_UPDATE",
            "timestamp": time.time(),
            "layer": "api",
            "node_id": req.node_id,
            "load_pct": req.load_pct,
            "source": "manual",
        })
        return {"status": "ok", "node_id": req.node_id, "load_pct": req.load_pct}

    @app.post("/node/set-speed")
    async def set_node_speed(req: SetSpeedRequest):
        """Manually set a node's inference speed for testing routing."""
        if not hasattr(node.discovery, "set_node_speed"):
            return JSONResponse(status_code=400, content={"error": "Only available in simulation mode"})
        node.discovery.set_node_speed(req.node_id, req.tokens_per_second)
        return {"status": "ok", "node_id": req.node_id, "tokens_per_second": req.tokens_per_second}

    @app.post("/debug/trigger-failover")
    async def trigger_failover():
        """Immediately trigger Scenario B: kill alpha for 10s."""
        if not hasattr(node.discovery, "simulate_node_death"):
            return JSONResponse(status_code=400, content={"error": "Only available in simulation mode"})

        async def _do_failover():
            await node.orchestrator._emit("ROUTE_FAILOVER", {
                "description": "Manual failover triggered — killing myca-alpha",
                "failed_node": "myca-alpha",
                "failover_to": "myca-beta",
            })
            await node.discovery.simulate_node_death("myca-alpha")
            await asyncio.sleep(10)
            await node.discovery.simulate_node_recovery("myca-alpha")

        asyncio.create_task(_do_failover())
        return {"status": "failover triggered", "node": "myca-alpha", "duration_s": 10}

    # ── Library Endpoints ─────────────────────────────────────
    
    from fastapi import UploadFile, File, Form
    
    @app.post("/library/add")
    async def library_add(file: UploadFile = File(...)):
        content_bytes = await file.read()
        filename = file.filename
        ext = filename.split('.')[-1].lower() if '.' in filename else ''
        
        # Type detection
        if ext in ['pdf', 'txt', 'md', 'docx']: file_type = 'document'
        elif ext in ['jpg', 'jpeg', 'png', 'gif', 'webp']: file_type = 'image'
        elif ext in ['mp3', 'wav', 'm4a', 'ogg']: file_type = 'audio'
        elif ext in ['mp4', 'mov', 'avi']: file_type = 'video'
        elif ext in ['py', 'js', 'ts', 'jsx', 'tsx', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'css', 'json']: file_type = 'code'
        else: file_type = 'document'
            
        res = await node.library.add_file(filename, content_bytes, file_type)
        return res

    class UrlRequest(BaseModel):
        url: str
        
    @app.post("/library/url")
    async def library_url(req: UrlRequest):
        res = await node.library.add_url(req.url)
        return res

    @app.get("/library/files")
    async def library_files(type: str = "all", q: str = ""):
        # If type is "recent", route directly to library.get_recent()
        if type == "recent":
            files = await node.library.get_recent(limit=20)
        else:
            files = await node.library.hybrid_search(q, type_filter=type)
        return {"files": files}

    @app.get("/library/files/{file_id}")
    async def library_file_get(file_id: str):
        f = await node.library.get_file(file_id)
        if not f:
            return JSONResponse(status_code=404, content={"error": "Not found"})
        # Record access history
        await node.library.record_access(file_id, "opened")
        return f

    @app.delete("/library/files/{file_id}")
    async def library_file_del(file_id: str):
        await node.library.delete_file(file_id)
        return {"status": "deleted"}

    @app.delete("/library/all")
    async def library_delete_all():
        await node.library.delete_all()
        return {"status": "all deleted"}

    @app.get("/library/stats")
    async def library_stats():
        stats = await node.library.get_stats()
        return stats

    @app.post("/library/files/{file_id}/favorite")
    async def library_toggle_favorite(file_id: str):
        fav = await node.library.toggle_favorite(file_id)
        return {"status": "ok", "favorite": fav}

    @app.get("/library/suggestions")
    async def library_suggestions(q: str = ""):
        s = await node.library.get_suggestions(q)
        return {"suggestions": s}

    # ── Settings Endpoints ────────────────────────────────────
    import httpx

    @app.get("/models")
    async def get_models():
        """Fetch available GGUF models from local storage (~/.myca/models)."""
        from pathlib import Path
        models_dir = Path("~/.myca/models").expanduser()
        if not models_dir.exists():
            return {"models": []}
        return {"models": [f.name for f in models_dir.glob("*.gguf")]}

    class ModelRequest(BaseModel):
        model: str

    @app.post("/settings/model")
    async def set_model(req: ModelRequest):
        os.environ["MYCA_MODEL"] = req.model
        return {"status": "ok", "active_model": req.model}
        
    class TrustRequest(BaseModel):
        node_id: str
        trusted: bool

    @app.post("/node/trust")
    async def set_node_trust(req: TrustRequest):
        # In a real app this would save to library.db trusted_nodes table
        # For now just emit event
        await broadcast_event("NODE_TRUST_CHANGED", {
            "type": "NODE_TRUST_CHANGED",
            "timestamp": time.time(),
            "node_id": req.node_id,
            "trusted": req.trusted
        })
        return {"status": "ok"}

    # ── Chat History Endpoints ────────────────────────────────

    @app.get("/history")
    async def history_list():
        """List all conversations, newest first."""
        return {"conversations": db.get_conversations(limit=100)}

    @app.get("/history/stats")
    async def history_stats():
        return db.get_stats()

    @app.get("/history/export")
    async def history_export():
        """Download full history as JSON."""
        import datetime
        data = db.export_all()
        date_str = datetime.date.today().isoformat()
        return JSONResponse(
            content=data,
            headers={
                "Content-Disposition": f'attachment; filename="myca-backup-{date_str}.json"'
            },
        )

    @app.post("/history/import")
    async def history_import(file: UploadFile = File(...)):
        """Import a backup JSON file (merges, no duplicates)."""
        content = await file.read()
        data = json.loads(content)
        db.import_backup(data)
        return {"status": "imported", "conversations": len(data.get("conversations", []))}

    @app.get("/history/{conv_id}")
    async def history_detail(conv_id: str):
        """Return all messages in a conversation."""
        return {"messages": db.get_messages(conv_id)}

    @app.delete("/history")
    async def history_delete(confirm: str = ""):
        """Delete all history. Requires ?confirm=yes."""
        if confirm != "yes":
            return JSONResponse(status_code=400,
                                content={"error": "Add ?confirm=yes to delete all history"})
        db.delete_all_history()
        return {"status": "deleted"}

    @app.delete("/history/{conv_id}")
    async def history_delete_conv(conv_id: str):
        db.delete_conversation(conv_id)
        return {"status": "deleted"}



    import sys
    from fastapi.staticfiles import StaticFiles
    
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        # Running as compiled PyInstaller executable
        dist_dir = os.path.join(sys._MEIPASS, "frontend", "dist")
    else:
        dist_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
        
    if os.path.exists(dist_dir):
        app.mount("/", StaticFiles(directory=dist_dir, html=True), name="static")
    else:
        logger.warning(f"Frontend dist not found at {dist_dir}. Run 'npm run build' in frontend/")

    return app
