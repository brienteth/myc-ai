"""
Universal Library Skills (Phase 2.4)
Declarative P2P OS skills exposed via the @skill decorator.
"""
import os
import subprocess
import sys
import logging
from myca.skills.core.decorator import skill

logger = logging.getLogger("myca.skills.packages.library")

@skill(
    id="library.search",
    version="1.0.0",
    permissions=["library"],
    inputs=["query", "type_filter"],
    outputs=["files"]
)
async def library_search(ctx, query: str, type_filter: str = "all") -> dict:
    ctx.emit("library.search.started", {"query": query, "type_filter": type_filter})
    library = ctx._runtime.node.library
    files = await library.hybrid_search(query, type_filter=type_filter)
    return {"files": files}

@skill(
    id="library.get",
    version="1.0.0",
    permissions=["library"],
    inputs=["file_id"],
    outputs=["file"]
)
async def library_get(ctx, file_id: str) -> dict:
    ctx.emit("library.get.started", {"file_id": file_id})
    library = ctx._runtime.node.library
    f = await library.get_file(file_id)
    if f:
        await library.record_access(file_id, "opened")
    return {"file": f}

@skill(
    id="library.index",
    version="1.0.0",
    permissions=["library", "fs"],
    inputs=["path"],
    outputs=["status"]
)
async def library_index(ctx, path: str) -> dict:
    from pathlib import Path
    ctx.emit("library.index.started", {"path": path})
    library = ctx._runtime.node.library
    
    file_path = Path(path)
    if not file_path.exists():
        return {"status": "error", "message": "Path not found"}
        
    if file_path.is_file():
        await library.indexer.process_file(file_path)
    else:
        # Queue folder files for indexing
        for item in file_path.iterdir():
            if item.is_file() and not item.name.startswith("."):
                await library.indexer.queue.put((item, "all"))
                
    return {"status": "queued"}

@skill(
    id="library.open",
    version="1.0.0",
    permissions=["library", "fs"],
    inputs=["file_id"],
    outputs=["status"]
)
async def library_open(ctx, file_id: str) -> dict:
    ctx.emit("library.open.started", {"file_id": file_id})
    library = ctx._runtime.node.library
    f = await library.get_file(file_id)
    if not f or not f.get("path"):
        return {"status": "error", "message": "File or disk path not found"}
        
    path = f["path"]
    try:
        # Cross-platform open
        if sys.platform == "win32":
            os.startfile(path)
        elif sys.platform == "darwin":
            subprocess.run(["open", path], check=True)
        else:
            subprocess.run(["xdg-open", path], check=True)
        await library.record_access(file_id, "opened")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to open file {path}: {e}")
        return {"status": "error", "message": str(e)}

@skill(
    id="library.delete",
    version="1.0.0",
    permissions=["library"],
    inputs=["file_id"],
    outputs=["status"]
)
async def library_delete(ctx, file_id: str) -> dict:
    ctx.emit("library.delete.started", {"file_id": file_id})
    library = ctx._runtime.node.library
    await library.delete_file(file_id)
    return {"status": "deleted"}

@skill(
    id="library.favorite",
    version="1.0.0",
    permissions=["library"],
    inputs=["file_id"],
    outputs=["favorite"]
)
async def library_favorite(ctx, file_id: str) -> dict:
    ctx.emit("library.favorite.started", {"file_id": file_id})
    library = ctx._runtime.node.library
    fav = await library.toggle_favorite(file_id)
    return {"favorite": fav}

@skill(
    id="library.history",
    version="1.0.0",
    permissions=["library"],
    inputs=[],
    outputs=["history"]
)
async def library_history(ctx) -> dict:
    library = ctx._runtime.node.library
    h = await library.get_recent(limit=20)
    return {"history": h}

@skill(
    id="library.metadata",
    version="1.0.0",
    permissions=["library"],
    inputs=["file_id"],
    outputs=["metadata"]
)
async def library_metadata(ctx, file_id: str) -> dict:
    import aiosqlite
    library = ctx._runtime.node.library
    meta = {}
    async with aiosqlite.connect(library.db_path) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT key, value FROM metadata WHERE file_id = ?", (file_id,)) as cursor:
            async for row in cursor:
                meta[row["key"]] = row["value"]
    return {"metadata": meta}

@skill(
    id="library.preview",
    version="1.0.0",
    permissions=["library"],
    inputs=["file_id"],
    outputs=["preview"]
)
async def library_preview(ctx, file_id: str) -> dict:
    library = ctx._runtime.node.library
    f = await library.get_file(file_id)
    if not f:
        return {"preview": "File not found"}
    # Send content excerpt up to 1000 chars as preview
    return {"preview": f.get("content", "")[:1000]}
