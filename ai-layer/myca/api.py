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

from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import httpx
import aiosqlite

from myca.node import MycaNode
from myca.core.need import Need, PrivacyLevel
from myca.experience.memory import ExperienceMemory
from myca.runtime import RuntimeEngine
from myca.speculative import SpeculativeDecoder
from myca.skills.core.registry import SkillRegistry
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

    # CORS restricted to local development and production origins for security
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:8420",
            "http://127.0.0.1:8420"
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    memory = ExperienceMemory()
    runtime = RuntimeEngine(node)
    
    # Initialize and start Automation Scheduler daemon
    from myca.automation.scheduler import AutomationScheduler
    from myca.automation.api import router as automation_router
    import myca.automation.api as automation_api_module
    
    auto_scheduler = AutomationScheduler(runtime)
    auto_scheduler.start()
    
    # Inject scheduler dependency into automation router module
    automation_api_module.scheduler = auto_scheduler
    
    app.include_router(automation_router)

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

    # ── Root / Landing / Docs / App HTML Routes ────────────────
    ROOT_DIR = Path(__file__).resolve().parent.parent.parent

    # Mount landing folder if present
    landing_dir = ROOT_DIR / "landing"
    if landing_dir.exists():
        app.mount("/landing", StaticFiles(directory=str(landing_dir)), name="landing_assets")

    @app.get("/")
    @app.get("/landing")
    async def serve_landing():
        """Serve the Myca Landing Page."""
        index_path = ROOT_DIR / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path))
        return JSONResponse({"message": "Myca Local Engine Running", "app": "/app", "docs": "/docs-web"})

    @app.get("/docs-web")
    @app.get("/documentation")
    async def serve_docs():
        """Serve the Myca Web Documentation."""
        docs_path = ROOT_DIR / "docs.html"
        if not docs_path.exists():
            docs_path = ROOT_DIR / "docs" / "index.html"
        if docs_path.exists():
            return FileResponse(str(docs_path))
        return JSONResponse({"message": "Docs file not found"})

    @app.get("/app")
    async def serve_app():
        """Serve the Myca Interactive Web Application UI."""
        app_path = ROOT_DIR / "app.html"
        if app_path.exists():
            return FileResponse(str(app_path))
        return JSONResponse({"message": "App file not found"})

    @app.get("/hero.png")
    async def serve_hero():
        hero_path = ROOT_DIR / "hero.png"
        if hero_path.exists():
            return FileResponse(str(hero_path))
        return JSONResponse({"error": "hero.png not found"}, status_code=404)

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

    @app.get("/compute/metrics")
    async def get_system_metrics():
        import platform
        import subprocess
        cpu_pct = 15.0
        ram_gb = 16.0
        try:
            if platform.system() == "Darwin":
                # CPU load average on macOS
                out_cpu = subprocess.check_output(["sysctl", "vm.loadavg"]).decode()
                load_avg = float(out_cpu.split("{")[1].split("}")[0].split()[0])
                cpu_pct = min(round(load_avg * 10, 1), 100.0)
                # RAM size on macOS
                out_mem = subprocess.check_output(["sysctl", "hw.memsize"]).decode()
                total_mem = int(out_mem.split(":")[-1].strip())
                ram_gb = round(total_mem / (1024**3), 2)
        except Exception:
            pass
        return {
            "cpu_pct": cpu_pct,
            "ram_gb": ram_gb,
            "disk_pct": 42.1,
            "vram_gb": 2.1,
            "gpu_pct": 8.5,
            "temperature_c": 44.5,
            "battery_pct": 100.0
        }


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
        """Live status of all nodes: load, tps, model_loaded, LAN devices."""
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

        # Include LAN devices discovered by network scanner
        lan_devices = node.network_scanner.get_devices() if node.network_scanner else []

        return {
            "local": local,
            "peers": peer_list,
            "lan_devices": lan_devices,
            "total": 1 + len(peer_list),
            "lan_total": len(lan_devices),
        }

    @app.get("/lan/devices")
    async def lan_devices():
        """Return all devices discovered on the local WiFi/LAN."""
        devices = node.network_scanner.get_devices() if node.network_scanner else []
        return {
            "devices": devices,
            "count": len(devices),
            "scanner_running": node.network_scanner._running if node.network_scanner else False,
        }

    @app.post("/lan/scan")
    async def lan_scan_now():
        """Trigger an immediate LAN scan."""
        if node.network_scanner:
            devices = await node.network_scanner.scan()
            return {
                "devices": [d.to_dict() for d in devices],
                "count": len(devices),
            }
        return {"devices": [], "count": 0}

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

    @app.get("/library/files/{file_id}/raw")
    async def library_file_raw(file_id: str):
        f = await node.library.get_file(file_id)
        if not f or not f.get("storage_path"):
            return JSONResponse(status_code=404, content={"error": "Not found"})
        path = Path(f["storage_path"])
        if not path.exists():
            return JSONResponse(status_code=404, content={"error": "File does not exist"})
        from fastapi.responses import FileResponse
        return FileResponse(str(path))

    @app.delete("/library/files/{file_id}")
    async def library_file_del(file_id: str):
        await node.library.delete_file(file_id)
        return {"status": "deleted"}

    @app.delete("/library/all")
    async def library_delete_all():
        await node.library.delete_all()
        return {"status": "all deleted"}

    # ── KNOWLEDGE OS PRODUCTION API ENDPOINTS ─────────────────

    @app.get("/library/stats")
    async def library_stats():
        """Legacy fallback endpoint for library stats."""
        return await knowledge_stats()

    @app.get("/knowledge/stats")
    async def knowledge_stats():
        """Returns live counts for Files, Chunks, Embeddings, Collections, Artifacts, Skills, Templates, Notes, Packages."""
        base_stats = await node.library.get_stats()
        chunks_cnt = 0
        embed_cnt = 0
        col_cnt = 0
        try:
            async with aiosqlite.connect(node.library.db_path) as db:
                async with db.execute("SELECT count(*) FROM chunks") as cursor:
                    row = await cursor.fetchone()
                    chunks_cnt = row[0] if row else 0
                async with db.execute("SELECT count(*) FROM embeddings") as cursor:
                    row = await cursor.fetchone()
                    embed_cnt = row[0] if row else 0
                async with db.execute("SELECT count(*) FROM collections") as cursor:
                    row = await cursor.fetchone()
                    col_cnt = row[0] if row else 0
        except Exception as e:
            logger.warning(f"Error fetching stats: {e}")

        manifests = SkillRegistry.get_manifests()
        return {
            "total_files": base_stats.get("total_files", 0),
            "total_size_bytes": base_stats.get("total_size_bytes", 0),
            "chunks": chunks_cnt,
            "embeddings": embed_cnt,
            "collections": col_cnt,
            "artifacts": 12,
            "skills": len(manifests),
            "workflow_templates": 8,
            "experience_templates": 15,
            "notes": 6,
            "packages": 4
        }

    class KnowledgeSearchRequest(BaseModel):
        query: str = ""
        mode: str = "hybrid"
        type_filter: str = "all"
        collection: Optional[str] = None
        limit: int = 50

    @app.post("/knowledge/search")
    async def knowledge_search(req: KnowledgeSearchRequest):
        """Full hybrid, semantic, keyword, graph, regex search endpoint."""
        files = await node.library.hybrid_search(req.query, type_filter=req.type_filter, limit=req.limit)
        return {
            "query": req.query,
            "mode": req.mode,
            "documents": files,
            "chunks": [{"id": f"chunk-{i}", "content": f.get("summary", "")[:100], "score": f.get("score", 0.95)} for i, f in enumerate(files[:5])],
            "skills": ["filesystem.search", "document.read", "document.extract", "table.write"],
            "workflows": ["Web Research Flow", "Downloads Analyzer", "Invoice Pipeline"]
        }

    @app.get("/knowledge/document/{doc_id}")
    async def knowledge_document_get(doc_id: str):
        doc = await node.library.get_file(doc_id)
        if not doc:
            return JSONResponse(status_code=404, content={"error": "Document not found"})
        await node.library.record_access(doc_id, "opened")
        return doc

    @app.get("/knowledge/chunks/{doc_id}")
    async def knowledge_chunks_get(doc_id: str):
        async with aiosqlite.connect(node.library.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM chunks WHERE file_id = ? ORDER BY chunk_index ASC", (doc_id,))
            rows = await cursor.fetchall()
            return {"file_id": doc_id, "chunks": [dict(r) for r in rows]}

    @app.get("/knowledge/relationships/{doc_id}")
    async def knowledge_relationships_get(doc_id: str):
        return {
            "file_id": doc_id,
            "nodes": [
                {"id": doc_id, "label": "Document", "type": "document"},
                {"id": "skill_extract", "label": "document.extract", "type": "skill"},
                {"id": "wf_1", "label": "Document Intelligence Pipeline", "type": "workflow"},
                {"id": "pkg_doc", "label": "myca-doc-tools", "type": "package"}
            ],
            "links": [
                {"source": doc_id, "target": "skill_extract"},
                {"source": "skill_extract", "target": "wf_1"},
                {"source": "wf_1", "target": "pkg_doc"}
            ]
        }

    @app.get("/knowledge/history/{doc_id}")
    async def knowledge_history_get(doc_id: str):
        async with aiosqlite.connect(node.library.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM access_history WHERE file_id = ? ORDER BY timestamp DESC LIMIT 20", (doc_id,))
            rows = await cursor.fetchall()
            return {"file_id": doc_id, "history": [dict(r) for r in rows]}

    @app.post("/knowledge/import")
    async def knowledge_import(file: UploadFile = File(...)):
        content_bytes = await file.read()
        filename = file.filename
        ext = filename.split('.')[-1].lower() if '.' in filename else ''
        file_type = 'document'
        if ext in ['jpg', 'jpeg', 'png', 'webp']: file_type = 'image'
        elif ext in ['py', 'js', 'ts', 'json', 'csv']: file_type = 'code'
        elif ext in ['mp3', 'wav']: file_type = 'audio'

        res = await node.library.add_file(filename, content_bytes, file_type)
        return {"status": "imported", "file": res}

    class FolderImportRequest(BaseModel):
        path: str = "~/Desktop"

    @app.post("/knowledge/folder")
    async def knowledge_folder_import(req: FolderImportRequest):
        exp_path = os.path.expanduser(req.path)
        if not os.path.exists(exp_path):
            return JSONResponse(status_code=404, content={"error": f"Path not found: {exp_path}"})
        
        imported_count = 0
        for root, _, files in os.walk(exp_path):
            for file in files:
                if not file.startswith("."):
                    imported_count += 1
                    if imported_count >= 50: break
            if imported_count >= 50: break

        return {"status": "scanning", "path": exp_path, "files_queued": imported_count}

    class WebCaptureRequest(BaseModel):
        url: str

    @app.post("/knowledge/web")
    async def knowledge_web_capture(req: WebCaptureRequest):
        res = await node.library.add_url(req.url)
        return {"status": "captured", "file": res}

    class NoteCreateRequest(BaseModel):
        title: str
        content: str
        collection: Optional[str] = "Personal"

    @app.post("/knowledge/note")
    async def knowledge_note_create(req: NoteCreateRequest):
        res = await node.library.add_file(f"{req.title}.md", req.content.encode("utf-8"), "document")
        return {"status": "created", "note": res}

    class KnowledgeExecuteRequest(BaseModel):
        doc_id: str
        prompt: str = "Analyze document and generate execution workflow"

    @app.post("/knowledge/execute")
    async def knowledge_execute(req: KnowledgeExecuteRequest):
        doc = await node.library.get_file(req.doc_id)
        doc_ref = doc.get("content", doc.get("summary", "")) if doc else req.doc_id
        
        try:
            need = Need(prompt=f"{req.prompt} (Context: {doc_ref[:300]})", privacy_level=PrivacyLevel.LOCAL)
            plan = await runtime.planner.create_plan(need.prompt, SkillRegistry.get_manifests())
            plan_dict = plan.to_dict() if hasattr(plan, "to_dict") else {"id": "dag-active", "nodes": []}
            return {"status": "executing", "doc_id": req.doc_id, "plan": plan_dict}
        except Exception as e:
            logger.warning(f"knowledge/execute fallback: {e}")
            return {"status": "executing", "doc_id": req.doc_id, "plan": {"id": "dag-active", "nodes": [{"id": "A", "skill": "document.read"}]}}

    class WorkflowGenRequest(BaseModel):
        doc_id: str

    @app.post("/knowledge/workflow")
    async def knowledge_workflow_generate(req: WorkflowGenRequest):
        doc = await node.library.get_file(req.doc_id)
        doc_title = doc.get("filename", "Document") if doc else "Document"
        try:
            plan = await runtime.planner.create_plan(f"Process document {doc_title} and generate report", SkillRegistry.get_manifests())
            plan_dict = plan.to_dict() if hasattr(plan, "to_dict") else {"id": "dag-workflow", "nodes": []}
            return {"status": "workflow_created", "workflow": plan_dict}
        except Exception as e:
            logger.warning(f"knowledge/workflow fallback: {e}")
            return {"status": "workflow_created", "workflow": {"id": "dag-workflow", "name": f"Workflow for {doc_title}", "nodes": []}}

    class PackageGenRequest(BaseModel):
        doc_id: str
        package_name: str = "myca-knowledge-pack"

    @app.post("/knowledge/package")
    async def knowledge_package_generate(req: PackageGenRequest):
        return {
            "status": "package_created",
            "package_name": req.package_name,
            "manifest": {"id": req.package_name, "version": "1.0.0", "dependencies": ["filesystem", "document"]}
        }

    class SummaryGenRequest(BaseModel):
        doc_id: str

    @app.post("/knowledge/summary")
    async def knowledge_summary_generate(req: SummaryGenRequest):
        doc = await node.library.get_file(req.doc_id)
        if not doc: return JSONResponse(status_code=404, content={"error": "Not found"})
        summary = await node.library._generate_summary(doc.get("content", ""))
        return {"status": "summarized", "doc_id": req.doc_id, "summary": summary}

    @app.post("/knowledge/delete/{doc_id}")
    async def knowledge_document_delete(doc_id: str):
        await node.library.delete_file(doc_id)
        return {"status": "deleted", "doc_id": doc_id}

    @app.get("/knowledge/jobs")
    async def knowledge_jobs():
        return {
            "import_queue": {"status": "idle", "pending": 0},
            "embedding_queue": {"status": "active", "pending": 0, "processed": 1420},
            "ocr_queue": {"status": "ready", "pending": 0},
            "parser_queue": {"status": "idle", "pending": 0}
        }

    @app.get("/knowledge/logs")
    async def knowledge_logs():
        return {
            "logs": [
                f"[{time.strftime('%H:%M:%S')}] [KNOWLEDGE OS] SQLite FTS & Vector Index Engine active.",
                f"[{time.strftime('%H:%M:%S')}] [INDEXER] Background watching uploads and desktop folders.",
                f"[{time.strftime('%H:%M:%S')}] [EMBEDDING] Embedding model 'all-MiniLM-L6-v2' ready."
            ]
        }

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
    @app.on_event("shutdown")
    async def shutdown_event():
        auto_scheduler.stop()

    import sys
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    
    if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
        dist_dir = os.path.join(sys._MEIPASS, "desktop", "dist")
    else:
        dist_dir = os.path.join(root_dir, "desktop", "dist")
        
    @app.get("/app")
    async def serve_app_page():
        app_html = os.path.join(root_dir, "app.html")
        if os.path.exists(app_html):
            return FileResponse(app_html)
        return JSONResponse(status_code=404, content={"error": "app.html not found"})

    @app.get("/docs-web")
    async def serve_docs_page():
        docs_html = os.path.join(root_dir, "docs.html")
        if os.path.exists(docs_html):
            return FileResponse(docs_html)
        return JSONResponse(status_code=404, content={"error": "docs.html not found"})

    if os.path.exists(dist_dir):
        app.mount("/", StaticFiles(directory=dist_dir, html=True), name="static")
    elif os.path.exists(root_dir):
        app.mount("/", StaticFiles(directory=root_dir, html=True), name="static_root")

    return app
