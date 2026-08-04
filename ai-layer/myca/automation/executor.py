"""
Workflow Execution Engine (Phase 3.0)
Resolves variables, edges, conditions, loops, and executes DAG nodes in parallel.
"""
import asyncio
import logging
import uuid
import re
from typing import Dict, Any, List, Optional
from myca.skills.core.registry import SkillRegistry
from myca.skills.core.context import SkillContext
from myca.skills.core.permissions import PermissionManager
from myca.execution.transport.base import ExecutionTask
from .history import AutomationDB

logger = logging.getLogger("myca.automation.executor")

class WorkflowExecutor:
    def __init__(self, runtime):
        self.runtime = runtime
        self.active_runs = {}

    def cancel_run(self, run_id_or_workflow_id: str) -> bool:
        # 1. Try direct run_id match
        run_info = self.active_runs.get(run_id_or_workflow_id)
        if run_info:
            run_info["ctx"].cancel()
            return True
            
        # 2. Try workflow_id match
        cancelled_any = False
        for r_id, info in list(self.active_runs.items()):
            if info["workflow_id"] == run_id_or_workflow_id:
                info["ctx"].cancel()
                cancelled_any = True
        return cancelled_any

    def _resolve_variables(self, val: Any, workflow_vars: Dict[str, Any], node_outputs: Dict[str, Any]) -> Any:
        """
        Recursively resolves variables in strings like {{variables.name}} or {{nodes.A.output_field}}
        Also handles {{secrets.KEY}} lookup from the secure vault.
        Supports array indexing: {{nodes.A.files.0}} → node_outputs["A"]["files"][0]
        """
        if isinstance(val, str):
            # Regex to match {{ ... }}
            pattern = r"\{\{\s*([\w\.\-]+)\s*\}\}"
            matches = re.findall(pattern, val)
            if not matches:
                return val
            
            resolved_str = val
            for m in matches:
                # 1. secrets lookup
                if m.startswith("secrets."):
                    secret_key = m.replace("secrets.", "")
                    secret_val = AutomationDB.get_secret(secret_key) or ""
                    resolved_str = resolved_str.replace(f"{{{{{m}}}}}", str(secret_val))
                
                # 2. variables lookup
                elif m.startswith("variables."):
                    var_key = m.replace("variables.", "")
                    var_val = workflow_vars.get(var_key, "")
                    resolved_str = resolved_str.replace(f"{{{{{m}}}}}", str(var_val))

                # 3. node output lookup (with deep traversal & array indexing)
                elif m.startswith("nodes."):
                    parts = m.replace("nodes.", "").split(".")
                    node_id = parts[0]
                    # Start from the node's full output dict
                    current = node_outputs.get(node_id, {})
                    remaining_parts = parts[1:]
                    # Strip optional 'outputs' accessor if present (e.g. nodes.A.outputs.field -> nodes.A.field)
                    if remaining_parts and remaining_parts[0] == "outputs" and isinstance(current, dict) and "outputs" not in current:
                        remaining_parts = remaining_parts[1:]
                    # Walk the remaining path segments
                    for segment in remaining_parts:
                        if isinstance(current, dict):
                            current = current.get(segment, "")
                        elif isinstance(current, (list, tuple)):
                            try:
                                idx = int(segment)
                                current = current[idx] if idx < len(current) else ""
                            except (ValueError, IndexError):
                                current = ""
                                break
                        else:
                            current = ""
                            break
                    
                    # If whole input string was just this single template expression, preserve native type (e.g. list/dict)
                    if val.strip() == f"{{{{{m}}}}}":
                        return current
                    resolved_str = resolved_str.replace(f"{{{{{m}}}}}", str(current))
            
            return resolved_str
        
        elif isinstance(val, dict):
            return {k: self._resolve_variables(v, workflow_vars, node_outputs) for k, v in val.items()}
        elif isinstance(val, list):
            return [self._resolve_variables(x, workflow_vars, node_outputs) for x in val]
        return val

    def _evaluate_condition(self, condition: str, variables: dict) -> bool:
        """Simple safety-checked eval wrapper for conditions."""
        if not condition:
            return True
        try:
            # Inject a clean, simple sandbox environment containing common variables
            # To be safe, we only evaluate basic math, string methods, equality, boolean
            allowed_globals = {"__builtins__": None, "True": True, "False": False, "variables": variables}
            return bool(eval(condition, allowed_globals, variables))
        except Exception as e:
            logger.error(f"[EXECUTOR] Condition evaluation failed '{condition}': {e}")
            return False

    async def execute(self, workflow_dict: dict, input_variables: Optional[dict] = None) -> dict:
        """
        Executes a workflow instance.
        """
        run_id = str(uuid.uuid4())
        workflow_id = workflow_dict["id"]
        
        variables = dict(workflow_dict.get("variables", {}))
        if input_variables:
            variables.update(input_variables)

        # Track execution history
        AutomationDB.start_run(run_id, workflow_id, variables)
        logger.info(f"[EXECUTOR] Started run {run_id} for workflow {workflow_dict['name']}")

        # Broadcast event
        if self.runtime.node.event_callback:
            try:
                await self.runtime.node.event_callback("EXECUTION_EVENT", {
                    "type": "ExecutionStarted",
                    "run_id": run_id,
                    "workflow_id": workflow_id,
                    "variables": variables,
                    "timestamp": time.time()
                })
            except Exception:
                pass

        nodes = {n["id"]: n for n in workflow_dict.get("nodes", [])}
        node_outputs = {}
        node_tasks = {}
        
        # Check permissions needed by workflow
        permissions = PermissionManager()
        # Request all permissions requested by all nodes
        perms_requested = set(workflow_dict.get("permissions", []))
        for n in nodes.values():
            if "permissions" in n:
                perms_requested.update(n["permissions"])
        
        permissions.request(list(perms_requested))

        ctx = SkillContext(
            need_id=run_id,
            runtime=self.runtime,
            memory=self.runtime.memory,
            capabilities=None,
            permissions=permissions
        )

        async def run_node(node_id: str) -> bool:
            node = nodes[node_id]
            node_log_id = str(uuid.uuid4())
            
            # Wait for all dependency nodes to complete successfully
            deps = node.get("depends_on", [])
            if deps:
                dep_tasks = [get_or_create_task(d_id) for d_id in deps]
                results = await asyncio.gather(*dep_tasks, return_exceptions=True)
                if any(r is False or isinstance(r, Exception) for r in results):
                    logger.warning(f"[EXECUTOR] Node {node_id} aborted - dependency failed.")
                    return False

            # Check dynamic execution condition
            if node.get("condition"):
                cond_passed = self._evaluate_condition(node["condition"], variables)
                if not cond_passed:
                    logger.info(f"[EXECUTOR] Skipping Node {node_id} - condition not met.")
                    return True  # Skipped clean

            AutomationDB.start_node(node_log_id, run_id, node_id, node["skill"])
            
            # Broadcast node started
            if self.runtime.node.event_callback:
                try:
                    await self.runtime.node.event_callback("EXECUTION_EVENT", {
                        "type": "NodeStarted",
                        "run_id": run_id,
                        "node_id": node_id,
                        "skill": node["skill"],
                        "timestamp": time.time()
                    })
                except Exception:
                    pass

            # Resolve dynamic variables inside inputs
            resolved_inputs = self._resolve_variables(node.get("inputs", {}), variables, node_outputs)
            
            # Log initial parameters
            AutomationDB.log_node_event(node_log_id, f"Running skill {node['skill']} with inputs: {resolved_inputs}")
            
            # Retry loop
            retries = node.get("retry", 0)
            success = False
            result_val = {}
            
            for attempt in range(retries + 1):
                try:
                    await ctx.check_cancel()
                    # Execution Bus takes over
                    task = ExecutionTask(
                        skill_id=node["skill"],
                        inputs=resolved_inputs,
                        task_id=node_id,
                        context=ctx
                    )
                    res = await self.runtime.execution_bus.execute(task)
                    if res.success:
                        success = True
                        result_val = res.outputs
                        AutomationDB.log_node_event(node_log_id, f"Completed successfully. Outputs: {result_val}")
                        break
                    else:
                        logger.error(f"[EXECUTOR] Node {node_id} Attempt {attempt} failed: {res.logs}")
                        AutomationDB.log_node_event(node_log_id, f"Attempt {attempt} failed: {res.logs}")
                except Exception as e:
                    logger.error(f"[EXECUTOR] Node {node_id} Attempt {attempt} exception: {str(e)}")
                    AutomationDB.log_node_event(node_log_id, f"Attempt {attempt} exception: {str(e)}")
                    if attempt == retries:
                        result_val = {"error": str(e)}

            status_str = "Completed" if success else "Failed"
            AutomationDB.end_node(node_log_id, status_str, result_val)
            node_outputs[node_id] = result_val

            # Broadcast node result
            if self.runtime.node.event_callback:
                try:
                    await self.runtime.node.event_callback("EXECUTION_EVENT", {
                        "type": "NodeFinished" if success else "NodeFailed",
                        "run_id": run_id,
                        "node_id": node_id,
                        "outputs": result_val if success else None,
                        "error": None if success else str(result_val.get("error", "Execution failed")),
                        "timestamp": time.time()
                    })
                except Exception:
                    pass

            # Write outputs to variables if specified
            if success:
                for k, v in node.get("outputs", {}).items():
                    variables[k] = result_val.get(v, "")

            if not success and not node.get("continue_on_error", False):
                return False
            return True

        def get_or_create_task(node_id: str):
            if node_id not in node_tasks:
                node_tasks[node_id] = asyncio.create_task(run_node(node_id))
            return node_tasks[node_id]

        self.active_runs[run_id] = {"ctx": ctx, "workflow_id": workflow_id}

        try:
            # Execute all leaf nodes (those that have no dependants waiting, starts execution recursively)
            all_tasks = [get_or_create_task(node_id) for node_id in nodes]
            await asyncio.gather(*all_tasks, return_exceptions=True)

            # Check overall workflow success
            # If any node failed and continue_on_error was False, mark run as Failed
            failed_count = 0
            for task in node_tasks.values():
                if task.done() and task.result() is False:
                    failed_count += 1
            
            # If context was cancelled during run, mark status as Cancelled
            if ctx._is_cancelled:
                status = "Cancelled"
                error_msg = "Workflow execution cancelled by user."
            else:
                status = "Failed" if failed_count > 0 else "Completed"
                error_msg = f"{failed_count} nodes failed." if failed_count > 0 else None
            
            AutomationDB.end_run(run_id, status, error=error_msg)
            logger.info(f"[EXECUTOR] Run {run_id} completed with status {status}")

            # Broadcast execution end
            if self.runtime.node.event_callback:
                try:
                    await self.runtime.node.event_callback("EXECUTION_EVENT", {
                        "type": "ExecutionFinished",
                        "run_id": run_id,
                        "status": status,
                        "error": error_msg,
                        "timestamp": time.time()
                    })
                except Exception:
                    pass

            return {
                "run_id": run_id,
                "status": status,
                "error": error_msg,
                "variables": variables,
                "node_outputs": node_outputs
            }
        finally:
            self.active_runs.pop(run_id, None)
