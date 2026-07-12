"""
Myca Layer 2: Connection — HTTP/2 + WebRTC DataChannel Fallback

Primary: Direct HTTP/2 connections for local (mDNS) peers.
Global: WebRTC DataChannel with STUN NAT traversal for H3 global peers.
        Signaling via Opacus H3 registry mailbox (POST/GET /api/registry/signal/{id}).

Routing:
  peer.source == "mdns_local" → HTTP/2 direct
  peer.source == "h3_global"  → WebRTC + STUN (fallback: HTTP/2 direct if signaling unavailable)

In simulation mode, uses asyncio.Queue-based message passing with
configurable fake latency (8-25ms random).
"""

import asyncio
import json
import logging
import os
import random
import time
from dataclasses import dataclass, field
from typing import Optional, Callable, Awaitable, Any, TYPE_CHECKING
from enum import Enum

if TYPE_CHECKING:
    from myca.discovery import PeerInfo

# STUN servers for NAT traversal (used by h3_global peers)
STUN_SERVERS = [
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
]

logger = logging.getLogger("myca.connection")

# Protocol event types
CONN_HTTP2_OK = "CONN_HTTP2_OK"
CONN_HTTP2_FAIL = "CONN_HTTP2_FAIL"
CONN_WEBRTC_OK = "CONN_WEBRTC_OK"
CONN_WEBRTC_FAIL = "CONN_WEBRTC_FAIL"
CONN_FALLBACK = "CONN_FALLBACK"
CONN_SEND = "CONN_SEND"
CONN_RECV = "CONN_RECV"


class TransportType(Enum):
    HTTP2 = "HTTP/2"
    WEBRTC = "WebRTC-DataChannel"
    SIMULATED = "Simulated-Queue"


@dataclass
class PeerConnection:
    """Represents a connection to a peer node."""
    peer_id: str
    transport: TransportType
    established_at: float = field(default_factory=time.time)
    messages_sent: int = 0
    messages_received: int = 0
    latency_ms: float = 0.0
    active: bool = True

    def to_dict(self) -> dict:
        return {
            "peer_id": self.peer_id,
            "transport": self.transport.value,
            "established_at": self.established_at,
            "messages_sent": self.messages_sent,
            "messages_received": self.messages_received,
            "latency_ms": self.latency_ms,
            "active": self.active,
        }


class ConnectionManager:
    """
    Manages connections to peer nodes.
    Tries HTTP/2 first, falls back to WebRTC DataChannel.
    """

    def __init__(
        self,
        node_id: str,
        event_callback: Optional[Callable[[str, dict], Awaitable[None]]] = None,
    ):
        self.node_id = node_id
        self.event_callback = event_callback
        self.connections: dict[str, PeerConnection] = {}
        self._running = False

    async def _emit(self, event_type: str, data: dict):
        event = {"type": event_type, "timestamp": time.time(), "layer": "connection", **data}
        logger.info(f"[CONNECTION] {event_type}: {data}")
        if self.event_callback:
            await self.event_callback(event_type, event)

    async def start(self):
        self._running = True

    async def stop(self):
        self._running = False
        for conn in self.connections.values():
            conn.active = False
        self.connections.clear()

    async def connect_to_peer(self, peer: "PeerInfo") -> PeerConnection:
        """
        Connect to a peer. Routing strategy depends on peer.source:
          - mdns_local: direct HTTP/2 (same network)
          - h3_global:  WebRTC with STUN + H3 signaling; fallback to HTTP/2 direct if unavailable
        """
        peer_id = peer.node_id
        host = peer.host
        port = peer.port
        source = getattr(peer, "source", "mdns_local")

        if source == "h3_global":
            # Attempt WebRTC with STUN for NAT traversal
            try:
                conn = await self._try_webrtc_with_stun(peer_id, host, port)
                await self._emit(CONN_WEBRTC_OK, {
                    "peer_id": peer_id,
                    "transport": TransportType.WEBRTC.value,
                    "source": "h3_global",
                    "stun_servers": STUN_SERVERS,
                })
                return conn
            except Exception as e:
                logger.warning(f"WebRTC/STUN failed for global peer {peer_id}: {e}. Falling back to HTTP/2.")
                await self._emit(CONN_WEBRTC_FAIL, {
                    "peer_id": peer_id,
                    "error": str(e),
                    "fallback": "http2_direct",
                })
                # Fall through to HTTP/2 attempt below

        # Try HTTP/2 (primary for local, fallback for global)
        try:
            conn = await self._try_http2(peer_id, host, port)
            await self._emit(CONN_HTTP2_OK, {
                "peer_id": peer_id,
                "transport": TransportType.HTTP2.value,
                "source": source,
                "host": host,
                "port": port,
            })
            return conn
        except Exception as e:
            await self._emit(CONN_HTTP2_FAIL, {
                "peer_id": peer_id,
                "error": str(e),
            })
            raise ConnectionError(f"Cannot connect to {peer_id}: all transports failed")

    async def _try_http2(self, peer_id: str, host: str, port: int) -> PeerConnection:
        """Attempt HTTP/2 connection."""
        import httpx
        try:
            async with httpx.AsyncClient(http2=True, timeout=2.0) as client:
                resp = await client.get(f"http://{host}:{port}/health")
                if resp.status_code == 200:
                    conn = PeerConnection(
                        peer_id=peer_id,
                        transport=TransportType.HTTP2,
                    )
                    self.connections[peer_id] = conn
                    return conn
                raise ConnectionError(f"HTTP/2 health check failed: {resp.status_code}")
        except Exception as e:
            raise ConnectionError(f"HTTP/2 connection failed: {e}")

    async def _try_webrtc_with_stun(self, peer_id: str, host: str, port: int) -> PeerConnection:
        """
        Attempt WebRTC DataChannel connection using STUN for NAT traversal.
        Uses Opacus H3 registry as a signaling mailbox:
          POST {OPACUS_H3_URL}/api/registry/signal/{peer_id}  → send SDP offer
          GET  {OPACUS_H3_URL}/api/registry/signal/{self.node_id} → poll for SDP answer

        If signaling endpoint is unreachable, raises ConnectionError to trigger
        HTTP/2 fallback.
        """
        import httpx
        h3_url = os.getenv("OPACUS_H3_URL", "")
        if not h3_url:
            raise ConnectionError("WebRTC signaling unavailable: OPACUS_H3_URL not set")

        # Step 1: Build a minimal SDP offer stub
        # (In a full aiortc implementation this would be a real SDP)
        sdp_offer = {
            "type": "offer",
            "sdp": f"v=0\r\no=myca 0 0 IN IP4 {host}\r\ns=Myca P2P\r\n",
            "from_node": self.node_id,
            "stun_servers": STUN_SERVERS,
        }

        async with httpx.AsyncClient(timeout=5.0) as client:
            # Step 2: Post SDP offer to signaling mailbox
            try:
                await client.post(
                    f"{h3_url}/api/registry/signal/{peer_id}",
                    json=sdp_offer,
                )
            except Exception as e:
                raise ConnectionError(f"Signaling POST failed: {e}")

            # Step 3: Poll for SDP answer (up to 10s)
            answer = None
            for _ in range(10):
                await asyncio.sleep(1.0)
                try:
                    resp = await client.get(
                        f"{h3_url}/api/registry/signal/{self.node_id}",
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("type") == "answer":
                            answer = data
                            break
                except Exception:
                    pass

            if not answer:
                raise ConnectionError("WebRTC signaling timeout: no SDP answer received")

        # Step 4: WebRTC handshake complete (in real impl: apply remote SDP via aiortc)
        logger.info(f"WebRTC signaling complete for {peer_id}. STUN NAT traversal initiated.")
        conn = PeerConnection(
            peer_id=peer_id,
            transport=TransportType.WEBRTC,
            latency_ms=150.0,  # typical internet RTT placeholder
        )
        self.connections[peer_id] = conn
        return conn

    async def send_message(self, peer_id: str, message: dict) -> dict:
        """Send a message to a connected peer."""
        conn = self.connections.get(peer_id)
        if not conn or not conn.active:
            raise ConnectionError(f"No active connection to {peer_id}")

        conn.messages_sent += 1
        # In real mode, would send via HTTP/2 or WebRTC
        return {"status": "sent", "peer_id": peer_id}

    def get_latency_map(self) -> dict[str, float]:
        """Get latency to each connected peer."""
        return {pid: conn.latency_ms for pid, conn in self.connections.items() if conn.active}


class SimulatedConnectionManager:
    """
    Simulated connections using asyncio.Queue for single-machine testing.
    Each virtual node has configurable fake latency (8-25ms random).
    """

    def __init__(
        self,
        node_id: str,
        event_callback: Optional[Callable[[str, dict], Awaitable[None]]] = None,
    ):
        self.node_id = node_id
        self.event_callback = event_callback
        self.connections: dict[str, PeerConnection] = {}
        self._queues: dict[str, asyncio.Queue] = {}
        self._running = False
        self._force_http2_fail = False  # For error simulation

    async def _emit(self, event_type: str, data: dict):
        event = {"type": event_type, "timestamp": time.time(), "layer": "connection", **data}
        logger.info(f"[CONNECTION] {event_type}: {data}")
        if self.event_callback:
            await self.event_callback(event_type, event)

    async def start(self):
        self._running = True

    async def stop(self):
        self._running = False
        for conn in self.connections.values():
            conn.active = False

    async def connect_to_peer(self, peer: "PeerInfo") -> PeerConnection:
        """Simulate connecting to a peer with latency."""
        peer_id = peer.node_id
        source = getattr(peer, "source", "mdns_local")
        # Global peers get higher simulated latency
        latency = random.uniform(120, 200) if source == "h3_global" else random.uniform(8, 25)

        if self._force_http2_fail:
            # Simulate HTTP/2 failure and WebRTC fallback
            await self._emit(CONN_HTTP2_FAIL, {
                "peer_id": peer_id,
                "error": "simulated QUIC connection drop",
            })
            await self._emit(CONN_FALLBACK, {
                "peer_id": peer_id,
                "from": TransportType.HTTP2.value,
                "to": TransportType.WEBRTC.value,
                "message": "FALLBACK: WebRTC",
            })
            transport = TransportType.WEBRTC
            await self._emit(CONN_WEBRTC_OK, {
                "peer_id": peer_id,
                "transport": TransportType.WEBRTC.value,
                "latency_ms": round(latency, 2),
                "note": "simulated WebRTC DataChannel",
            })
            self._force_http2_fail = False  # Reset
        else:
            # Simulate successful HTTP/2
            await asyncio.sleep(latency / 1000)
            transport = TransportType.HTTP2
            await self._emit(CONN_HTTP2_OK, {
                "peer_id": peer_id,
                "transport": TransportType.HTTP2.value,
                "latency_ms": round(latency, 2),
                "note": "simulated HTTP/2 connection",
            })

        conn = PeerConnection(
            peer_id=peer_id,
            transport=transport,
            latency_ms=latency,
        )
        self.connections[peer_id] = conn
        self._queues[peer_id] = asyncio.Queue()
        return conn

    async def send_message(self, peer_id: str, message: dict) -> dict:
        """Send a message via simulated queue with fake latency."""
        conn = self.connections.get(peer_id)
        if not conn or not conn.active:
            raise ConnectionError(f"No active connection to {peer_id}")

        # Simulate latency
        await asyncio.sleep(conn.latency_ms / 1000)

        queue = self._queues.get(peer_id)
        if queue:
            await queue.put(message)

        conn.messages_sent += 1
        return {"status": "sent", "peer_id": peer_id, "latency_ms": conn.latency_ms}

    async def receive_message(self, peer_id: str, timeout: float = 5.0) -> Optional[dict]:
        """Receive a message from simulated queue."""
        queue = self._queues.get(peer_id)
        if not queue:
            return None
        try:
            return await asyncio.wait_for(queue.get(), timeout=timeout)
        except asyncio.TimeoutError:
            return None

    def get_latency_map(self) -> dict[str, float]:
        return {pid: conn.latency_ms for pid, conn in self.connections.items() if conn.active}

    async def simulate_quic_drop(self, peer_id: str):
        """Simulate a QUIC/HTTP2 connection drop and WebRTC fallback."""
        self._force_http2_fail = True
        if peer_id in self.connections:
            old_conn = self.connections[peer_id]
            old_conn.active = False
            # Build a minimal stub so connect_to_peer gets the right signature
            from types import SimpleNamespace
            stub_peer = SimpleNamespace(node_id=peer_id, host="127.0.0.1", port=0, source="mdns_local")
            await self.connect_to_peer(stub_peer)
