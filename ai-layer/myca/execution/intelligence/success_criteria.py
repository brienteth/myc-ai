import logging
from typing import Dict, Any

logger = logging.getLogger("myca.execution.intelligence.success_criteria")

class SuccessCriteriaEvaluator:
    """
    Evaluates whether an output artifact meets the success criteria.
    """
    
    @staticmethod
    def evaluate(artifact: Dict[str, Any], criteria: Dict[str, Any]) -> bool:
        """
        Expects artifact to optionally contain metrics or a quality score.
        criteria format: {"threshold": 96.0}
        """
        logger.info("[SUCCESS CRITERIA] Evaluating artifact quality...")
        
        threshold = criteria.get("threshold", 0.0)
        
        # In a real system, we might extract "metrics" from the verification step
        # or the artifact itself.
        quality = artifact.get("quality_score", 100.0)
        
        if quality >= threshold:
            logger.info(f"[SUCCESS CRITERIA] PASS (Quality {quality} >= {threshold})")
            return True
        else:
            logger.info(f"[SUCCESS CRITERIA] FAIL (Quality {quality} < {threshold})")
            return False
