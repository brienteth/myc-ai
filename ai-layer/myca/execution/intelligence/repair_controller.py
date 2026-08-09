import logging
from typing import Dict, Any

logger = logging.getLogger("myca.execution.intelligence.repair_controller")

class RepairController:
    """
    Recognizes errors and determines the next action.
    E.g. MISSING_CREDENTIAL -> pause and request
    SCHEMA_MISMATCH -> retry with error context
    """
    
    @staticmethod
    def generate_repair_strategy(error: Exception) -> Dict[str, Any]:
        """
        Parses the exception string to find known failure types.
        """
        error_msg = str(error)
        logger.info(f"[REPAIR CONTROLLER] Analyzing failure: {error_msg[:100]}")
        
        if "MISSING_CREDENTIAL" in error_msg:
            logger.warning("[REPAIR CONTROLLER] Strategy: Pause and request credential.")
            return {"action": "PAUSE_AND_REQUEST", "reason": "MISSING_CREDENTIAL"}
            
        elif "SCHEMA_MISMATCH" in error_msg:
            logger.warning("[REPAIR CONTROLLER] Strategy: Retry execution with schema feedback.")
            return {"action": "RETRY_WITH_FEEDBACK", "reason": "SCHEMA_MISMATCH"}
            
        elif "VERIFICATION_FAILED" in error_msg:
            logger.warning("[REPAIR CONTROLLER] Strategy: Retry execution with verifier findings.")
            return {"action": "RETRY_WITH_FEEDBACK", "reason": "VERIFICATION_FAILED"}
            
        elif "TIMEOUT" in error_msg:
            logger.warning("[REPAIR CONTROLLER] Strategy: Halt execution due to timeout.")
            return {"action": "HALT", "reason": "TIMEOUT"}
            
        else:
            logger.error("[REPAIR CONTROLLER] Unknown error type. Defaulting to Halt.")
            return {"action": "HALT", "reason": "UNKNOWN_ERROR"}
