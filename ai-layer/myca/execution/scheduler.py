"""
Myca Execution Scheduler

NOT an "agent fleet" — a Task Scheduler.

Responsibilities:
  - Analyzes the DAG topology to discover independent (parallelizable) branches
  - Executes independent branches via asyncio.gather (Fan-out)
  - Waits at convergence points (Fan-in / Barrier)
  - Applies the Execution Cache before running each node
  - Emits lifecycle events to the Event Bus for every state transition

Topology example:
                Read
               / | \\
            OCR Meta Embed
               \\ | /
              Merge
"""

import asyncio
import time
import logging
from typing import Any, Dict, List, Optional, Set

from myca.planner.execution_graph import ExecutionGraph, ExecutionNode, NodeState
from myca.execution.event_bus import ExecutionEventBus, EventType, ExecutionEvent
from myca.execution.cache import ExecutionCache, is_cacheable

logger = logging.getLogger("myca.execution.scheduler")


class ExecutionScheduler:
    """
    OS-level task scheduler for Execution DAGs.
    Replaces naive sequential execution with topology-aware parallel scheduling.
    """

    def __init__(self, event_bus: Optional[ExecutionEventBus] = None, cache: Optional[ExecutionCache] = None):
        self.event_bus = event_bus or ExecutionEventBus()
        self.cache = cache or ExecutionCache()

    async def run(self, graph: ExecutionGraph, ctx: Any, workflow_id: str = "wf-unknown") -> bool:
        """
        Execute an entire DAG with parallel fan-out, barrier sync, and caching.
        """
        start = time.time()
        nodes = graph.nodes
        
        # Emit workflow start
        await self.event_bus.emit(ExecutionEvent(
            event_type=EventType.EXECUTION_STARTED,
            workflow_id=workflow_id,
            payload={"node_count": len(nodes)},
        ))

        # Set all to QUEUED
        for n in nodes.values():
            n.status = NodeState.QUEUED
            await self._emit_node_event(EventType.NODE_QUEUED, workflow_id, n)

        # Task registry (memoized)
        node_tasks: Dict[str, asyncio.Task] = {}

        async def run_node(node_id: str) -> bool:
            node = nodes[node_id]
            node.status = NodeState.SCHEDULED
            await self._emit_node_event(EventType.NODE_SCHEDULED, workflow_id, node)

            # ── Wait for dependencies (barrier) ──
            if node.dependencies:
                node.status = NodeState.WAITING
                await self._emit_node_event(EventType.NODE_WAITING, workflow_id, node)

                dep_tasks = [get_or_create(d) for d in node.dependencies]
                dep_results = await asyncio.gather(*dep_tasks, return_exceptions=True)

                for i, dep_id in enumerate(node.dependencies):
                    r = dep_results[i]
                    if isinstance(r, Exception) or r is False:
                        node.status = NodeState.FAILED
                        await self._emit_node_event(EventType.NODE_FAILED, workflow_id, node,
                                                     {"reason": f"dependency {dep_id} failed"})
                        return False
                    if nodes[dep_id].status != NodeState.COMPLETED:
                        node.status = NodeState.FAILED
                        await self._emit_node_event(EventType.NODE_FAILED, workflow_id, node,
                                                     {"reason": f"dependency {dep_id} not completed"})
                        return False

            # ── Cache check ──
            if is_cacheable(node.skill_name):
                cache_key = self.cache.make_key(node.skill_name, node.inputs)
                cached = self.cache.get(cache_key)
                if cached is not None:
                    await self.event_bus.emit(ExecutionEvent(
                        event_type=EventType.CACHE_HIT,
                        workflow_id=workflow_id,
                        node_id=node.id,
                        skill_id=node.skill_name,
                    ))
                    node.status = NodeState.COMPLETED
                    await self._emit_node_event(EventType.NODE_COMPLETED, workflow_id, node,
                                                 {"from_cache": True})
                    return True

            # ── Execute ──
            node.status = NodeState.RUNNING
            await self._emit_node_event(EventType.NODE_RUNNING, workflow_id, node)

            success = await graph._execute_node(node, ctx)

            if success:
                await self._emit_node_event(EventType.NODE_COMPLETED, workflow_id, node)
                # Store in cache
                if is_cacheable(node.skill_name):
                    outputs = node.result.outputs if node.result else {}
                    cache_key = self.cache.make_key(node.skill_name, node.inputs)
                    self.cache.put(cache_key, outputs, skill_id=node.skill_name)
            else:
                await self._emit_node_event(EventType.NODE_FAILED, workflow_id, node)

            return success

        def get_or_create(node_id: str) -> asyncio.Task:
            if node_id not in node_tasks:
                node_tasks[node_id] = asyncio.create_task(run_node(node_id))
            return node_tasks[node_id]

        # ── Launch all root nodes in parallel (fan-out) ──
        all_tasks = [get_or_create(nid) for nid in nodes]
        results = await asyncio.gather(*all_tasks, return_exceptions=True)
        overall = all(r is True for r in results if not isinstance(r, Exception))

        elapsed = (time.time() - start) * 1000

        # Emit workflow finish
        finish_type = EventType.EXECUTION_FINISHED if overall else EventType.EXECUTION_FAILED
        await self.event_bus.emit(ExecutionEvent(
            event_type=finish_type,
            workflow_id=workflow_id,
            payload={
                "success": overall,
                "elapsed_ms": round(elapsed, 2),
                "cache_stats": self.cache.stats(),
            },
        ))

        logger.info(f"[SCHEDULER] Workflow {workflow_id} finished in {elapsed:.1f}ms (success={overall})")
        return overall

    async def _emit_node_event(self, etype: EventType, wf_id: str, node: ExecutionNode,
                                extra: Optional[dict] = None):
        payload = {"status": node.status.value if isinstance(node.status, NodeState) else str(node.status)}
        if extra:
            payload.update(extra)
        await self.event_bus.emit(ExecutionEvent(
            event_type=etype,
            workflow_id=wf_id,
            node_id=node.id,
            skill_id=node.skill_name,
            payload=payload,
        ))
