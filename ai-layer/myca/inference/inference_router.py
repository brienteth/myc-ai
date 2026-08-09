import os
import logging
from typing import Dict, Any, List
import httpx

from myca.inference.backends.ollama import OllamaBackend
from myca.inference.backends.zgcompute import ZeroGComputeBackend
from myca.inference.backends.mock import MockBackend

logger = logging.getLogger("myca.inference.inference_router")

class InferenceRouter:
    """
    Intelligent Inference Router.
    Switches between Local Model, Colony Home Mesh peers, and ZeroG remote cloud fallback.
    """

    def __init__(self, node_ref=None):
        self.node = node_ref
        self.local_backend = OllamaBackend()
        self.remote_backend = ZeroGComputeBackend()
        self.mock_backend = MockBackend()
        
    async def route_and_generate(self, prompt: str, context: Dict[str, Any], system_prompt: str = "") -> Dict[str, Any]:
        """
        Orchestrates model routing based on constraints (privacy, latency, mesh capability).
        """
        # Formulate complete prompt combining system context
        full_prompt = f"{system_prompt}\n\n{context.get('system_context', '')}\n\nUser Question/Task: {prompt}"
        
        # Check Local-Only constraint
        is_local_only = context.get("is_local_only", False)
        
        # Get active peers with inference capability from Colony
        active_peers = []
        if self.node and self.node.discovery:
            # Filter active peers
            peers = self.node.discovery.get_active_peers()
            active_peers = [p for p in peers if hasattr(p, "capabilities") and "inference" in p.capabilities]

        # 1. Try Local Ollama Backend
        try:
            logger.info("[ROUTER] Attempting Local Model generation...")
            res = await self.local_backend.generate(full_prompt)
            if "bağlantı hatası" not in res and "error" not in res.lower():
                return {
                    "response": res,
                    "provider": "Local Ollama Backend",
                    "route": "LOCAL",
                    "cost": 0.00
                }
        except Exception as e:
            logger.warning(f"[ROUTER] Local Ollama generate failed: {e}")

        # 2. Try Home Mesh peers
        if active_peers:
            best_peer = active_peers[0]
            peer_url = f"http://{best_peer.ip}:{best_peer.port}/v1/chat/completions"
            logger.info(f"[ROUTER] Routing to Colony Mesh Peer: {best_peer.node_id} ({peer_url})")
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    payload = {
                        "model": "myca-mesh-shard",
                        "messages": [{"role": "user", "content": full_prompt}],
                        "stream": False
                    }
                    resp = await client.post(peer_url, json=payload)
                    if resp.status_code == 200:
                        return {
                            "response": resp.json()["choices"][0]["message"]["content"],
                            "provider": f"Colony Mesh Peer ({best_peer.node_id})",
                            "route": "HOME_MESH",
                            "cost": 0.00
                        }
            except Exception as e:
                logger.warning(f"[ROUTER] Mesh routing failed: {e}")

        # 3. Try ZeroG Fallback (if local only is not flagged)
        if not is_local_only:
            logger.info("[ROUTER] Routing to ZeroG fallback compute...")
            try:
                res = await self.remote_backend.generate(full_prompt)
                if "error" not in res.lower():
                    return {
                        "response": res,
                        "provider": "ZeroG Cloud Compute",
                        "route": "ZERO_G",
                        "cost": 0.03
                    }
            except Exception as e:
                logger.warning(f"[ROUTER] ZeroG fallback failed: {e}")
                
        # Last resort: Mock Backend
        logger.info("[ROUTER] Falling back to Mock local engine.")
        res = await self.mock_backend.generate(prompt)
        return {
            "response": res,
            "provider": "Mock Local Fallback",
            "route": "LOCAL_MOCK",
            "cost": 0.00
        }
