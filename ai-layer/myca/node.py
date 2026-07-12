"""
Myca Node — Core node class that aggregates all 5 layers.

A MycaNode represents a single participant in the P2P network.
It manages its own discovery, connections, crypto, orchestration,
and inference capabilities.
"""

import asyncio
import logging
import time
import uuid
from typing import Optional, Callable, Awaitable, AsyncGenerator

from myca.discovery import MycaDiscovery, SimulatedDiscovery, PeerInfo
from myca.connection import ConnectionManager, SimulatedConnectionManager
from myca.orchestrator import Orchestrator
from myca.crypto import MycaCrypto
from myca.inference.engine import InferenceEngine
from myca.inference.registry import BackendRegistry
from myca.inference.manager import InferenceManager
import myca.inference.backends  # triggers registration
from myca.library import LibraryService

logger = logging.getLogger("myca.node")


class MycaNode:
    """
    A single Myca node that participates in the P2P inference network.
    
    Aggregates all 5 layers:
    - Discovery (mDNS)
    - Connection (HTTP/2 + WebRTC)
    - Crypto (Kyber)
    - Orchestrator (Coordination)
    - Inference (LLM)
    - Library (RAG & Storage)
    """

    def __init__(
        self,
        node_id: str = None,
        role: str = "inference",
        host: str = "0.0.0.0",
        port: int = 8420,
        simulate: bool = False,
        data_dir: str = "data",
        event_callback: Optional[Callable[[str, dict], Awaitable[None]]] = None,
    ):
        self.node_id = node_id or f"myca-{uuid.uuid4().hex[:6]}"
        self.role = role
        self.host = host
        self.port = port
        self.simulate = simulate
        self.event_callback = event_callback
        self.started_at: Optional[float] = None
        self.status = "initializing"

        # Layer instances
        self.crypto = MycaCrypto(event_callback=self.event_callback)
        self.library = LibraryService(data_dir=data_dir)
        
        if self.simulate:
            self.discovery = SimulatedDiscovery(
                node_id=self.node_id,
                role=self.role,
                port=self.port,
                event_callback=self.event_callback,
            )
            self.connection = SimulatedConnectionManager(
                node_id=self.node_id,
                event_callback=self.event_callback,
            )
        else:
            self.discovery = MycaDiscovery(
                node_id=self.node_id,
                role=self.role,
                port=self.port,
                event_callback=self.event_callback,
            )
            self.connection = ConnectionManager(
                node_id=self.node_id,
                event_callback=self.event_callback,
            )

        self.orchestrator = Orchestrator(
            node_id=self.node_id,
            event_callback=self.event_callback,
        )
        self.inference_engine: Optional[InferenceEngine] = None
        self.inference_manager: Optional[InferenceManager] = None

        # Error simulation tasks
        self._error_tasks: list[asyncio.Task] = []

    async def _emit(self, event_type: str, data: dict):
        event = {"type": event_type, "timestamp": time.time(), "layer": "node", **data}
        logger.info(f"[NODE] {event_type}: {data}")
        if self.event_callback:
            await self.event_callback(event_type, event)

    async def start(self):
        """Boot sequence: Crypto → Discovery → Connection → Inference → Ready."""
        self.started_at = time.time()
        
        # Init library DB
        await self.library.init_db()

        await self._emit("NODE_BOOT", {
            "node_id": self.node_id,
            "role": self.role,
            "port": self.port,
            "mode": "simulation" if self.simulate else "network",
        })

        # Layer 4: Crypto (first — needed for secure communications)
        self.crypto = MycaCrypto(event_callback=self.event_callback)
        await self.crypto.initialize()

        # Layer 1: Discovery
        if self.simulate:
            self.discovery = SimulatedDiscovery(
                node_id=self.node_id,
                role=self.role,
                port=self.port,
                event_callback=self.event_callback,
            )
        else:
            self.discovery = MycaDiscovery(
                node_id=self.node_id,
                role=self.role,
                port=self.port,
                event_callback=self.event_callback,
            )
        await self.discovery.start()

        # Layer 2: Connection
        if self.simulate:
            self.connection = SimulatedConnectionManager(
                node_id=self.node_id,
                event_callback=self.event_callback,
            )
        else:
            self.connection = ConnectionManager(
                node_id=self.node_id,
                event_callback=self.event_callback,
            )
        await self.connection.start()

        # Connect to discovered peers
        await asyncio.sleep(0.5)  # Wait for discovery
        for peer in self.discovery.get_active_peers():
            try:
                await self.connection.connect_to_peer(peer)
                # Key exchange with peer
                peer_pub = self.crypto.get_public_key_bytes()  # In sim, exchange with self
                await self.crypto.derive_shared_key(peer.node_id, peer_pub)
            except Exception as e:
                logger.warning(f"Failed to connect to {peer.node_id}: {e}")

        # Layer 3: Orchestrator
        self.orchestrator = Orchestrator(
            node_id=self.node_id,
            event_callback=self.event_callback,
        )

        # Layer 5: Inference
        self.inference_engine = BackendRegistry.create_backend("auto")
        self.inference_manager = InferenceManager(self.inference_engine)
        
        # Boot the default chat capability
        try:
            await self.inference_manager.boot_capability("chat")
        except Exception as e:
            logger.warning(f"Capability boot failed (expected if mock/stub): {e}")

        self.status = "ready"
        boot_time_ms = (time.time() - self.started_at) * 1000

        await self._emit("NODE_READY", {
            "node_id": self.node_id,
            "role": self.role,
            "boot_time_ms": round(boot_time_ms, 2),
            "peers": len(self.discovery.get_active_peers()),
            "backend": type(self.inference_engine).__name__,
            "mode": "simulation" if self.simulate else "network",
        })

        # Start error simulation if in simulate mode
        if self.simulate:
            self._start_error_simulation()
            await self.orchestrator.start_scenario_simulations(self.discovery)

    async def stop(self):
        """Gracefully shutdown all layers."""
        self.status = "stopping"
        for task in self._error_tasks:
            task.cancel()
        if self.crypto:
            await self.crypto.stop()
        if self.discovery:
            await self.discovery.stop()
        if self.connection:
            await self.connection.stop()
        self.status = "stopped"
        await self._emit("NODE_STOP", {"node_id": self.node_id})

    async def query(self, prompt: str, stream: bool = True) -> AsyncGenerator[str, None]:
        """
        Process a query through the distributed inference pipeline.
        Uses smart load-based routing to select the best available node.
        Yields tokens, with the last yield being a special attribution dict.
        """
        if not self.inference_engine:
            raise RuntimeError("Node not ready — inference engine not initialized")

        # Basic RAG context injection
        context = await self.library.get_relevant_context(prompt)
        enhanced_prompt = prompt
        if context:
            enhanced_prompt = f"İlgili bilgi (RAG):\n{context}\n\nKullanıcı sorusu:\n{prompt}"
            logger.info(f"RAG context injected: {len(context)} chars")

        peers = [p.to_dict() for p in self.discovery.get_active_peers()]

        # Smart routing: select best node
        selected_node_id, query_id = await self.orchestrator.route_query(
            enhanced_prompt, peers, local_node_id=self.node_id
        )

        # Determine if this is a local or remote node
        is_local = (selected_node_id == self.node_id)

        # Send Early Hints via a lightweight plan
        plan = await self.orchestrator.plan_query(enhanced_prompt, peers)

        await self._emit("INFERENCE_START", {
            "query_id": query_id,
            "prompt_length": len(enhanced_prompt),
            "backend": type(self.inference_engine).__name__,
            "selected_node": selected_node_id,
            "is_local": is_local,
        })

        await self._emit("INFERENCE_NODE", {
            "query_id": query_id,
            "node_id": selected_node_id,
            "is_local": is_local,
        })

        token_count = 0
        start_time = time.time()
        failover_occurred = False
        failover_from = None

        try:
            async for token in self.inference_engine.stream(enhanced_prompt):
                token_count += 1
                yield token
        except Exception as e:
            # Failover: try another peer
            failover_from = selected_node_id
            failover_occurred = True

            remaining = [p for p in peers if p["node_id"] != selected_node_id]
            fallback_id = self.orchestrator.select_best_node(remaining) or self.node_id

            await self._emit("ROUTE_FAILOVER", {
                "query_id": query_id,
                "failed_node": selected_node_id,
                "failover_to": fallback_id,
                "tokens_before_fail": token_count,
                "error": str(e),
            })

            selected_node_id = fallback_id
            try:
                async for token in self.inference_engine.stream(prompt):
                    token_count += 1
                    yield token
            except Exception as e2:
                await self._emit("INFERENCE_ERROR", {
                    "query_id": query_id,
                    "error": str(e2),
                })
                raise

        duration_ms = (time.time() - start_time) * 1000
        tps = round(token_count / (duration_ms / 1000), 2) if duration_ms > 0 else 0.0

        await self.orchestrator.complete_query(plan)

        await self._emit("INFERENCE_COMPLETE", {
            "query_id": query_id,
            "tokens": token_count,
            "duration_ms": round(duration_ms, 2),
            "tokens_per_sec": tps,
            "node_used": selected_node_id,
            "failover_occurred": failover_occurred,
        })

        # Yield attribution as a special sentinel dict
        yield {
            "type": "done",
            "node_used": selected_node_id,
            "tps": tps,
            "total_tokens": token_count,
            "failover_occurred": failover_occurred,
            "failover_from": failover_from,
        }


    def get_health(self) -> dict:
        """Return node health status."""
        peers = self.discovery.get_active_peers() if self.discovery else []
        latency_map = self.connection.get_latency_map() if self.connection else {}

        return {
            "node_id": self.node_id,
            "role": self.role,
            "status": self.status,
            "uptime_s": round(time.time() - self.started_at, 2) if self.started_at else 0,
            "peers_connected": len(peers),
            "backend": type(self.inference_engine).__name__ if self.inference_engine else "none",
            "mode": "simulation" if self.simulate else "network",
            "latency_map": {k: round(v, 2) for k, v in latency_map.items()},
        }

    def get_peers(self) -> list[dict]:
        """Return list of discovered peers."""
        if not self.discovery:
            return []
        peers = self.discovery.get_active_peers()
        result = []
        for peer in peers:
            peer_dict = peer.to_dict()
            # Add connection info
            if self.connection and peer.node_id in self.connection.connections:
                conn = self.connection.connections[peer.node_id]
                peer_dict["transport"] = conn.transport.value
                peer_dict["latency_ms"] = round(conn.latency_ms, 2)
                peer_dict["connected"] = conn.active
            result.append(peer_dict)
        return result

    def _start_error_simulation(self):
        """Start periodic error simulations for testing."""
        self._error_tasks.append(asyncio.create_task(self._sim_dead_node()))
        self._error_tasks.append(asyncio.create_task(self._sim_quic_drop()))
        self._error_tasks.append(asyncio.create_task(self._sim_shard_timeout()))
        self._error_tasks.append(asyncio.create_task(self._sim_key_rotation_fail()))

    async def _sim_dead_node(self):
        """Simulate dead node every ~30s."""
        await asyncio.sleep(25)
        while True:
            try:
                if hasattr(self.discovery, 'simulate_node_death'):
                    await self.discovery.simulate_node_death("myca-gamma")
                    await asyncio.sleep(5)
                    await self.discovery.simulate_node_recovery("myca-gamma")
                await asyncio.sleep(30)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error sim (dead node): {e}")
                await asyncio.sleep(30)

    async def _sim_quic_drop(self):
        """Simulate QUIC drop every ~45s."""
        await asyncio.sleep(35)
        while True:
            try:
                if hasattr(self.connection, 'simulate_quic_drop'):
                    await self.connection.simulate_quic_drop("myca-beta")
                await asyncio.sleep(45)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error sim (QUIC drop): {e}")
                await asyncio.sleep(45)

    async def _sim_shard_timeout(self):
        """Simulate shard timeout every ~60s."""
        await asyncio.sleep(50)
        while True:
            try:
                if self.orchestrator and self.orchestrator._active_queries:
                    last_query = list(self.orchestrator._active_queries.values())[-1]
                    await self.orchestrator.simulate_shard_timeout(last_query)
                else:
                    # Create a dummy plan to show the timeout event
                    dummy_peers = [{"node_id": "myca-beta", "role": "inference"}]
                    plan = await self.orchestrator.plan_query("(shard timeout test)", dummy_peers)
                    await self.orchestrator.simulate_shard_timeout(plan)
                await asyncio.sleep(60)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error sim (shard timeout): {e}")
                await asyncio.sleep(60)

    async def _sim_key_rotation_fail(self):
        """Simulate key rotation failure every ~90s."""
        await asyncio.sleep(80)
        while True:
            try:
                if self.crypto:
                    await self.crypto.force_rotation_failure()
                await asyncio.sleep(90)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error sim (key rotation): {e}")
                await asyncio.sleep(90)
