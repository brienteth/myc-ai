import logging
import uuid
import time
from typing import Dict, Any, List
from myca.inference.context_orchestrator import ContextOrchestrator
from myca.inference.inference_router import InferenceRouter
from myca.automation.brain import VaultDB

logger = logging.getLogger("myca.inference.assistant")

class MycaAssistant:
    """
    Unified Myca OS AI Assistant.
    Orchestrates the entire loop: Intent -> Context -> Router -> Execution -> Verification -> Memory.
    """

    def __init__(self, node_ref=None):
        self.node = node_ref
        self.orchestrator = ContextOrchestrator()
        self.router = InferenceRouter(node_ref)
        self.system_prompt = (
            "You are Myca, a local-first Yapay Zeka Otomasyon İşletim Sistemi. "
            "You have direct access to local memory, files, and mesh devices. "
            "Help the user by either answering questions (KNOWLEDGE_MODE) or "
            "formulating execution graphs (EXECUTION_MODE)."
        )

    async def process_prompt(self, prompt: str, history: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Main unified cognitive cycle.
        """
        history = history or []
        start_time = time.time()
        
        # 1. Intent Classification (Heuristic Mode switch)
        mode = "KNOWLEDGE_MODE"
        exec_keywords = ["gönder", "send", "run", "çalıştır", "yap", "yaz", "create", "deploy", "update", "güncelle", "build"]
        if any(kw in prompt.lower() for kw in exec_keywords):
            mode = "EXECUTION_MODE"

        logger.info(f"[ASSISTANT] Processing prompt in {mode}: '{prompt[:45]}'")

        # 2. Context Orchestrator
        # Pull episodic, semantic, decision, and handover layers
        context = await self.orchestrator.build_context(prompt, history)

        # 3. Inference Routing
        # Dispatch prompt + context to the optimal model provider
        inference_result = await self.router.route_and_generate(prompt, context, self.system_prompt)
        response_text = inference_result.get("response", "")

        # 4. Mode Execution
        plan_data = None
        if mode == "EXECUTION_MODE" and self.node and hasattr(self.node, "execution_engine"):
            try:
                # Ask execution engine to build execution plan/contract
                plan_data = await self.node.execution_engine.plan(prompt)
                response_text += "\n\n[Execution Plan Auto-Generated. Click 'Build Plan' to inspect in Studio.]"
            except Exception as e:
                logger.error(f"[ASSISTANT] Failed to generate execution plan: {e}")

        # 5. Memory Write-Back
        # Check if the prompt/response is a durable preference/decision to be saved
        if self._is_durable_memory(prompt, response_text):
            logger.info("[ASSISTANT] Durable decision/note detected. Writing back to Second Brain...")
            note_id = f"note-{uuid.uuid4().hex[:8]}"
            VaultDB.save_note({
                "id": note_id,
                "title": f"Learned Preference: {prompt[:50]}",
                "content_preview": response_text[:400],
                "tags": ["learned", "preference", "decision"],
                "links": [],
                "source_type": "decision",
                "created_at": time.time()
            })

        latency = time.time() - start_time

        return {
            "response": response_text,
            "mode": mode,
            "provider": inference_result.get("provider", "Local Fallback"),
            "route": inference_result.get("route", "LOCAL"),
            "cost": inference_result.get("cost", 0.00),
            "latency_s": round(latency, 2),
            "context_details": context.get("details", {}),
            "plan": plan_data
        }

    def _is_durable_memory(self, prompt: str, response: str) -> bool:
        """Determines if the interaction contains persistent preference or decision memory."""
        durable_triggers = ["her zaman", "always", "bundan sonra", "decide", "karar", "tercih", "preference", "policy"]
        return any(trig in prompt.lower() for trig in durable_triggers)
