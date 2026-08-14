import logging
import time
from typing import Dict, Any, Callable
from myca_intelligence.execution_intelligence.models import LoopConfig
from myca_intelligence.execution_intelligence.success_criteria import SuccessCriteriaEvaluator
from myca_intelligence.execution_intelligence.repair_controller import RepairController

logger = logging.getLogger("myca_intelligence.execution_intelligence.loop_runtime")

class LoopRuntime:
    """
    Executes a node (Agent or Graph) in a loop until success criteria are met or a hard stop occurs.
    """
    
    @staticmethod
    async def execute_with_loop(
        executable: Callable, 
        config: LoopConfig, 
        inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        executable: An async function that takes `inputs` and returns an `artifact`.
        """
        logger.info(f"[LOOP RUNTIME] Starting execution loop (max iterations: {config.max_iterations})")
        
        iteration = 1
        start_time = time.time()
        
        while iteration <= config.max_iterations:
            logger.info(f"[LOOP RUNTIME] Iteration {iteration}/{config.max_iterations}")
            
            # Check timeout
            if (time.time() - start_time) > config.timeout_seconds:
                logger.error("[LOOP RUNTIME] Hard Stop: Timeout exceeded.")
                raise TimeoutError("TIMEOUT: Loop exceeded max runtime.")
                
            try:
                # EXECUTE
                artifact = await executable(inputs)
                
                # CHECK SUCCESS
                if config.stop_on_success:
                    is_success = SuccessCriteriaEvaluator.evaluate(
                        artifact, 
                        {"threshold": config.success_threshold}
                    )
                    if is_success:
                        logger.info("[LOOP RUNTIME] Success criteria met. Exiting loop.")
                        return artifact
                    else:
                        logger.info("[LOOP RUNTIME] Success criteria not met. Planning repair...")
                        # In full implementation, we'd adjust inputs with repair context
                        inputs["repair_context"] = "Previous output did not meet quality threshold."
                else:
                    return artifact
                    
            except Exception as e:
                # REPAIR
                strategy = RepairController.generate_repair_strategy(e)
                if strategy["action"] == "PAUSE_AND_REQUEST":
                    logger.warning("[LOOP RUNTIME] Halting for user intervention (e.g., credentials).")
                    raise e
                elif strategy["action"] == "HALT":
                    logger.error("[LOOP RUNTIME] Unrecoverable error. Halting.")
                    raise e
                elif strategy["action"] == "RETRY_WITH_FEEDBACK":
                    logger.info("[LOOP RUNTIME] Applying repair feedback for next iteration...")
                    inputs["repair_feedback"] = str(e)
                    
            iteration += 1
            
        logger.error("[LOOP RUNTIME] Hard Stop: Max iterations reached.")
        raise RuntimeError("MAX_ITERATIONS: Loop failed to succeed within limits.")
