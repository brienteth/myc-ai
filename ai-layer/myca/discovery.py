"""
Myca Layer 1: Discovery — mDNS Node Discovery

Uses zeroconf (mDNS) to discover Myca nodes on the local network.
Each node registers as _myca._tcp.local. with TXT records for
node_id, role, load_pct, and model_shards.

Dead nodes removed after 3-second timeout.
Simulation mode uses SimulatedDiscovery with in-process fake nodes.
"""

import asyncio
import json
import logging
import socket
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional, Callable, Awaitable

logger = logging.getLogger("myca.discovery")

# Protocol event types
MDNS_REGISTER = "MDNS_REGISTER"
MDNS_DISCOVER = "MDNS_DISCOVER"
MDNS_TIMEOUT = "MDNS_TIMEOUT"
MDNS_HEARTBEAT = "MDNS_HEARTBEAT"

SERVICE_TYPE = "_myca._tcp.local."
DEAD_NODE_TIMEOUT = 3.0  # seconds


@dataclass
class PeerInfo:
    """Information about a discovered peer node."""
    node_id: str
    role: str  # inference, storage, relay
    host: str
    port: int
    load_pct: float = 0.0
    model_shards: list[str] = field(default_factory=list)
    last_seen: float = field(default_factory=time.time)
    latency_ms: float = 0.0
    status: str = "active"  # active, busy, dead
    tokens_per_second: float = 0.0
    model_loaded: bool = False
    source: str = "mdns_local"  # mdns_local or h3_global

    def is_alive(self) -> bool:
        return (time.time() - self.last_seen) < DEAD_NODE_TIMEOUT

    def to_dict(self) -> dict:
        return {
            "node_id": self.node_id,
            "role": self.role,
            "host": self.host,
            "port": self.port,
            "load_pct": round(self.load_pct, 1),
            "model_shards": self.model_shards,
            "last_seen": self.last_seen,
            "latency_ms": self.latency_ms,
            "status": self.status,
            "tokens_per_second": round(self.tokens_per_second, 2),
            "model_loaded": self.model_loaded,
            "source": self.source,
        }

class H3GlobalDiscovery:
    """
    Registers this Myca node with Opacus H3 registry.
    Allows nodes across the internet to find each other.
    """
    def __init__(self, node_id: str, local_ip: str, port: int):
        import os
        self.node_id = node_id
        self.local_ip = local_ip
        self.port = port
        self.api_url = os.getenv("OPACUS_H3_URL", "")
        self._running = False
        self._heartbeat_task = None
        self.peers = {}
        
    async def register(self):
        if not self.api_url:
            return
            
        import httpx
        payload = {
            "node_id": self.node_id,
            "capabilities": ["inference", "myca-v1"],
            "endpoint": f"http://{self.local_ip}:{self.port}",
            "model_loaded": True,
            "version": "0.1.0"
        }
        try:
            async with httpx.AsyncClient() as client:
                await client.post(f"{self.api_url}/api/registry/register", json=payload, timeout=5.0)
        except Exception as e:
            logger.warning(f"H3 global registration failed: {e}")

    async def discover_global_peers(self) -> list[PeerInfo]:
        if not self.api_url:
            return []
            
        import httpx
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"{self.api_url}/api/registry/agents?capability=myca-v1", timeout=5.0)
                if resp.status_code == 200:
                    data = resp.json()
                    peers = []
                    for agent in data.get("agents", []):
                        if agent.get("node_id") == self.node_id:
                            continue
                        
                        # Parse endpoint to get host and port
                        endpoint = agent.get("endpoint", "")
                        host = "unknown"
                        port = 8420
                        if endpoint.startswith("http://") or endpoint.startswith("https://"):
                            parts = endpoint.split("://")[1].split(":")
                            host = parts[0]
                            if len(parts) > 1:
                                port = int(parts[1].split("/")[0])
                        
                        peers.append(PeerInfo(
                            node_id=agent.get("node_id"),
                            role="inference",
                            host=host,
                            port=port,
                            model_loaded=agent.get("model_loaded", False),
                            source="h3_global",
                            latency_ms=100.0  # Default higher latency for global peers
                        ))
                    return peers
        except Exception as e:
            logger.warning(f"H3 global discovery failed: {e}")
        return []

    async def heartbeat_loop(self):
        self._running = True
        while self._running:
            await self.register()
            # Also update our local cache of global peers
            global_peers = await self.discover_global_peers()
            self.peers = {p.node_id: p for p in global_peers}
            await asyncio.sleep(30)
            
    def start(self):
        if not self.api_url:
            logger.warning("OPACUS_H3_URL is not set. H3 global discovery unavailable.")
            return
        self._heartbeat_task = asyncio.create_task(self.heartbeat_loop())
        
    async def stop(self):
        self._running = False
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass


class MycaDiscovery:
    """
    Real mDNS discovery using zeroconf.
    Registers this node and discovers peers on the local network.
    """

    def __init__(
        self,
        node_id: str,
        role: str,
        port: int,
        model_shards: list[str] = None,
        event_callback: Optional[Callable[[str, dict], Awaitable[None]]] = None,
    ):
        self.node_id = node_id
        self.role = role
        self.port = port
        self.model_shards = model_shards or []
        self.event_callback = event_callback
        self.peers: dict[str, PeerInfo] = {}
        self._running = False
        self._cleanup_task: Optional[asyncio.Task] = None
        self._zeroconf = None
        self._service_info = None
        
        # Initialize H3 Global Discovery
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
        self.h3_discovery = H3GlobalDiscovery(node_id, local_ip, port)

    async def _emit(self, event_type: str, data: dict):
        event = {"type": event_type, "timestamp": time.time(), "layer": "discovery", **data}
        logger.info(f"[DISCOVERY] {event_type}: {data}")
        if self.event_callback:
            await self.event_callback(event_type, event)

    async def start(self):
        """Register this node via mDNS and start listening for peers."""
        self._running = True
        
        # Start global discovery
        self.h3_discovery.start()

        try:
            from zeroconf import Zeroconf, ServiceInfo, ServiceBrowser
            from zeroconf import ServiceStateChange

            self._zeroconf = Zeroconf()

            # Get local IP
            hostname = socket.gethostname()
            local_ip = socket.gethostbyname(hostname)

            # Register our service
            properties = {
                b"node_id": self.node_id.encode(),
                b"role": self.role.encode(),
                b"load_pct": b"0",
                b"model_shards": json.dumps(self.model_shards).encode(),
            }

            self._service_info = ServiceInfo(
                SERVICE_TYPE,
                f"{self.node_id}.{SERVICE_TYPE}",
                addresses=[socket.inet_aton(local_ip)],
                port=self.port,
                properties=properties,
            )

            self._zeroconf.register_service(self._service_info)

            await self._emit(MDNS_REGISTER, {
                "node_id": self.node_id,
                "role": self.role,
                "host": local_ip,
                "port": self.port,
                "service_type": SERVICE_TYPE,
            })

            # Start browsing for other nodes
            def on_service_state_change(zeroconf, service_type, name, state_change):
                if state_change == ServiceStateChange.Added:
                    info = zeroconf.get_service_info(service_type, name)
                    if info and info.properties:
                        peer_id = info.properties.get(b"node_id", b"").decode()
                        if peer_id and peer_id != self.node_id:
                            peer = PeerInfo(
                                node_id=peer_id,
                                role=info.properties.get(b"role", b"inference").decode(),
                                host=socket.inet_ntoa(info.addresses[0]) if info.addresses else "unknown",
                                port=info.port or 0,
                                load_pct=float(info.properties.get(b"load_pct", b"0")),
                                model_shards=json.loads(info.properties.get(b"model_shards", b"[]")),
                                source="mdns_local"
                            )
                            self.peers[peer_id] = peer
                            asyncio.get_event_loop().create_task(
                                self._emit(MDNS_DISCOVER, {"peer": peer.to_dict()})
                            )
                elif state_change == ServiceStateChange.Removed:
                    # Find and remove the peer
                    for pid, peer in list(self.peers.items()):
                        if f"{pid}.{SERVICE_TYPE}" == name:
                            del self.peers[pid]
                            asyncio.get_event_loop().create_task(
                                self._emit(MDNS_TIMEOUT, {"node_id": pid, "reason": "service_removed"})
                            )

            ServiceBrowser(self._zeroconf, SERVICE_TYPE, handlers=[on_service_state_change])

        except Exception as e:
            logger.warning(f"mDNS registration failed: {e}. Running without network discovery.")
            await self._emit(MDNS_REGISTER, {
                "node_id": self.node_id,
                "role": self.role,
                "status": "fallback_no_mdns",
                "error": str(e),
            })

        # Start dead-node cleanup
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def stop(self):
        """Unregister and stop discovery."""
        self._running = False
        await self.h3_discovery.stop()
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        if self._zeroconf and self._service_info:
            self._zeroconf.unregister_service(self._service_info)
            self._zeroconf.close()

    async def _cleanup_loop(self):
        """Remove dead nodes every second."""
        while self._running:
            await asyncio.sleep(1.0)
            dead = [pid for pid, peer in self.peers.items() if not peer.is_alive()]
            for pid in dead:
                peer = self.peers.pop(pid)
                peer.status = "dead"
                await self._emit(MDNS_TIMEOUT, {
                    "node_id": pid,
                    "reason": "timeout",
                    "last_seen_ago_s": round(time.time() - peer.last_seen, 2),
                })

    def get_active_peers(self) -> list[PeerInfo]:
        """Return list of currently active peers (local + global)."""
        local_peers = [p for p in self.peers.values() if p.is_alive()]
        
        # Merge with global peers
        all_peers = {p.node_id: p for p in local_peers}
        for pid, p in self.h3_discovery.peers.items():
            if pid not in all_peers:
                all_peers[pid] = p
                
        return list(all_peers.values())

    def update_peer_heartbeat(self, peer_id: str):
        """Update last_seen for a peer."""
        if peer_id in self.peers:
            self.peers[peer_id].last_seen = time.time()



# ── Simulation node profiles ───────────────────────────────────────────────

_SIM_PROFILES = {
    "myca-alpha": {
        "role": "inference",
        "load_range": (20, 60),
        "base_tps": 15.0,
        "model_loaded": True,
        "model_shards": ["layers-0-16"],
        "latency_ms": 12.0,
        "port": 8421,
    },
    "myca-beta": {
        "role": "inference",
        "load_range": (40, 80),
        "base_tps": 8.0,
        "model_loaded": True,
        "model_shards": ["layers-17-32"],
        "latency_ms": 18.0,
        "port": 8422,
    },
    "myca-gamma": {
        "role": "storage",
        "load_range": (5, 15),
        "base_tps": 0.0,
        "model_loaded": False,
        "model_shards": [],
        "latency_ms": 8.0,
        "port": 8423,
    },
}


class SimulatedDiscovery:
    """
    Simulated discovery for single-machine testing.
    Creates 3 virtual nodes with realistic fluctuating load and speed metrics.
    """

    def __init__(
        self,
        node_id: str,
        role: str,
        port: int,
        event_callback: Optional[Callable[[str, dict], Awaitable[None]]] = None,
    ):
        self.node_id = node_id
        self.role = role
        self.port = port
        self.event_callback = event_callback
        self.peers: dict[str, PeerInfo] = {}
        self._running = False
        self._heartbeat_task: Optional[asyncio.Task] = None
        # Override map: node_id → {"load_pct": x, "tokens_per_second": y}
        self._overrides: dict[str, dict] = {}

    async def _emit(self, event_type: str, data: dict):
        event = {"type": event_type, "timestamp": time.time(), "layer": "discovery", **data}
        logger.info(f"[DISCOVERY] {event_type}: {data}")
        if self.event_callback:
            await self.event_callback(event_type, event)

    async def start(self):
        """Simulate discovering 3 virtual nodes."""
        self._running = True

        await self._emit(MDNS_REGISTER, {
            "node_id": self.node_id,
            "role": self.role,
            "mode": "simulation",
            "virtual_nodes": 3,
            "service_type": SERVICE_TYPE,
        })

        # Simulate staggered discovery
        for node_id, profile in _SIM_PROFILES.items():
            await asyncio.sleep(0.3)
            import random
            load = random.uniform(*profile["load_range"])
            peer = PeerInfo(
                node_id=node_id,
                role=profile["role"],
                host="127.0.0.1",
                port=profile["port"],
                load_pct=load,
                model_shards=profile["model_shards"],
                latency_ms=profile["latency_ms"],
                tokens_per_second=profile["base_tps"],
                model_loaded=profile["model_loaded"],
            )
            self.peers[node_id] = peer
            await self._emit(MDNS_DISCOVER, {"peer": peer.to_dict()})

        # Start heartbeat
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

    async def stop(self):
        self._running = False
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass

    async def _heartbeat_loop(self):
        """Keep virtual nodes alive and fluctuate load/tps realistically."""
        import random
        while self._running:
            await asyncio.sleep(2.0)
            for node_id, peer in self.peers.items():
                if peer.status != "active":
                    continue

                profile = _SIM_PROFILES.get(node_id)
                if not profile:
                    peer.last_seen = time.time()
                    continue

                old_load = peer.load_pct

                # Apply override if set, else fluctuate naturally
                if node_id in self._overrides:
                    override = self._overrides[node_id]
                    new_load = override.get("load_pct", peer.load_pct)
                    new_tps = override.get("tokens_per_second", peer.tokens_per_second)
                else:
                    lo, hi = profile["load_range"]
                    drift = random.uniform(-5, 5)
                    new_load = max(lo, min(hi, peer.load_pct + drift))
                    load_factor = 1 - (new_load / 100)
                    new_tps = profile["base_tps"] * load_factor * random.uniform(0.9, 1.1)

                peer.load_pct = new_load
                peer.tokens_per_second = new_tps
                peer.last_seen = time.time()

                # Emit NODE_LOAD_UPDATE if load changed significantly (>10%)
                if abs(new_load - old_load) > 10:
                    await self._emit(NODE_LOAD_UPDATE, {
                        "node_id": node_id,
                        "load_pct": round(new_load, 1),
                        "previous_load_pct": round(old_load, 1),
                        "tokens_per_second": round(new_tps, 2),
                        "model_loaded": peer.model_loaded,
                    })

    def get_active_peers(self) -> list[PeerInfo]:
        return [p for p in self.peers.values() if p.status == "active"]

    async def simulate_node_death(self, node_id: str):
        """Simulate a node going offline."""
        if node_id in self.peers:
            self.peers[node_id].status = "dead"
            self.peers[node_id].last_seen = time.time() - DEAD_NODE_TIMEOUT - 1
            await self._emit(MDNS_TIMEOUT, {
                "node_id": node_id,
                "reason": "simulated_death",
            })

    async def simulate_node_recovery(self, node_id: str):
        """Simulate a node coming back online."""
        if node_id in self.peers:
            self.peers[node_id].status = "active"
            self.peers[node_id].last_seen = time.time()
            self._overrides.pop(node_id, None)
            await self._emit(MDNS_DISCOVER, {
                "peer": self.peers[node_id].to_dict(),
                "reason": "recovery",
            })

    def set_node_load(self, node_id: str, load_pct: float):
        """Manually override load for a node (for testing)."""
        if node_id not in self._overrides:
            self._overrides[node_id] = {}
        self._overrides[node_id]["load_pct"] = load_pct
        if node_id in self.peers:
            self.peers[node_id].load_pct = load_pct

    def set_node_speed(self, node_id: str, tokens_per_second: float):
        """Manually override tps for a node (for testing)."""
        if node_id not in self._overrides:
            self._overrides[node_id] = {}
        self._overrides[node_id]["tokens_per_second"] = tokens_per_second
        if node_id in self.peers:
            self.peers[node_id].tokens_per_second = tokens_per_second

    def restore_node(self, node_id: str):
        """Remove manual override, restore natural fluctuation."""
        self._overrides.pop(node_id, None)

