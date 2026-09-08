import os
import logging
from typing import Dict, Any, List
import httpx

from myca.inference.registry import BackendRegistry
from myca.inference.backends.zgcompute import ZeroGComputeBackend
from myca.inference.backends.mock import MockBackend

logger = logging.getLogger("myca_intelligence.inference.inference_router")

class InferenceRouter:
    """
    Intelligent Inference Router.
    Switches between Local Model, Colony Home Mesh peers, and ZeroG remote cloud fallback.
    """

    def __init__(self, node_ref=None):
        self.node = node_ref
        if self.node and getattr(self.node, "inference_engine", None):
            self.local_backend = self.node.inference_engine
        else:
            self.local_backend = BackendRegistry.create_backend("auto")
        self.remote_backend = ZeroGComputeBackend()
        self.mock_backend = MockBackend()
        
    async def route_and_generate(self, prompt: str, context: Dict[str, Any], system_prompt: str = "") -> Dict[str, Any]:
        """
        Orchestrates model routing based on constraints (privacy, latency, mesh capability).
        """
        # Formulate complete prompt combining system context
        full_prompt = f"{system_prompt}\n\n{context.get('system_context', '')}\n\nUser Question/Task: {prompt}"
        
        # Refresh local_backend reference if node initialized its inference engine
        if self.node and getattr(self.node, "inference_engine", None):
            self.local_backend = self.node.inference_engine

        # 1. Determine complexity
        intent_mode = context.get("intent_mode", "SIMPLE")
        is_simple = intent_mode in ["CHAT", "QUESTION", "KNOWLEDGE_RETRIEVAL"]

        # Check Local-Only constraint
        is_local_only = context.get("is_local_only", False) or is_simple
        
        # Get active peers with inference capability from Colony
        active_peers = []
        if self.node and getattr(self.node, "discovery", None):
            # Filter active peers
            peers = self.node.discovery.get_active_peers()
            active_peers = [p for p in peers if hasattr(p, "capabilities") and "inference" in p.capabilities]

        # Scenario A: Simple requests go straight to Local Model (Metal GPU, $0, Offline)
        if is_simple:
            logger.info("[ROUTER] Simple request detected. Routing directly to Local Model.")
            try:
                res = await self.local_backend.generate(full_prompt)
                return {
                    "response": res,
                    "provider": f"Local Engine ({type(self.local_backend).__name__})",
                    "route": "LOCAL",
                    "model": "Qwen2.5-3B",
                    "fallback_used": False,
                    "cost": 0.00
                }
            except Exception as e:
                logger.warning(f"[ROUTER] Local Model simple generation failed: {e}")
                # Fallback to Mock
                res = await self.mock_backend.generate(full_prompt)
                return {
                    "response": res,
                    "provider": "Mock Local Fallback",
                    "route": "LOCAL_MOCK",
                    "model": "Mock-3B",
                    "fallback_used": True,
                    "cost": 0.00
                }

        # Scenario B: Complex task -> Try Local Model First
        logger.info(f"[ROUTER] Complex task ({intent_mode}) detected. Evaluating Local capability first...")
        local_success = False
        local_res = ""
        try:
            local_res = await self.local_backend.generate(full_prompt)
            # Simple capability check: check if model says it is incapable or errors
            incapable_indicators = ["yapamam", "yetkim yok", "can't do", "unable to", "cannot assist", "error"]
            if not any(indicator in local_res.lower() for indicator in incapable_indicators) and type(self.local_backend).__name__ != "MockBackend":
                local_success = True
        except Exception as e:
            logger.warning(f"[ROUTER] Local capability execution failed: {e}")

        if local_success:
            return {
                "response": local_res,
                "provider": f"Local Engine ({type(self.local_backend).__name__})",
                "route": "LOCAL",
                "model": "Qwen2.5-3B",
                "fallback_used": False,
                "cost": 0.00
            }

        # Local model is incapable or failed -> Check trusted mesh nodes
        logger.info("[ROUTER] Local model insufficient or failed. Checking trusted Colony Mesh nodes...")
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
                            "model": "Colony-Mesh-Shared",
                            "fallback_used": True,
                            "cost": 0.00
                        }
            except Exception as e:
                logger.warning(f"[ROUTER] Mesh routing failed: {e}")

        # Escalate to 0G Cloud Remote Compute only if permitted (not local only)
        if not is_local_only:
            logger.info("[ROUTER] Mesh failed or unavailable. Escalating to 0G Cloud Compute...")
            try:
                res = await self.remote_backend.generate(full_prompt)
                if "error" not in res.lower():
                    return {
                        "response": res,
                        "provider": "ZeroG Cloud Compute",
                        "route": "ZERO_G",
                        "model": "gpt-5.6-sol",
                        "fallback_used": True,
                        "cost": 0.014
                    }
            except Exception as e:
                logger.warning(f"[ROUTER] ZeroG fallback escalation failed: {e}")
                
        # Last resort: Mock Backend
        logger.info("[ROUTER] Falling back to Mock local engine.")
        res = await self.mock_backend.generate(full_prompt)
        return {
            "response": res,
            "provider": "Mock Local Fallback",
            "route": "LOCAL_MOCK",
            "model": "Mock-3B",
            "fallback_used": True,
            "cost": 0.00
        }
