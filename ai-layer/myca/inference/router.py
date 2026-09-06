"""
Local-First Inference Router for Myca OS (P0.4)
Handles capability matrix checks and routes requests via escalation:
LOCAL -> COLONY -> 0G
Gated by Context Length, Node Load, and Privacy Lock.
"""

import os
import logging
import asyncio
from typing import AsyncGenerator, Dict, List, Any, Optional

from .engine import InferenceEngine
from ..contracts.device import TrustState, CapabilityScope
from ..registry import DeviceCapabilityRegistry

logger = logging.getLogger("myca.inference.router")

class LocalFirstInferenceRouter(InferenceEngine):
    """
    Core Inference Router.
    Gaters and routes inference calls based on context size, node load, and privacy levels.
    """

    def __init__(self, local_engine: InferenceEngine, registry: DeviceCapabilityRegistry, node_instance = None):
        self.local_engine = local_engine
        self.registry = registry
        self.node_instance = node_instance

    def _determine_route(self, prompt: str, required_ctx: int, privacy_level: str) -> str:
        """
        Decides where to route: 'local', 'colony:<device_id>', or '0g'.
        """
        # 1. Enforce Privacy Lock
        is_local_only = (privacy_level == "LOCAL_ONLY" or os.getenv("MYCA_PRIVACY_LEVEL") == "LOCAL_ONLY")

        # 2. Check local engine context and load
        local_max_ctx = int(os.getenv("MYCA_CTX", "4096"))
        local_load = getattr(self.node_instance, "current_load", 0.0) if self.node_instance else 0.0

        if local_max_ctx >= required_ctx and local_load <= 0.8:
            logger.info(f"[ROUTER] Routing to LOCAL backend (context: {required_ctx} <= {local_max_ctx}, load: {local_load:.2f})")
            return "local"

        # 3. Escalate to COLONY
        trusted_devices = self.registry.find_devices_with_capability("local_llm.inference")
        colony_candidates = []
        for dev in trusted_devices:
            if dev.is_self:
                continue
            # Assume remote colony nodes can support up to 16k context size by default
            dev_max_ctx = 16384
            if dev_max_ctx >= required_ctx:
                colony_candidates.append(dev)

        if colony_candidates:
            selected_peer = colony_candidates[0]
            logger.info(f"[ROUTER] Escalating to COLONY node '{selected_peer.device_id}' (context size supports {required_ctx})")
            return f"colony:{selected_peer.device_id}"

        # 4. Escalate to 0G Cloud
        if is_local_only:
            logger.error("[ROUTER] Fail-secure: Request requires remote compute but blocked by LOCAL_ONLY privacy policy")
            raise PermissionError("BLOCKED_BY_PRIVACY_POLICY: 0G cloud execution is disabled for LOCAL_ONLY requests")

        logger.info(f"[ROUTER] Escalating to 0G Compute Network (context length: {required_ctx}, privacy level: {privacy_level})")
        return "0g"

    async def generate(self, prompt: str, **kwargs) -> str:
        required_ctx = kwargs.get("required_context_length", len(prompt) // 3 + 500)
        privacy_level = kwargs.get("privacy_level", "ANY")

        route = self._determine_route(prompt, required_ctx, privacy_level)

        if route == "local":
            return await self.local_engine.generate(prompt, **kwargs)
        elif route.startswith("colony:"):
            peer_id = route.split(":")[1]
            return await self._execute_remote_llm(peer_id, prompt, **kwargs)
        elif route == "0g":
            from .backends.zgcompute import ZeroGComputeBackend
            zg_backend = ZeroGComputeBackend()
            kwargs["force_remote"] = True
            return await zg_backend.generate(prompt, **kwargs)

        return "Routing error"

    async def stream(self, prompt: str, **kwargs) -> AsyncGenerator[str, None]:
        required_ctx = kwargs.get("required_context_length", len(prompt) // 3 + 500)
        privacy_level = kwargs.get("privacy_level", "ANY")

        route = self._determine_route(prompt, required_ctx, privacy_level)

        if route == "local":
            async for token in self.local_engine.stream(prompt, **kwargs):
                yield token
        elif route.startswith("colony:"):
            peer_id = route.split(":")[1]
            result = await self._execute_remote_llm(peer_id, prompt, **kwargs)
            for word in result.split(" "):
                yield word + " "
                await asyncio.sleep(0.01)
        elif route == "0g":
            from .backends.zgcompute import ZeroGComputeBackend
            zg_backend = ZeroGComputeBackend()
            kwargs["force_remote"] = True
            async for token in zg_backend.stream(prompt, **kwargs):
                yield token

    async def _execute_remote_llm(self, peer_id: str, prompt: str, **kwargs) -> str:
        if not self.node_instance:
            raise ValueError("No local node instance context provided for remote execution")

        payload = {
            "type": "execute_task",
            "skill": "local_llm.inference",
            "inputs": {"prompt": prompt, **kwargs},
        }

        if self.node_instance.simulate:
            await self.node_instance.connection.send_message(peer_id, payload)
            response = await self.node_instance.connection.receive_message(peer_id, timeout=15.0)
            if response and response.get("type") == "execute_task_result":
                if response.get("success", False):
                    outputs = response.get("outputs", {})
                    return outputs.get("text") or outputs.get("response") or str(outputs)
            raise RuntimeError(f"Remote LLM execution failed on simulated node {peer_id}")
        else:
            peer = next((p for p in self.node_instance.discovery.get_active_peers() if p.node_id == peer_id), None)
            if not peer:
                raise ConnectionError(f"Colony node {peer_id} is no longer online")

            import httpx
            from myca.transport import create_envelope, receive_envelope
            from myca.identity import get_or_create_identity_key
            private_key = get_or_create_identity_key()

            envelope = create_envelope(
                sender=self.node_instance.node_id,
                recipient=peer_id,
                payload=payload,
                private_key=private_key,
                crypto=self.node_instance.crypto
            )

            url = f"http://{peer.host}:{peer.port}/api/execute"
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(url, json=envelope.to_dict())
                if resp.status_code == 200:
                    resp_data = resp.json()
                    peer_pub = peer.public_key or ""
                    res_payload, status = receive_envelope(
                        data=resp_data,
                        sender_public_key_hex=peer_pub,
                        expected_recipient=self.node_instance.node_id,
                        crypto=self.node_instance.crypto
                    )
                    if res_payload and res_payload.get("type") == "execute_task_result":
                        if res_payload.get("success", False):
                            outputs = res_payload.get("outputs", {})
                            return outputs.get("text") or outputs.get("response") or str(outputs)

            raise RuntimeError(f"Remote LLM network execution failed on node {peer_id}")

    async def embed(self, text: str) -> List[float]:
        return await self.local_engine.embed(text)

    async def rerank(self, query: str, documents: List[str]) -> List[float]:
        return await self.local_engine.rerank(query, documents)

    async def classify(self, text: str, labels: List[str]) -> Dict[str, float]:
        return await self.local_engine.classify(text, labels)

    async def tokenize(self, text: str) -> List[int]:
        return await self.local_engine.tokenize(text)

    async def detokenize(self, tokens: List[int]) -> str:
        return await self.local_engine.detokenize(tokens)

    async def vision(self, image_path: str, prompt: str) -> str:
        return await self.local_engine.vision(image_path, prompt)

    async def transcribe(self, audio_path: str) -> str:
        return await self.local_engine.transcribe(audio_path)

    async def synthesize(self, text: str) -> bytes:
        return await self.local_engine.synthesize(text)
