"""
Skill Context
The OS-level API provided to every executing skill.
Skills must not access global singletons; they use this context.
"""
import asyncio
import logging
from typing import Any, Dict
from .result import SkillResult

logger = logging.getLogger("myca.skills.context")

class SkillContext:
    def __init__(
        self,
        need_id: str,
        runtime: Any,
        memory: Any,
        capabilities: Any,
        permissions: Any
    ):
        self.need_id = need_id
        
        # References to core OS services
        self._runtime = runtime
        self._memory = memory
        self._capabilities = capabilities
        self._permissions = permissions
        
        # Execution State
        self._is_cancelled = False
        self._logs: list[str] = []
        self._artifacts: list[str] = []

    # --- OS Services ---
    @property
    def storage(self):
        return self._memory

    # --- Telemetry & Events ---
    def emit(self, event_type: str, payload: dict = None):
        """Emits a standard SkillEvent to the OS and telemetry layers."""
        import time
        from myca.skills.core.abi import SkillEvent
        
        # Validate that event_type is one of the standard ones
        valid_types = {
            "Started", "Progress", "Log", "Artifact", "Metric", 
            "Warning", "Recovery", "Completed", "Cancelled", "Failed"
        }
        if event_type not in valid_types and not event_type.startswith("lifecycle."):
            logger.warning(f"Non-standard event type emitted: {event_type}")
            
        event = SkillEvent(
            event_type=event_type,
            need_id=self.need_id,
            skill_id="unknown",  # Will be enriched by Lifecycle runner
            timestamp=time.time(),
            payload=payload or {}
        )
        
        # Log event locally
        self._logs.append(f"[{event_type}] {payload}")
        logger.info(f"[SkillEvent] {event_type}: {payload}")
        
        # Broadcast via runtime
        if hasattr(self._runtime, "node") and self._runtime.node.event_callback:
            # Broadcast asynchronously
            asyncio.create_task(
                self._runtime.node.event_callback(
                    f"SKILL_{event_type.upper()}", 
                    event.model_dump()
                )
            )

    def progress(self, percent: float):
        """Emits a Progress event."""
        self.emit("Progress", {"percent": percent})
        
    def log(self, message: str):
        self.emit("Log", {"message": message})

    def warn(self, message: str):
        self.emit("Warning", {"message": message})

    def add_artifact(self, artifact_id: str, art_type: str, mime: str, path: str, file_hash: str, size: int, preview: str = None) -> Any:
        """Create and emit a first-class Artifact."""
        import time
        from myca.skills.core.abi import Artifact
        
        art = Artifact(
            id=artifact_id,
            type=art_type,
            mime=mime,
            path=path,
            hash=file_hash,
            size=size,
            preview=preview,
            created_at=time.time()
        )
        self._artifacts.append(art.id)
        self.emit("Artifact", art.model_dump())
        return art

    # --- Execution Control ---
    def cancel(self):
        self._is_cancelled = True
        self.emit("Cancelled", {"reason": "User or OS requested cancellation"})

    async def check_cancel(self):
        """Skills should yield/await this frequently."""
        if self._is_cancelled:
            raise asyncio.CancelledError("Skill execution cancelled by user/OS.")
            
    # --- Composition ---
    async def execute(self, skill_id: str, **kwargs) -> SkillResult:
        """Call another skill synchronously within this context."""
        self.log(f"Composing sub-skill: {skill_id}")
        from .registry import SkillRegistry
        return await SkillRegistry.execute(self, skill_id, **kwargs)
