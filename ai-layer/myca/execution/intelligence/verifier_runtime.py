import logging
import asyncio
from typing import Dict, Any, List
from myca.execution.intelligence.models import VerificationRule

logger = logging.getLogger("myca.execution.intelligence.verifier_runtime")

class VerifierRuntime:
    """
    Executes Independent Verification.
    CRITICAL RULE: Worker and Verifier MUST NOT share reasoning context.
    """
    
    def __init__(self, inference_engine):
        self.inference = inference_engine

    async def verify(self, artifact: Dict[str, Any], schema: Dict[str, Any], rules: List[VerificationRule]) -> Dict[str, Any]:
        """
        Runs multiple independent verifiers in parallel and calculates quorum.
        """
        logger.info(f"[VERIFIER RUNTIME] Starting independent verification with {len(rules)} rules.")
        
        # Parallel verification tasks
        tasks = []
        for rule in rules:
            tasks.append(self._run_single_verification(artifact, schema, rule))
            
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        verification_report = {
            "overall_status": "PASS",
            "details": {}
        }
        
        pass_count = 0
        total_rules = len(rules)
        
        for i, rule in enumerate(rules):
            res = results[i]
            if isinstance(res, Exception):
                logger.error(f"[VERIFIER RUNTIME] Rule {rule.rule_type} failed critically: {res}")
                status = "FAIL"
                finding = str(res)
            else:
                status = res.get("status", "FAIL")
                finding = res.get("finding", "No finding provided.")
                
            verification_report["details"][rule.rule_type] = {
                "status": status,
                "finding": finding
            }
            
            if status == "PASS":
                pass_count += 1
            else:
                if rule.severity == "HIGH":
                    verification_report["overall_status"] = "FAIL"
                    
        # Majority Quorum
        if total_rules > 0 and (pass_count / total_rules) < 0.5:
            verification_report["overall_status"] = "FAIL"
            
        logger.info(f"[VERIFIER RUNTIME] Verification completed: {verification_report['overall_status']} ({pass_count}/{total_rules} passed)")
        return verification_report

    async def _run_single_verification(self, artifact: Dict[str, Any], schema: Dict[str, Any], rule: VerificationRule) -> Dict[str, str]:
        """
        Fresh context LLM call. It only sees the artifact, schema, and rule.
        """
        system_prompt = (
            f"You are an independent Verifier Agent.\n"
            f"Verification Rule: {rule.rule_type} - {rule.criteria}\n"
            f"Expected Schema: {schema}\n"
            f"Artifact to verify: {artifact}\n\n"
            f"Reply ONLY in JSON format: {{\"status\": \"PASS\" or \"FAIL\", \"finding\": \"reasoning\"}}"
        )
        
        # This call has no memory of the worker's chain of thought!
        raw_response = await self.inference.generate(prompt="Analyze the artifact.", system=system_prompt)
        
        import json
        import re
        match = re.search(r'```json\n(.*?)\n```', raw_response, re.DOTALL)
        json_str = match.group(1) if match else raw_response
        
        try:
            data = json.loads(json_str)
            return data
        except Exception:
            return {"status": "FAIL", "finding": "Invalid JSON response from verifier."}
