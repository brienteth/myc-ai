"""
Intent Agent — Extracts Vendor-Neutral Intent Graphs from User Prompts
"""

import logging
from typing import Dict, Any, List
from pydantic import BaseModel, Field

logger = logging.getLogger("myca.planner.agents.intent")


class IntentNode(BaseModel):
    id: str
    action_type: str  # NOTIFY_USER, QUERY_DATA, READ_FILE, WRITE_FILE, RUN_COMPUTE, COMMIT_CODE
    goal: str
    context: Dict[str, Any] = Field(default_factory=dict)


class IntentGraph(BaseModel):
    user_prompt: str
    intents: List[IntentNode] = Field(default_factory=list)


class IntentAgent:
    def __init__(self):
        pass

    def extract_intents(self, prompt: str) -> IntentGraph:
        """Parses user prompt into a vendor-neutral Intent Graph."""
        prompt_l = prompt.lower()
        intents = []

        if "telegram" in prompt_l or "slack" in prompt_l or "mail" in prompt_l or "email" in prompt_l or "notify" in prompt_l or "mesaj" in prompt_l:
            intents.append(IntentNode(
                id="intent_notify_1",
                action_type="NOTIFY_USER",
                goal="Deliver message notification to target user or channel",
                context={"raw_prompt": prompt}
            ))

        if "postgres" in prompt_l or "sql" in prompt_l or "db" in prompt_l or "database" in prompt_l:
            intents.append(IntentNode(
                id="intent_db_1",
                action_type="QUERY_DATA",
                goal="Execute database query transaction",
                context={"raw_prompt": prompt}
            ))

        if "0g" in prompt_l or "decentralized compute" in prompt_l or "gpu" in prompt_l:
            intents.append(IntentNode(
                id="intent_compute_1",
                action_type="RUN_COMPUTE",
                goal="Execute AI inference workloads on compute cluster",
                context={"raw_prompt": prompt}
            ))

        if "file" in prompt_l or "read" in prompt_l or "oku" in prompt_l or "dosya" in prompt_l:
            intents.append(IntentNode(
                id="intent_read_1",
                action_type="READ_FILE",
                goal="Read file contents from filesystem",
                context={"raw_prompt": prompt}
            ))

        if not intents:
            intents.append(IntentNode(
                id="intent_chat_1",
                action_type="GENERAL_ASSIST",
                goal="Process general AI reasoning response",
                context={"raw_prompt": prompt}
            ))

        logger.info(f"[INTENT AGENT] Extracted {len(intents)} vendor-neutral intent nodes.")
        return IntentGraph(user_prompt=prompt, intents=intents)
