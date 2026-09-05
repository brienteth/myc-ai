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

from myca.contracts.execution import ExecutionGraph, ExecutionNode, NodeState
from myca.execution.event_bus import ExecutionEventBus, EventType, ExecutionEvent
from myca.execution.cache import ExecutionCache, is_cacheable, global_execution_cache
from myca.skills.core.result import SkillResult

logger = logging.getLogger("myca.execution.scheduler")


class ExecutionScheduler:
    """
    OS-level task scheduler for Execution DAGs.
    Replaces naive sequential execution with topology-aware parallel scheduling.
    """

    def __init__(self, event_bus: Optional[ExecutionEventBus] = None, cache: Optional[ExecutionCache] = None, policy_engine: Optional[Any] = None):
        self.event_bus = event_bus or ExecutionEventBus()
        self.cache = cache or global_execution_cache
        from myca.execution.policies import SecurityPolicyEngine
        self.policy_engine = policy_engine or SecurityPolicyEngine()

    async def run(self, graph: ExecutionGraph, ctx: Any, workflow_id: str = "wf-unknown") -> bool:
        """
        Execute an entire DAG with parallel fan-out, barrier sync, and caching.
        """
        start = time.time()
        nodes = graph.nodes
        
        # Load checkpoints for event-sourced recovery
        from myca.database import get_checkpoints, save_checkpoint
        checkpoints = get_checkpoints(workflow_id)
        logger.info(f"[SCHEDULER] Loaded {len(checkpoints)} checkpoints for workflow '{workflow_id}'")
        
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

        # P0.3: Run capability scheduling to assign nodes to devices dynamically
        runtime = getattr(ctx, "runtime", None) or getattr(ctx, "_runtime", None)
        if runtime and hasattr(runtime, "node"):
            node_instance = runtime.node
            cap_scheduler = CapabilityScheduler(node_instance.device_registry)
            cap_scheduler.schedule(graph)

        async def run_node(node_id: str) -> bool:
            node = nodes[node_id]
            
            # ── Check checkpoints for event-sourced recovery ──
            if node_id in checkpoints:
                ckpt = checkpoints[node_id]
                if ckpt["status"] == "completed":
                    logger.info(f"[SCHEDULER] Node '{node_id}' resumed from checkpoint.")
                    node.result = SkillResult(success=True, outputs=ckpt["outputs"])
                    node.status = NodeState.COMPLETED
                    await self._emit_node_event(EventType.NODE_COMPLETED, workflow_id, node, {"from_checkpoint": True})
                    return True

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
                    node.result = SkillResult(success=True, outputs=cached)
                    node.status = NodeState.COMPLETED
                    await self._emit_node_event(EventType.NODE_COMPLETED, workflow_id, node,
                                                 {"from_cache": True})
                    return True

            # ── Check Policy Approval ──
            approved = await self.policy_engine.verify_approval(node.id, node.skill_name, node.inputs)
            if not approved:
                node.status = NodeState.FAILED
                await self._emit_node_event(EventType.NODE_FAILED, workflow_id, node,
                                             {"reason": "blocked by security policy"})
                return False

            # ── Execute ──
            node_start_time = time.time()
            node.status = NodeState.RUNNING
            await self._emit_node_event(EventType.NODE_RUNNING, workflow_id, node)

            # P0.3 Remote routing integration
            assigned_device_id = getattr(node, "assigned_device_id", None)
            local_device_id = None
            node_instance = None
            runtime = getattr(ctx, "runtime", None) or getattr(ctx, "_runtime", None)
            if runtime and hasattr(runtime, "node"):
                node_instance = runtime.node
                local_device_id = node_instance.node_id

            is_remote = assigned_device_id and assigned_device_id != local_device_id
            
            if is_remote and node_instance:
                success = await self._route_node_execution_to_remote(node, ctx, assigned_device_id, nodes)
            else:
                success = await graph._execute_node(node, ctx)

            if success:
                node.status = NodeState.COMPLETED
                await self._emit_node_event(EventType.NODE_COMPLETED, workflow_id, node)
                # Store in cache
                if is_cacheable(node.skill_name):
                    outputs = node.result.outputs if node.result else {}
                    cache_key = self.cache.make_key(node.skill_name, node.inputs)
                    self.cache.put(cache_key, outputs, skill_id=node.skill_name)
            else:
                node.status = NodeState.FAILED
                await self._emit_node_event(EventType.NODE_FAILED, workflow_id, node)

            # Log audit ledger entry
            node_latency_ms = (time.time() - node_start_time) * 1000
            estimated_cost = 0.0
            if node.skill_name == "local_llm.inference" and not is_remote:
                import os
                if "zgcompute" in os.getenv("MYCA_BACKEND", "").lower() or os.getenv("ZG_COMPUTE_API_KEY"):
                    estimated_cost = 0.002

            try:
                from myca.database import add_audit_entry
                add_audit_entry(
                    workflow_id=workflow_id,
                    node_id=node.id,
                    skill_id=node.skill_name,
                    device_id=assigned_device_id,
                    model_name="auto",
                    inputs=node.inputs,
                    outputs=node.result.outputs if node.result else {},
                    success=success,
                    cost=estimated_cost,
                    latency_ms=node_latency_ms
                )
            except Exception as e:
                logger.error(f"[SCHEDULER] Failed to write audit ledger: {e}")

            # Save checkpoint for event-sourced recovery
            try:
                save_checkpoint(
                    workflow_id=workflow_id,
                    node_id=node.id,
                    status=node.status.value if isinstance(node.status, NodeState) else str(node.status),
                    outputs=node.result.outputs if node.result else {}
                )
            except Exception as e:
                logger.error(f"[SCHEDULER] Failed to save checkpoint for {node.id}: {e}")

            return success

        def get_or_create(node_id: str) -> asyncio.Task:
            if node_id not in node_tasks:
                node_tasks[node_id] = asyncio.create_task(run_node(node_id))
            return node_tasks[node_id]

        # ── Launch all root nodes in parallel (fan-out) ──
        all_tasks = [get_or_create(nid) for nid in nodes]
        results = await asyncio.gather(*all_tasks, return_exceptions=True)
        overall = all(r is True for r in results) and not any(isinstance(r, Exception) for r in results)

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

    async def _route_node_execution_to_remote(self, node: ExecutionNode, ctx, remote_node_id: str, all_nodes: dict) -> bool:
        """
        Serialize inputs, wrap in TransportEnvelope, and execute the task on a remote device.
        """
        runtime = getattr(ctx, "runtime", None) or getattr(ctx, "_runtime", None)
        node_instance = runtime.node if runtime else None
        if not node_instance:
            logger.error("[SCHEDULER] Cannot route remote task: no runtime node instance found in context.")
            return False
        resolved_inputs = dict(node.inputs)
        # Resolve NodeReference objects
        for k, ref in node.references.items():
            resolved_inputs[k] = ref.resolve(all_nodes)

        payload = {
            "type": "execute_task",
            "skill": node.skill_name,
            "inputs": resolved_inputs,
        }

        # Send via ConnectionManager (which signs/encrypts automatically via TransportEnvelope)
        await node_instance.connection.send_message(remote_node_id, payload)

        if node_instance.simulate:
            # Poll for response on queue
            response = await node_instance.connection.receive_message(remote_node_id, timeout=10.0)
            if response and response.get("type") == "execute_task_result":
                success = response.get("success", False)
                outputs = response.get("outputs", {})
                node.result = SkillResult(success=success, outputs=outputs)
                return success
            else:
                logger.error(f"[SCHEDULER] Remote task execution timeout or invalid response from {remote_node_id}")
                node.result = SkillResult(success=False, outputs={"error": "Remote execution timeout or invalid response"})
                return False
        else:
            # Real network mode: perform signed/encrypted HTTP POST request to peer REST API
            try:
                peer = next((p for p in node_instance.discovery.get_active_peers() if p.node_id == remote_node_id), None)
                if peer:
                    import httpx
                    from myca.transport import create_envelope, receive_envelope
                    from myca.identity import get_or_create_identity_key
                    private_key = get_or_create_identity_key()
                    
                    envelope = create_envelope(
                        sender=node_instance.node_id,
                        recipient=remote_node_id,
                        payload=payload,
                        private_key=private_key,
                        crypto=node_instance.crypto
                    )
                    
                    url = f"http://{peer.host}:{peer.port}/api/execute"
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        resp = await client.post(url, json=envelope.to_dict())
                        if resp.status_code == 200:
                            resp_data = resp.json()
                            peer_pub = peer.public_key or ""
                            res_payload, status = receive_envelope(
                                data=resp_data,
                                sender_public_key_hex=peer_pub,
                                expected_recipient=node_instance.node_id,
                                crypto=node_instance.crypto
                            )
                            if res_payload and res_payload.get("type") == "execute_task_result":
                                success = res_payload.get("success", False)
                                outputs = res_payload.get("outputs", {})
                                node.result = SkillResult(success=success, outputs=outputs)
                                return success
            except Exception as e:
                logger.error(f"[SCHEDULER] Remote HTTP execution failed for {remote_node_id}: {e}")
                
            node.result = SkillResult(success=False, outputs={"error": f"Remote network execution failed for {remote_node_id}"})
            return False


class CapabilityScheduler:
    """
    Capability-based task scheduler.
    Assigns each node in an ExecutionGraph to the best available and TRUSTED device
    in the Colony registry based on required capabilities.
    """
    
    # Map of skills to their required hardware/software capability IDs
    SKILL_CAPABILITY_MAP = {
        "camera.capture": "camera.capture",
        "camera.read": "camera.capture",
        "camera.take_photo": "camera.capture",
        "microphone.capture": "microphone.capture",
        "microphone.read": "microphone.capture",
        "fs.read": "filesystem.read",
        "fs.write": "filesystem.write",
        "filesystem.read": "filesystem.read",
        "filesystem.write": "filesystem.write",
        "storage.read": "storage.read",
        "storage.write": "storage.write",
        "ai.inference": "local_llm.inference",
        "local_llm.inference": "local_llm.inference",
        "vision.analyze": "vision.analyze",
        "vision.extract": "vision.analyze",
        "browser.navigate": "browser.navigate",
        "browser.scrape": "browser.navigate",
        "vault.read": "vault.read",
        "vault.write": "vault.write",
        "telegram.send": "telegram.send",
        "telegram.send_message": "telegram.send",
        "email.send": "email.send",
    }

    def __init__(self, device_registry):
        self.registry = device_registry

    def schedule(self, graph: ExecutionGraph) -> Dict[str, str]:
        """
        Resolve device assignments for all nodes in the graph dynamically.
        Returns a dictionary of node_id -> assigned_device_id.
        """
        assignments = {}
        for node_id, node in graph.nodes.items():
            skill = node.skill_name
            capability_id = self.SKILL_CAPABILITY_MAP.get(skill)
            
            # Resolve pattern-based fallbacks
            if not capability_id:
                if skill.startswith("fs.") or skill.startswith("filesystem."):
                    capability_id = "filesystem.read" if "read" in skill else "filesystem.write"
                elif skill.startswith("camera."):
                    capability_id = "camera.capture"
                elif skill.startswith("vision."):
                    capability_id = "vision.analyze"
                elif skill.startswith("telegram."):
                    capability_id = "telegram.send"
                else:
                    capability_id = "gpu.compute"

            # Query candidate devices from registry
            candidates = self.registry.find_devices_with_capability(capability_id)
            
            if not candidates:
                # Fallback to local device
                local_device = self.registry.get_local_device()
                assigned_id = local_device.device_id if local_device else "local"
            else:
                # Prioritize local device if it supports it; otherwise pick the first trusted candidate
                local_candidate = next((c for c in candidates if c.is_self), None)
                if local_candidate:
                    assigned_id = local_candidate.device_id
                else:
                    # Filter candidates by trust state TRUSTED
                    from myca.contracts.device import TrustState
                    trusted_candidates = [c for c in candidates if c.trust_state == TrustState.TRUSTED]
                    if trusted_candidates:
                        assigned_id = trusted_candidates[0].device_id
                    else:
                        assigned_id = candidates[0].device_id
            
            node.assigned_device_id = assigned_id
            assignments[node_id] = assigned_id
            logger.info(f"[SCHEDULER] Dynamically assigned step '{node_id}' ({skill}) to device '{assigned_id}' (capability: '{capability_id}')")
            
        return assignments

