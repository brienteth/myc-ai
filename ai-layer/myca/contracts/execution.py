"""
Execution Graph (DAG) Runner & OS NodeReference Data Pipe
Shared execution structures for both Public Core and Private Intelligence packages.
"""

import asyncio
import logging
from enum import Enum
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field

logger = logging.getLogger("myca.contracts.execution")

class NodeState(str, Enum):
    CREATED = "created"
    QUEUED = "queued"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    WAITING = "waiting"
    RETRYING = "retrying"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class NodeReference:
    """First-class OS Reference Object representing data piping between DAG nodes."""
    def __init__(self, node_id: str, output_field: str, data_type: str = "any"):
        self.node_id = node_id
        self.output_field = output_field
        self.data_type = data_type

    def resolve(self, completed_nodes: Dict[str, "ExecutionNode"]) -> Any:
        dep_node = completed_nodes.get(self.node_id)
        if dep_node and dep_node.result and dep_node.result.success:
            outputs = dep_node.result.outputs
            if isinstance(outputs, dict):
                if self.output_field in outputs:
                    return outputs[self.output_field]
                # Fallback to standard keys like content, text, response, output
                for fallback_key in ["content", "text", "response", "output", "extracted_text", "summary", "result"]:
                    if fallback_key in outputs:
                        return outputs[fallback_key]
                if outputs:
                    return next(iter(outputs.values()))
            return outputs
        return ""

class ExecutionNode:
    def __init__(self, id: str, skill_name: str, inputs: dict, dependencies: list[str] = None):
        self.id = id
        self.skill_name = skill_name
        self.inputs = inputs
        self.dependencies = dependencies or []
        self.result = None
        self.status = NodeState.CREATED
        self.references: Dict[str, NodeReference] = {}
        
        # Parse inputs for NodeReferences or string templates
        self._parse_references()

    def _parse_references(self):
        for k, v in list(self.inputs.items()):
            if isinstance(v, NodeReference):
                self.references[k] = v
            elif isinstance(v, str) and (v.startswith("$") or ("{{" in v and "nodes." in v)):
                # Parse format like "$node_id.output_field" or "{{nodes.node_id.outputs.output_field}}"
                clean = v.replace("{{", "").replace("}}", "").replace("nodes.", "").strip()
                if clean.startswith("$"):
                    clean = clean[1:]
                parts = clean.split(".")
                dep_id = parts[0]
                field = parts[1] if len(parts) > 1 else "content"
                if field == "outputs" and len(parts) > 2:
                    field = parts[2]
                
                ref = NodeReference(node_id=dep_id, output_field=field)
                self.references[k] = ref
                if dep_id not in self.dependencies:
                    self.dependencies.append(dep_id)

class ExecutionGraph:
    def __init__(self, plan_json: dict):
        self.nodes: Dict[str, ExecutionNode] = {}
        for n in plan_json.get("nodes", []):
            deps = n.get("deps", n.get("depends_on", []))
            self.nodes[n["id"]] = ExecutionNode(
                id=n["id"],
                skill_name=n["skill"],
                inputs=n.get("inputs", {}),
                dependencies=list(deps)
            )
            
    async def execute(self, ctx) -> bool:
        """Runs the DAG, resolving dependencies and managing parallel execution via OS State Machine."""
        logger.info(f"Starting ExecutionGraph with {len(self.nodes)} nodes.")
        
        # Set all nodes to QUEUED
        for n in self.nodes.values():
            n.status = NodeState.QUEUED
        
        node_tasks = {}
        
        async def run_node(node_id):
            node = self.nodes[node_id]
            node.status = NodeState.SCHEDULED

            if node.dependencies:
                node.status = NodeState.WAITING
                dep_tasks = [get_or_create_task(dep_id) for dep_id in node.dependencies]
                results = await asyncio.gather(*dep_tasks, return_exceptions=True)
                
                if any(isinstance(r, Exception) or r is False for r in results):
                    node.status = NodeState.FAILED
                    logger.error(f"Node '{node.id}' aborted because dependency failed.")
                    return False
                    
                if any(self.nodes[dep_id].status != NodeState.COMPLETED for dep_id in node.dependencies):
                    node.status = NodeState.FAILED
                    logger.error(f"Node '{node.id}' aborted because dependency node was not completed.")
                    return False
            
            node.status = NodeState.RUNNING
            return await self._execute_node(node, ctx)
            
        def get_or_create_task(node_id):
            if node_id not in node_tasks:
                node_tasks[node_id] = asyncio.create_task(run_node(node_id))
            return node_tasks[node_id]
            
        all_tasks = [get_or_create_task(node_id) for node_id in self.nodes]
        results = await asyncio.gather(*all_tasks, return_exceptions=True)
        success = all(r is True for r in results if not isinstance(r, Exception))
        logger.info(f"ExecutionGraph completed with success={success}.")
        return success

    async def _execute_node(self, node: ExecutionNode, ctx) -> bool:
        logger.info(f"Executing Node {node.id}: {node.skill_name}")
        try:
            from myca.skills.core.registry import SkillRegistry
            
            resolved_inputs = dict(node.inputs)
            # Resolve NodeReference objects
            for k, ref in node.references.items():
                resolved_inputs[k] = ref.resolve(self.nodes)

            manifest = getattr(SkillRegistry._skills.get(node.skill_name), "manifest", None)
            retries = manifest.retry if manifest else 0
            max_attempts = retries + 1
            
            for attempt in range(max_attempts):
                if attempt > 0:
                    node.status = NodeState.RETRYING
                try:
                    node.result = await SkillRegistry.execute(ctx, node.skill_name, **resolved_inputs)
                    if node.result.success:
                        # Post-Execution Verifier Check
                        output_valid = True
                        if isinstance(node.result.outputs, dict):
                            # Ensure outputs are valid and not empty errors
                            if "error" in node.result.outputs and node.result.outputs["error"]:
                                output_valid = False
                        
                        if output_valid:
                            node.status = NodeState.COMPLETED
                            return True
                        else:
                            logger.warning(f"Node '{node.id}' post-execution verification failed.")
                except Exception as exc:
                    import traceback
                    logger.error(f"Attempt {attempt + 1}/{max_attempts} failed for node '{node.id}': {exc}\n{traceback.format_exc()}")
                    if attempt == max_attempts - 1:
                        break
            
            node.status = NodeState.FAILED
            return False
        except Exception as e:
            logger.error(f"Node {node.id} failed: {e}")
            node.status = NodeState.FAILED
            return False

class ExecutionEngine:
    """Abstract Interface for Execution/Orchestration Engine."""
    async def execute(self, workflow_id: str, inputs: Dict[str, Any] = None) -> Dict[str, Any]:
        """Execute a target agent workflow graph."""
        pass


@dataclass
class ExecutionContract:
    intent: str
    capabilities: List[str] = field(default_factory=list)
    nodes: List[Dict[str, Any]] = field(default_factory=list)
    device_assignments: Dict[str, str] = field(default_factory=dict)


class ExecutionContractCompiler:
    def __init__(self, device_registry=None):
        from myca.registry import DeviceCapabilityRegistry
        self.registry = device_registry or DeviceCapabilityRegistry(node_id="mac_local")

    def compile(self, prompt: str) -> ExecutionContract:
        """
        Compiles a natural language prompt into a typed ExecutionContract.
        """
        p_lower = prompt.lower().strip()
        
        # 1. Determine Intent
        is_code_gen = any(w in p_lower for w in ["yaz", "kod", "script", "program", "python", "javascript", "html", "css", "c++", "rust", "write code", "develop", "coding", "kodla"])
        is_code_exec = is_code_gen and any(w in p_lower for w in ["çalıştır", "execute", "run", "doğrula", "düzelt", "verify", "repair"])
        is_scraping = any(w in p_lower for w in ["veri çek", "kazı", "scrape", "scraping", "web scraping", "crawl", "download page", "url oku", "siteden al", "html çek"])

        if any(w in p_lower for w in ["fotoğraf", "kamera", "phone", "camera", "çek", "capture"]) and any(w in p_lower for w in ["mac", "bilgisayar", "analiz", "rapor", "hafıza", "vault", "second brain"]):
            intent = "CROSS_DEVICE_COLONY"
        elif is_scraping:
            intent = "WEB_SCRAPING"
        elif is_code_exec:
            intent = "CODE_EXECUTION"
        elif is_code_gen:
            intent = "CODE_GENERATION"
        elif any(w in p_lower for w in ["özet", "pdf", "belge", "oku"]) and not any(w in p_lower for w in ["son 20", "bul", "listele"]):
            intent = "FILE_OPERATION"
        elif any(w in p_lower for w in ["telegram", "slack", "mesaj", "yaz", "gönder"]):
            intent = "COMMUNICATION_AUTOMATION"
        elif any(w in p_lower for w in ["araştır", "research", "raporla"]):
            intent = "RESEARCH_SYNTHESIS"
        elif any(w in p_lower for w in ["bilgisayarımdaki", "bul", "klasör", "ara"]):
            intent = "DATA_ANALYSIS"
        else:
            intent = "CHAT"

        # 2. Build nodes and capabilities
        nodes = []
        capabilities = []
        
        if intent == "CROSS_DEVICE_COLONY":
            capabilities = ["camera.capture", "local_llm.inference", "filesystem.write", "vault.write"]
            nodes = [
                {"id": "step_photo", "skill": "camera.capture", "inputs": {}, "deps": []},
                {"id": "step_analysis", "skill": "local_llm.inference", "inputs": {"prompt": "Analyze photo: $step_photo.photo_url"}, "deps": ["step_photo"]},
                {"id": "step_pdf", "skill": "filesystem.write", "inputs": {"content": "$step_analysis.text", "path": "report.pdf"}, "deps": ["step_analysis"]},
                {"id": "step_vault", "skill": "vault.write", "inputs": {"content": "$step_pdf.output_path"}, "deps": ["step_pdf"]}
            ]
        elif intent == "WEB_SCRAPING":
            capabilities = ["browser.navigate", "local_llm.inference", "filesystem.write"]
            nodes = [
                {"id": "step_scrape", "skill": "browser.navigate", "inputs": {"url": "https://api.example"}, "deps": []},
                {"id": "step_extract", "skill": "local_llm.inference", "inputs": {"prompt": "Extract pricing from: $step_scrape.content"}, "deps": ["step_scrape"]},
                {"id": "step_save", "skill": "filesystem.write", "inputs": {"content": "$step_extract.text", "path": "prices.csv"}, "deps": ["step_extract"]}
            ]
        elif intent == "CODE_EXECUTION":
            capabilities = ["local_llm.inference", "filesystem.write", "verifier.check"]
            nodes = [
                {"id": "step_draft", "skill": "local_llm.inference", "inputs": {"prompt": "Draft Python script for: " + prompt}, "deps": []},
                {"id": "step_save", "skill": "filesystem.write", "inputs": {"content": "$step_draft.text", "path": "script.py"}, "deps": ["step_draft"]},
                {"id": "step_execute", "skill": "local_llm.inference", "inputs": {"prompt": "Execute script.py and capture stdout"}, "deps": ["step_save"]},
                {"id": "step_verify", "skill": "verifier.check", "inputs": {"code": "$step_execute.text"}, "deps": ["step_execute"]}
            ]
        elif intent == "CODE_GENERATION":
            capabilities = ["local_llm.inference", "filesystem.write"]
            nodes = [
                {"id": "step_draft", "skill": "local_llm.inference", "inputs": {"prompt": "Draft Python script for: " + prompt}, "deps": []},
                {"id": "step_save", "skill": "filesystem.write", "inputs": {"content": "$step_draft.text", "path": "script.py"}, "deps": ["step_draft"]}
            ]
        elif intent == "FILE_OPERATION":
            capabilities = ["filesystem.read", "local_llm.inference"]
            nodes = [
                {"id": "step_read", "skill": "filesystem.read", "inputs": {"path": "document.pdf"}, "deps": []},
                {"id": "step_summary", "skill": "local_llm.inference", "inputs": {"prompt": "Summarize: $step_read.content"}, "deps": ["step_read"]}
            ]
        elif intent == "COMMUNICATION_AUTOMATION":
            capabilities = ["local_llm.inference", "telegram.send"]
            nodes = [
                {"id": "step_draft", "skill": "local_llm.inference", "inputs": {"prompt": "Draft message for prompt: " + prompt}, "deps": []},
                {"id": "step_send", "skill": "telegram.send", "inputs": {"message": "$step_draft.text"}, "deps": ["step_draft"]}
            ]
        elif intent == "RESEARCH_SYNTHESIS":
            capabilities = ["local_llm.inference", "filesystem.write"]
            nodes = [
                {"id": "step_research", "skill": "local_llm.inference", "inputs": {"prompt": "Research about " + prompt}, "deps": []},
                {"id": "step_write", "skill": "filesystem.write", "inputs": {"content": "$step_research.text", "path": "research.md"}, "deps": ["step_research"]}
            ]
        elif intent == "DATA_ANALYSIS":
            capabilities = ["filesystem.read", "local_llm.inference"]
            nodes = [
                {"id": "step_list", "skill": "filesystem.read", "inputs": {"path": "./downloads"}, "deps": []},
                {"id": "step_filter", "skill": "local_llm.inference", "inputs": {"prompt": "Filter financial items: $step_list.content"}, "deps": ["step_list"]}
            ]
        else:  # CHAT
            capabilities = ["local_llm.inference"]
            nodes = [
                {"id": "step_chat", "skill": "local_llm.inference", "inputs": {"prompt": prompt}, "deps": []}
            ]

        # 3. Resolve Device Assignments using Registry
        device_assignments = {}
        skill_cap_map = {
            "camera.capture": "camera.capture",
            "filesystem.read": "filesystem.read",
            "filesystem.write": "filesystem.write",
            "local_llm.inference": "local_llm.inference",
            "vault.write": "vault.write",
            "telegram.send": "telegram.send"
        }

        for n in nodes:
            skill = n["skill"]
            cap_id = skill_cap_map.get(skill, "gpu.compute")
            candidates = self.registry.find_devices_with_capability(cap_id)
            
            if not candidates:
                assigned_id = "mac_local"
            else:
                local_candidate = next((c for c in candidates if c.is_self), None)
                if local_candidate:
                    assigned_id = local_candidate.device_id
                else:
                    from myca.contracts.device import TrustState
                    trusted = [c for c in candidates if c.trust_state == TrustState.TRUSTED]
                    assigned_id = trusted[0].device_id if trusted else candidates[0].device_id
            
            device_assignments[n["id"]] = assigned_id

        return ExecutionContract(
            intent=intent,
            capabilities=capabilities,
            nodes=nodes,
            device_assignments=device_assignments
        )
