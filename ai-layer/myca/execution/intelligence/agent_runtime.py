import logging
from typing import Dict, Any
from myca.execution.intelligence.models import AgentDefinition

logger = logging.getLogger("myca.execution.intelligence.agent_runtime")

class AgentRuntime:
    """
    Executes a single Agent loop: Plan -> Execute -> Check -> Return.
    Enforces strict typed output schema.
    """
    
    def __init__(self, inference_engine, secrets_vault=None):
        self.inference = inference_engine
        self.secrets = secrets_vault

    async def run_agent(self, agent: AgentDefinition, intent: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Runs the agent and ensures schema matching."""
        logger.info(f"[AGENT RUNTIME] Starting Agent {agent.name} (Purpose: {agent.purpose})")
        
        # 1. Plan
        # (Construct prompt using only allowed tools and purpose)
        system_prompt = f"You are {agent.name}. Purpose: {agent.purpose}.\nAllowed Tools: {agent.tools}\nOutput Schema: {agent.output_schema}"
        
        # 2. Execute
        # Request inference
        try:
            raw_response = await self.inference.generate(intent, system=system_prompt)
        except Exception as e:
            logger.error(f"[AGENT RUNTIME] Inference failed: {e}")
            raise RuntimeError(f"NETWORK_FAILURE: {e}")

        # 3. Validate Output (Strict Schema Check)
        parsed_output = self._parse_and_validate(raw_response, agent.output_schema)
        if not parsed_output:
            raise ValueError(f"SCHEMA_MISMATCH: Output did not match {agent.output_schema}")

        logger.info(f"[AGENT RUNTIME] Agent {agent.name} completed successfully.")
        return parsed_output

    def _parse_and_validate(self, text: str, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Extracts JSON and validates against schema."""
        import json
        import re
        
        match = re.search(r'```json\n(.*?)\n```', text, re.DOTALL)
        if match:
            json_str = match.group(1)
        else:
            # Fallback if just raw json
            json_str = text
            
        try:
            data = json.loads(json_str)
            # Basic validation: ensure required keys exist
            if isinstance(schema, dict) and "properties" in schema:
                for key in schema["properties"].keys():
                    if key not in data:
                        logger.warning(f"[AGENT RUNTIME] Missing required key: {key}")
                        return None
            return data
        except json.JSONDecodeError:
            logger.error(f"[AGENT RUNTIME] Invalid JSON from agent: {text[:50]}")
            return None
