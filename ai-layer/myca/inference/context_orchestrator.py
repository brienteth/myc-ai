import logging
import time
from typing import Dict, Any, List, Optional
from myca.automation.brain import VaultDB

logger = logging.getLogger("myca.inference.context_orchestrator")

class ContextOrchestrator:
    """
    Orchestrates the multi-layered context construction.
    Collects Episodic, Semantic, Decision, Procedural, and Handover memories.
    """

    def __init__(self):
        VaultDB.init_tables()

    async def build_context(self, prompt: str, history: List[Dict[str, Any]], policy_filter: Optional[str] = None) -> Dict[str, Any]:
        """
        Builds a structured context dictionary containing all relevant memory layers.
        """
        logger.info(f"[ORCHESTRATOR] Building context for prompt: '{prompt[:40]}'")
        
        # 1. Episodic Memory (Recent chat history)
        episodic = history[-10:] if history else []

        # 2. Semantic Memory (VaultDB index keyword match)
        # We perform keyword-based lookup in VaultDB
        semantic_notes = []
        keywords = [w.strip(",.?!\"'") for w in prompt.lower().split() if len(w) > 3]
        
        seen_ids = set()
        for kw in keywords[:5]: # Search top 5 keywords to avoid bloated DB queries
            notes = VaultDB.search_notes(kw, limit=3)
            for n in notes:
                if n["id"] not in seen_ids:
                    seen_ids.add(n["id"])
                    semantic_notes.append(n)

        # 3. Decision Memory
        # Extract decisions from VaultDB notes labeled as "decision" or containing "decision" keywords
        decisions = []
        decision_notes = VaultDB.get_notes(source_type="decision", limit=5)
        for dn in decision_notes:
            decisions.append(dn.get("content_preview") or dn.get("title"))
            
        # Also grab notes containing "karar" or "decision" in semantic notes
        for n in semantic_notes:
            if "decision" in n["tags"] or "karar" in n["tags"] or "karar" in n["title"].lower() or "decision" in n["title"].lower():
                decisions.append(n.get("content_preview") or n.get("title"))

        # 4. Handover Memory (Resume details)
        latest_handover = VaultDB.get_latest_handover()
        handover_data = None
        if latest_handover:
            handover_data = {
                "id": latest_handover.get("id"),
                "summary": latest_handover.get("summary"),
                "decisions": latest_handover.get("decisions", []),
                "next_steps": latest_handover.get("next_steps", []),
                "open_questions": latest_handover.get("open_questions", [])
            }

        # 5. Working Memory (Current task goals)
        working_task = {
            "current_goal": prompt,
            "timestamp": time.time()
        }

        # 6. Apply policy constraints (GDPR, local-only, etc.)
        is_local_only = False
        if policy_filter:
            # Simple check if prompt triggers policy restrictions
            if any(p in prompt.lower() for p in ["pass", "token", "secret", "private", "credential"]):
                is_local_only = True

        # Combine into Markdown representation for the model
        system_context = self.format_markdown_context(
            episodic, semantic_notes, decisions, handover_data, working_task
        )

        return {
            "system_context": system_context,
            "is_local_only": is_local_only,
            "retrieved_notes_count": len(semantic_notes),
            "retrieved_decisions_count": len(decisions),
            "has_handover": latest_handover is not None,
            "details": {
                "notes": [n["title"] for n in semantic_notes],
                "decisions": decisions[:5],
                "handover_id": latest_handover.get("id") if latest_handover else None
            }
        }

    def format_markdown_context(self, episodic: List[Dict[str, Any]], semantic: List[Dict[str, Any]], 
                                decisions: List[str], handover: Optional[Dict[str, Any]], 
                                working: Dict[str, Any]) -> str:
        """Formats the layers into a unified, clean markdown prompt section."""
        parts = []

        parts.append("# CURRENT TASK (WORKING MEMORY)")
        parts.append(f"Goal: {working['current_goal']}")
        parts.append("")

        if handover:
            parts.append("# RESUMED CONTEXT (HANDOVER MEMORY)")
            parts.append(f"Latest Handover Summary: {handover['summary']}")
            if handover["next_steps"]:
                parts.append("Next Steps:")
                for step in handover["next_steps"]:
                    parts.append(f"- [ ] {step}")
            if handover["open_questions"]:
                parts.append("Open Questions:")
                for q in handover["open_questions"]:
                    parts.append(f"- ? {q}")
            parts.append("")

        if decisions:
            parts.append("# RELEVANT DECISIONS (DECISION MEMORY)")
            for d in set(decisions):
                parts.append(f"- {d}")
            parts.append("")

        if semantic:
            parts.append("# RELATED KNOWLEDGE (SEMANTIC MEMORY)")
            for n in semantic:
                parts.append(f"## {n['title']}")
                parts.append(n.get("content_preview", ""))
                parts.append("")

        return "\n".join(parts)
