from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class Intent:
    def __init__(self, action: str, required_skills: List[str], payload: Any):
        self.action = action
        self.required_skills = required_skills
        self.payload = payload

class IntentEngine:
    """
    Parses user requests into actionable intents.
    For Phase 1 MVP, we use simple heuristic matching.
    Later this will be powered by a small local LLM.
    """
    def parse(self, user_prompt: str) -> Intent:
        prompt_lower = user_prompt.lower()
        
        if "özetle" in prompt_lower or "summarize" in prompt_lower:
            return Intent("summarize", ["text_processing", "summarization"], user_prompt)
        elif "çevir" in prompt_lower or "translate" in prompt_lower:
            return Intent("translate", ["translation"], user_prompt)
        elif "görsel" in prompt_lower or "image" in prompt_lower or "fotoğraf" in prompt_lower:
            return Intent("vision", ["vision"], user_prompt)
        
        # Default fallback
        return Intent("chat", ["text_generation"], user_prompt)
