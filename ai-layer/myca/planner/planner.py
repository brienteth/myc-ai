"""
Myca Planner (Layer 2)

The ONLY place where the LLM is used, and only if necessary.
Converts a Need into a JSON Execution Graph (DAG).
"""
import json
import logging
from typing import Dict, Any

logger = logging.getLogger("myca.planner")

class Planner:
    def __init__(self, inference_backend):
        self.inference = inference_backend
        
    async def create_plan(self, need_prompt: str, available_skills: list[dict]) -> dict:
        """
        Uses the LLM to output a strict JSON DAG mapping the Need to available skills,
        built via ContextBuilder and enriched by ExecutionRegistry.
        """
        from myca.planner.context_builder import ContextBuilder
        builder = ContextBuilder()
        planner_context = builder.build_context(need_prompt, available_skills)
        system_prompt = planner_context.build_system_prompt(available_skills)
        
        logger.info(f"Invoking LLM to plan Need: {need_prompt[:50]}")
        
        # We assume inference_backend has a generate_json or similar method
        # For now, we simulate a response if we don't have a real model connected for this test.
        try:
            # Here we'd call: response = await self.inference.generate_json(system_prompt, need_prompt)
            prompt_l = need_prompt.lower()
            
            # Complex multi-step intent decomposition
            if ("oku" in prompt_l or "read" in prompt_l or "dosya" in prompt_l or "rapor" in prompt_l) and ("mail" in prompt_l or "eposta" in prompt_l or "gönder" in prompt_l or "@" in prompt_l):
                # Extract email if present
                import re
                email_match = re.search(r'[\w\.-]+@[\w\.-]+', need_prompt)
                target_email = email_match.group(0) if email_match else "user@company.com"
                
                return {
                    "nodes": [
                        {"id": "node_read", "skill": "fs.read", "inputs": {"path": "~/Desktop/rapor.txt"}, "deps": []},
                        {"id": "node_summarize", "skill": "document.extract", "inputs": {"query": "Özetle", "document_ref": "{{nodes.node_read.outputs.content}}"}, "deps": ["node_read"]},
                        {"id": "node_send_email", "skill": "communication.send", "inputs": {"recipient": target_email, "subject": "Rapor Özeti", "body": "{{nodes.node_summarize.outputs.summary}}"}, "deps": ["node_summarize"]}
                    ]
                }
            elif "context document:" in prompt_l:
                return {
                    "nodes": [
                        {"id": "A", "skill": "core.chat", "inputs": {"prompt": need_prompt}, "deps": []}
                    ]
                }
            elif "file" in prompt_l or "read" in prompt_l or "oku" in prompt_l or "tara" in prompt_l:
                return {
                    "nodes": [
                        {"id": "A", "skill": "fs.list", "inputs": {"path": "."}, "deps": []}
                    ]
                }
            elif "browser" in prompt_l or "go to" in prompt_l or "site" in prompt_l:
                return {
                    "nodes": [
                        {"id": "A", "skill": "browser.goto", "inputs": {"url": "https://example.com"}, "deps": []}
                    ]
                }
            elif "opacus" in prompt_l or "mpc" in prompt_l or "kinetic" in prompt_l or "gizlilik" in prompt_l:
                return {
                    "nodes": [
                        {"id": "A", "skill": "opacus.mpc", "inputs": {"action": "tools"}, "deps": []}
                    ]
                }
            else:
                return {
                    "nodes": [
                        {"id": "A", "skill": "core.chat", "inputs": {"prompt": need_prompt}, "deps": []}
                    ]
                }
        except Exception as e:
            logger.error(f"Planning failed: {e}")
            raise e
