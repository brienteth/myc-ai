"""
Capability Agent — Maps Abstract Intent Graphs to Abstract Capability Primitives
"""

import logging
from typing import List, Dict, Any
from myca.planner.agents.intent_agent import IntentGraph, IntentNode

logger = logging.getLogger("myca.planner.agents.capability")


class CapabilityNode(BaseModel := type("BaseModel", (), {})): # placeholder import safeguard
    pass

from pydantic import BaseModel, Field


class AbstractCapabilityNode(BaseModel):
    id: str
    capability_type: str  # Communication.Send, Database.Query, File.Read, Compute.Run
    intent_ref: str
    abstract_inputs: Dict[str, Any] = Field(default_factory=dict)


class CapabilityGraph(BaseModel):
    nodes: List[AbstractCapabilityNode] = Field(default_factory=list)


class CapabilityAgent:
    def __init__(self):
        pass

    def map_intents_to_capabilities(self, intent_graph: IntentGraph) -> CapabilityGraph:
        """Maps Intent Nodes to vendor-neutral abstract capability nodes."""
        cap_nodes = []

        for intent in intent_graph.intents:
            if intent.action_type == "NOTIFY_USER":
                cap_nodes.append(AbstractCapabilityNode(
                    id=f"cap_{intent.id}",
                    capability_type="Communication.Send",
                    intent_ref=intent.id,
                    abstract_inputs={"message": intent.context.get("raw_prompt")}
                ))

            elif intent.action_type == "QUERY_DATA":
                cap_nodes.append(AbstractCapabilityNode(
                    id=f"cap_{intent.id}",
                    capability_type="Database.Query",
                    intent_ref=intent.id,
                    abstract_inputs={"query": intent.context.get("raw_prompt")}
                ))

            elif intent.action_type == "RUN_COMPUTE":
                cap_nodes.append(AbstractCapabilityNode(
                    id=f"cap_{intent.id}",
                    capability_type="Compute.Run",
                    intent_ref=intent.id,
                    abstract_inputs={"prompt": intent.context.get("raw_prompt")}
                ))

            elif intent.action_type == "READ_FILE":
                cap_nodes.append(AbstractCapabilityNode(
                    id=f"cap_{intent.id}",
                    capability_type="File.Read",
                    intent_ref=intent.id,
                    abstract_inputs={"path": "./data.txt"}
                ))

            else:
                cap_nodes.append(AbstractCapabilityNode(
                    id=f"cap_{intent.id}",
                    capability_type="AI.Reason",
                    intent_ref=intent.id,
                    abstract_inputs={"prompt": intent.context.get("raw_prompt")}
                ))

        logger.info(f"[CAPABILITY AGENT] Mapped {len(cap_nodes)} abstract capability primitives.")
        return CapabilityGraph(nodes=cap_nodes)
