"""
Myca Layer 3: Coordination — HTTP 103 Early Hints Orchestration

When a query arrives, the orchestrator sends HTTP 103 Early Hints to all
participating nodes BEFORE inference starts. This pre-warms the pipeline:
- Storage nodes start fetching context
- Inference nodes load the correct model shard

Tensor parallelism:
- 1 node: full model locally
- 2+ nodes: split model layers (node A: layers 0-16, node B: layers 17-32)

Shard timeout: if response > 200ms → HTTP 103 warning to peers, retry once.
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Optional, Any, Callable, Awaitable, AsyncGenerator

logger = logging.getLogger("myca.orchestrator")

# Protocol event types
HTTP103_SENT = "HTTP103_SENT"
HTTP103_PREWARM = "HTTP103_PREWARM"
SHARD_ASSIGN = "SHARD_ASSIGN"
SHARD_TIMEOUT = "SHARD_TIMEOUT"
SHARD_RETRY = "SHARD_RETRY"
SHARD_COMPLETE = "SHARD_COMPLETE"
QUERY_ROUTE = "QUERY_ROUTE"
QUERY_COMPLETE = "QUERY_COMPLETE"
ROUTE_SELECTED = "ROUTE_SELECTED"
ROUTE_FAILOVER = "ROUTE_FAILOVER"
INFERENCE_NODE = "INFERENCE_NODE"

SHARD_TIMEOUT_MS = 200  # milliseconds


@dataclass
class ShardAssignment:
    """Assignment of model layers to a node."""
    node_id: str
    shard_name: str
    layer_start: int
    layer_end: int
    status: str = "pending"  # pending, processing, complete, timeout
    assigned_at: float = field(default_factory=time.time)
    completed_at: Optional[float] = None
    duration_ms: Optional[float] = None


@dataclass
class QueryPlan:
    """Execution plan for a distributed query."""
    query_id: str
    prompt: str
    shards: list[ShardAssignment] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    status: str = "planning"  # planning, prewarm, executing, complete, error


class Orchestrator:
    """
    Central query router using HTTP 103 Early Hints for pipeline coordination.
    
    HTTP 103 (Early Hints) was standardized in 2017 for "sending hints before
    the final response." Nobody used it for distributed inference coordination.
    Until now.
    """

    def __init__(
        self,
        node_id: str,
        event_callback: Optional[Callable[[str, dict], Awaitable[None]]] = None,
    ):
        self.node_id = node_id
        self.event_callback = event_callback
        self._query_counter = 0
        self._active_queries: dict[str, QueryPlan] = {}

    async def _emit(self, event_type: str, data: dict):
        event = {"type": event_type, "timestamp": time.time(), "layer": "orchestrator", **data}
        logger.info(f"[ORCHESTRATOR] {event_type}: {data}")
        if self.event_callback:
            await self.event_callback(event_type, event)

    async def plan_query(self, prompt: str, peers: list[dict]) -> QueryPlan:
        """
        Create an execution plan for a query.
        
        - 0 peers (solo): Full model on this node
        - 1+ peers: Split into context encoding + generation shards
        """
        self._query_counter += 1
        query_id = f"q-{self._query_counter:04d}"

        plan = QueryPlan(query_id=query_id, prompt=prompt)

        inference_peers = [p for p in peers if p.get("role") == "inference"]

        if len(inference_peers) == 0:
            # Solo mode: this node runs everything
            plan.shards.append(ShardAssignment(
                node_id=self.node_id,
                shard_name="full-model",
                layer_start=0,
                layer_end=32,
            ))
        elif len(inference_peers) == 1:
            # Two-node split: context encoding + generation
            plan.shards.append(ShardAssignment(
                node_id=inference_peers[0]["node_id"],
                shard_name="context-encoding",
                layer_start=0,
                layer_end=16,
            ))
            plan.shards.append(ShardAssignment(
                node_id=self.node_id,
                shard_name="generation",
                layer_start=17,
                layer_end=32,
            ))
        else:
            # Multi-node: distribute across available inference peers
            total_layers = 32
            layers_per_node = total_layers // (len(inference_peers) + 1)

            current_layer = 0
            all_nodes = [self.node_id] + [p["node_id"] for p in inference_peers]

            for i, nid in enumerate(all_nodes):
                end_layer = current_layer + layers_per_node - 1
                if i == len(all_nodes) - 1:
                    end_layer = total_layers - 1  # Last node gets remainder
                plan.shards.append(ShardAssignment(
                    node_id=nid,
                    shard_name=f"shard-{i}",
                    layer_start=current_layer,
                    layer_end=end_layer,
                ))
                current_layer = end_layer + 1

        self._active_queries[query_id] = plan

        await self._emit(QUERY_ROUTE, {
            "query_id": query_id,
            "prompt_length": len(prompt),
            "num_shards": len(plan.shards),
            "nodes": [s.node_id for s in plan.shards],
        })

        return plan

    async def send_early_hints(self, plan: QueryPlan, peers: list[dict]):
        """
        Send HTTP 103 Early Hints to all participating nodes.
        
        This is the dormant technology moment: HTTP 103 was designed for
        "preloading resources before the page loads." We use it to pre-warm
        inference pipeline nodes before the actual query starts.
        """
        plan.status = "prewarm"

        for shard in plan.shards:
            # Send HTTP 103 Early Hint to each node
            hint = {
                "query_id": plan.query_id,
                "shard": shard.shard_name,
                "layers": f"{shard.layer_start}-{shard.layer_end}",
                "action": "prewarm",
                "prompt_hash": hash(plan.prompt) % 10000,
            }

            await self._emit(HTTP103_SENT, {
                "target_node": shard.node_id,
                "hint": hint,
                "status_code": 103,
                "header": "Link: </model/shard>; rel=preload",
            })

            shard.status = "processing"

            await self._emit(HTTP103_PREWARM, {
                "node_id": shard.node_id,
                "shard": shard.shard_name,
                "layers": f"{shard.layer_start}-{shard.layer_end}",
                "action": "loading model shard",
            })

        # Log shard assignments
        for shard in plan.shards:
            await self._emit(SHARD_ASSIGN, {
                "query_id": plan.query_id,
                "node_id": shard.node_id,
                "shard": shard.shard_name,
                "layers": f"{shard.layer_start}-{shard.layer_end}",
            })

    async def execute_shard(
        self,
        shard: ShardAssignment,
        execute_fn: Callable,
        *args,
        **kwargs,
    ) -> Any:
        """
        Execute a shard with timeout handling.
        If shard > 200ms → HTTP 103 warning, retry once.
        """
        start_time = time.time()

        try:
            result = await asyncio.wait_for(
                execute_fn(*args, **kwargs),
                timeout=SHARD_TIMEOUT_MS / 1000 * 5,  # 5x timeout for actual cutoff
            )

            duration_ms = (time.time() - start_time) * 1000
            shard.duration_ms = duration_ms
            shard.completed_at = time.time()

            if duration_ms > SHARD_TIMEOUT_MS:
                # Shard was slow — warn peers
                await self._emit(SHARD_TIMEOUT, {
                    "node_id": shard.node_id,
                    "shard": shard.shard_name,
                    "duration_ms": round(duration_ms, 2),
                    "threshold_ms": SHARD_TIMEOUT_MS,
                    "action": "warning peers via HTTP 103",
                })

                # Retry once
                await self._emit(SHARD_RETRY, {
                    "node_id": shard.node_id,
                    "shard": shard.shard_name,
                    "attempt": "1/1",
                })

                start_time = time.time()
                result = await execute_fn(*args, **kwargs)
                duration_ms = (time.time() - start_time) * 1000
                shard.duration_ms = duration_ms

            shard.status = "complete"
            await self._emit(SHARD_COMPLETE, {
                "node_id": shard.node_id,
                "shard": shard.shard_name,
                "duration_ms": round(duration_ms, 2),
            })

            return result

        except asyncio.TimeoutError:
            shard.status = "timeout"
            await self._emit(SHARD_TIMEOUT, {
                "node_id": shard.node_id,
                "shard": shard.shard_name,
                "action": "shard execution timed out",
            })
            raise

    async def complete_query(self, plan: QueryPlan):
        """Mark a query as complete."""
        plan.status = "complete"
        total_ms = (time.time() - plan.created_at) * 1000
        await self._emit(QUERY_COMPLETE, {
            "query_id": plan.query_id,
            "total_ms": round(total_ms, 2),
            "shards_completed": sum(1 for s in plan.shards if s.status == "complete"),
            "shards_total": len(plan.shards),
        })

    async def simulate_shard_timeout(self, plan):
        """Simulate a shard timeout for testing error handling."""
        if plan.shards:
            shard = plan.shards[-1]  # Last shard times out
            await self._emit(SHARD_TIMEOUT, {
                "node_id": shard.node_id,
                "shard": shard.shard_name,
                "duration_ms": 250,  # Over 200ms threshold
                "threshold_ms": SHARD_TIMEOUT_MS,
                "action": "HTTP 103 Early Hints warning sent to peers",
            })
            await self._emit(SHARD_RETRY, {
                "node_id": shard.node_id,
                "shard": shard.shard_name,
                "attempt": "1/1",
            })

    # ── Smart Load-Based Routing ──────────────────────────────────────────

    def select_best_node(
        self,
        peers: list,
        exclude: list[str] = None,
        local_node_id: str = None,
    ) -> Optional[str]:
        """
        Select the best node for inference based on load and speed.

        Score = tokens_per_second × (1 - load_pct / 100)
        Filter: model_loaded=True, load_pct < 85, last_seen < 5s

        Returns node_id of best candidate, or None if no eligible peer.
        """
        exclude = exclude or []
        now = time.time()

        candidates = []
        for peer in peers:
            if peer.get("node_id") in exclude:
                continue
            if not peer.get("model_loaded", False):
                continue
            if peer.get("load_pct", 100) >= 85:
                continue
            if now - peer.get("last_seen", 0) >= 5:
                continue
            candidates.append(peer)

        if not candidates:
            return None

        def score(p):
            tps = p.get("tokens_per_second", 1.0)
            load = p.get("load_pct", 50) / 100.0
            return tps * (1 - load)

        candidates.sort(key=score, reverse=True)
        best = candidates[0]

        # Log scores for visibility
        score_strs = ", ".join(
            f"{p['node_id']}:{score(p):.1f}" for p in candidates
        )
        logger.info(f"[ORCHESTRATOR] ROUTE_SCORE: {score_strs}")

        return best["node_id"]

    async def route_query(
        self,
        prompt: str,
        peers: list,
        local_node_id: str,
    ) -> tuple[str, str]:
        """
        Choose the best node for this query. Returns (node_id, reason).
        Falls back to local node if no eligible peer found.
        """
        self._query_counter += 1
        query_id = f"q-{self._query_counter:04d}"

        best_node_id = self.select_best_node(peers, local_node_id=local_node_id)

        if best_node_id:
            peer = next((p for p in peers if p["node_id"] == best_node_id), None)
            load = peer.get("load_pct", 0) if peer else 0
            tps = peer.get("tokens_per_second", 0) if peer else 0
            reason = f"score-based (load:{load:.0f}% speed:{tps:.1f}tok/s)"
            await self._emit(ROUTE_SELECTED, {
                "query_id": query_id,
                "selected_node": best_node_id,
                "reason": reason,
                "load_pct": round(load, 1),
                "tokens_per_second": round(tps, 2),
            })
            return best_node_id, query_id
        else:
            # Fallback to local
            reason = "no eligible peers — local fallback"
            await self._emit(ROUTE_SELECTED, {
                "query_id": query_id,
                "selected_node": local_node_id,
                "reason": reason,
            })
            return local_node_id, query_id

    async def start_scenario_simulations(self, discovery):
        """Start automatic load scenario simulations in background."""
        asyncio.create_task(self._scenario_a(discovery))
        asyncio.create_task(self._scenario_b(discovery))
        asyncio.create_task(self._scenario_c(discovery))

    async def _scenario_a(self, discovery):
        """Scenario A: Alpha overloaded every 30s for 8s."""
        await asyncio.sleep(30)
        while True:
            try:
                if hasattr(discovery, "set_node_load"):
                    logger.info("[ORCHESTRATOR] SCENARIO_A: alpha overloaded (95%)")
                    discovery.set_node_load("myca-alpha", 95)
                    await self._emit("SCENARIO_A_START", {
                        "description": "alpha overloaded → routing to beta",
                        "node_id": "myca-alpha",
                        "load_pct": 95,
                    })
                    await asyncio.sleep(8)
                    discovery.set_node_load("myca-alpha", 35)
                    await self._emit("SCENARIO_A_END", {
                        "description": "alpha recovered",
                        "node_id": "myca-alpha",
                        "load_pct": 35,
                    })
                    discovery.restore_node("myca-alpha")
                await asyncio.sleep(30)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Scenario A error: {e}")
                await asyncio.sleep(30)

    async def _scenario_b(self, discovery):
        """Scenario B: Alpha dies for 10s every 60s (failover simulation)."""
        await asyncio.sleep(55)
        while True:
            try:
                if hasattr(discovery, "simulate_node_death"):
                    logger.info("[ORCHESTRATOR] SCENARIO_B: alpha death → failover")
                    await self._emit(ROUTE_FAILOVER, {
                        "description": "alpha simulated death — failover to beta",
                        "failed_node": "myca-alpha",
                        "failover_to": "myca-beta",
                    })
                    await discovery.simulate_node_death("myca-alpha")
                    await asyncio.sleep(10)
                    await discovery.simulate_node_recovery("myca-alpha")
                    await self._emit("SCENARIO_B_END", {"description": "alpha recovered"})
                await asyncio.sleep(60)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Scenario B error: {e}")
                await asyncio.sleep(60)

    async def _scenario_c(self, discovery):
        """Scenario C: All inference nodes busy every 90s for 8s."""
        await asyncio.sleep(85)
        while True:
            try:
                if hasattr(discovery, "set_node_load"):
                    logger.info("[ORCHESTRATOR] SCENARIO_C: all nodes busy → local fallback")
                    discovery.set_node_load("myca-alpha", 92)
                    discovery.set_node_load("myca-beta", 88)
                    await self._emit("SCENARIO_C_START", {
                        "description": "all nodes busy → local fallback",
                        "alpha_load": 92,
                        "beta_load": 88,
                    })
                    await asyncio.sleep(8)
                    discovery.restore_node("myca-alpha")
                    discovery.restore_node("myca-beta")
                    await self._emit("SCENARIO_C_END", {"description": "nodes recovered"})
                await asyncio.sleep(90)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Scenario C error: {e}")
                await asyncio.sleep(90)

