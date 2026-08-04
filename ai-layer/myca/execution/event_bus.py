"""
Myca Execution Event Bus

Central event backbone for the entire Execution OS.
All subsystems (Chat, Workflow, History, Timeline, Logs, UI) listen to the same event stream.

Event lifecycle per node:
  ExecutionStarted → NodeQueued → NodeScheduled → NodeRunning → NodeProgress →
  ArtifactCreated → NodeCompleted/NodeFailed → WorkflowFinished

Design:
  - Fully local, zero external dependencies
  - asyncio-native pub/sub with typed events
  - WebSocket bridge for UI (injected by api.py)
"""

import asyncio
import time
import logging
from enum import Enum
from typing import Any, Callable, Coroutine, Dict, List, Optional
from dataclasses import dataclass, field

logger = logging.getLogger("myca.execution.event_bus")


class EventType(str, Enum):
    # Workflow-level
    EXECUTION_STARTED = "execution.started"
    EXECUTION_FINISHED = "execution.finished"
    EXECUTION_FAILED = "execution.failed"

    # Node-level (matches NodeState transitions)
    NODE_CREATED = "node.created"
    NODE_QUEUED = "node.queued"
    NODE_SCHEDULED = "node.scheduled"
    NODE_RUNNING = "node.running"
    NODE_WAITING = "node.waiting"
    NODE_RETRYING = "node.retrying"
    NODE_PAUSED = "node.paused"
    NODE_COMPLETED = "node.completed"
    NODE_FAILED = "node.failed"
    NODE_CANCELLED = "node.cancelled"

    # Skill ABI streaming
    SKILL_STARTED = "skill.started"
    SKILL_PROGRESS = "skill.progress"
    SKILL_CHUNK = "skill.chunk"
    SKILL_ARTIFACT = "skill.artifact"
    SKILL_COMPLETED = "skill.completed"

    # Artifact lifecycle
    ARTIFACT_CREATED = "artifact.created"
    ARTIFACT_CACHED = "artifact.cached"

    # Verifier
    VERIFIER_PASSED = "verifier.passed"
    VERIFIER_FAILED = "verifier.failed"

    # System
    CACHE_HIT = "cache.hit"
    CACHE_MISS = "cache.miss"


@dataclass
class ExecutionEvent:
    """Immutable event record flowing through the bus."""
    event_type: EventType
    workflow_id: str
    node_id: Optional[str] = None
    skill_id: Optional[str] = None
    payload: Dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "event_type": self.event_type.value,
            "workflow_id": self.workflow_id,
            "node_id": self.node_id,
            "skill_id": self.skill_id,
            "payload": self.payload,
            "timestamp": self.timestamp,
        }


# Type alias for subscriber callbacks
Subscriber = Callable[[ExecutionEvent], Coroutine[Any, Any, None]]


class ExecutionEventBus:
    """
    Singleton-style, asyncio-native pub/sub event bus.
    
    Usage:
        bus = ExecutionEventBus()
        bus.subscribe(EventType.NODE_COMPLETED, my_handler)
        await bus.emit(ExecutionEvent(event_type=EventType.NODE_COMPLETED, ...))
    """

    _instance: Optional["ExecutionEventBus"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._subscribers: Dict[EventType, List[Subscriber]] = {}
            cls._instance._wildcard_subscribers: List[Subscriber] = []
            cls._instance._history: List[ExecutionEvent] = []
            cls._instance._max_history = 500
        return cls._instance

    # ── Subscribe ──────────────────────────────────────────────
    def subscribe(self, event_type: EventType, callback: Subscriber):
        """Subscribe to a specific event type."""
        self._subscribers.setdefault(event_type, []).append(callback)

    def subscribe_all(self, callback: Subscriber):
        """Subscribe to ALL events (wildcard). Used by UI WebSocket bridge, Timeline, Logs."""
        self._wildcard_subscribers.append(callback)

    def unsubscribe(self, event_type: EventType, callback: Subscriber):
        subs = self._subscribers.get(event_type, [])
        if callback in subs:
            subs.remove(callback)

    def unsubscribe_all(self, callback: Subscriber):
        if callback in self._wildcard_subscribers:
            self._wildcard_subscribers.remove(callback)

    # ── Emit ───────────────────────────────────────────────────
    async def emit(self, event: ExecutionEvent):
        """Emit an event to all matching subscribers."""
        logger.debug(f"[EVENT BUS] {event.event_type.value} | node={event.node_id} wf={event.workflow_id}")

        # Store in ring buffer history
        self._history.append(event)
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]

        # Deliver to type-specific subscribers
        tasks = []
        for cb in self._subscribers.get(event.event_type, []):
            tasks.append(self._safe_call(cb, event))

        # Deliver to wildcard subscribers
        for cb in self._wildcard_subscribers:
            tasks.append(self._safe_call(cb, event))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _safe_call(self, cb: Subscriber, event: ExecutionEvent):
        try:
            await cb(event)
        except Exception as e:
            logger.error(f"[EVENT BUS] Subscriber error: {e}")

    # ── Query ──────────────────────────────────────────────────
    def get_history(self, workflow_id: Optional[str] = None, limit: int = 50) -> List[dict]:
        """Return recent event history, optionally filtered by workflow."""
        events = self._history
        if workflow_id:
            events = [e for e in events if e.workflow_id == workflow_id]
        return [e.to_dict() for e in events[-limit:]]

    def reset(self):
        """Clear all subscribers and history (used in tests)."""
        self._subscribers.clear()
        self._wildcard_subscribers.clear()
        self._history.clear()
