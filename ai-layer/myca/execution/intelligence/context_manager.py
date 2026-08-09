import logging
from typing import Dict, Any

logger = logging.getLogger("myca.execution.intelligence.context_manager")

class ContextManager:
    """
    Compresses and manages LLM context to prevent explosion.
    Only keeps: Original Intent, Execution Contract, Relevant State, Input, Required Artifacts.
    """
    
    @staticmethod
    def build_node_context(global_context: Dict[str, Any], required_inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Builds a lean context specific for the target node.
        Filters out artifacts and states from unrelated parallel branches.
        """
        logger.debug("[CONTEXT MANAGER] Compressing context for next execution node...")
        
        lean_context = {
            "intent": global_context.get("intent"),
            "contract": global_context.get("contract_summary")
        }
        
        # Only attach what this specific node requires
        for key, val in required_inputs.items():
            lean_context[key] = val
            
        return lean_context
