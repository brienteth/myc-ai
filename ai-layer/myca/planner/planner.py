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
        Uses the LLM to output a strict JSON DAG mapping the Need to available skills.
        """
        system_prompt = f"""You are the Myca Planner OS.
        You translate user Needs into a deterministic Execution Graph (DAG).
        Output ONLY valid JSON.
        
        Available Skills:
        {json.dumps(available_skills, indent=2)}
        
        Format:
        {{
            "nodes": [
                {{"id": "A", "skill": "skill.name", "inputs": {{"param": "val"}}, "deps": []}}
            ]
        }}
        """
        
        logger.info(f"Invoking LLM to plan Need: {need_prompt[:50]}")
        
        # We assume inference_backend has a generate_json or similar method
        # For now, we simulate a response if we don't have a real model connected for this test.
        try:
            # Here we'd call: response = await self.inference.generate_json(system_prompt, need_prompt)
            # Simulating basic parsing for now based on user intent
            if "file" in need_prompt.lower() or "read" in need_prompt.lower():
                return {
                    "nodes": [
                        {"id": "A", "skill": "fs.list", "inputs": {"path": "."}, "deps": []}
                    ]
                }
            elif "browser" in need_prompt.lower() or "go to" in need_prompt.lower():
                return {
                    "nodes": [
                        {"id": "A", "skill": "browser.goto", "inputs": {"url": "https://example.com"}, "deps": []}
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
