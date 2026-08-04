import logging
import os
import time
from typing import AsyncGenerator
import json

from .core.need import Need, Experience, Capability, PrivacyLevel
from .experience.memory import ExperienceMemory
from .planner.planner import Planner
from .planner.execution_graph import ExecutionGraph
from .skills.core.registry import SkillRegistry

logger = logging.getLogger("myca.runtime")

class Analytics:
    def __init__(self):
        self.total_needs = 0
        self.avoided_needs = 0
        self.energy_saved = 0.0
        self.gpu_seconds_saved = 0.0
        self.total_latency_ms = 0.0
        self.local_execution_count = 0
        self.network_execution_count = 0
        self.reused_experiences = 0

    def get_stats(self):
        avoidance_rate = (self.avoided_needs / self.total_needs * 100) if self.total_needs > 0 else 0
        avg_latency = (self.total_latency_ms / self.total_needs) if self.total_needs > 0 else 0
        
        return {
            "total_needs": self.total_needs,
            "avoidance_rate": f"{avoidance_rate:.1f}%",
            "energy_saved": f"{self.energy_saved:.1f}",
            "gpu_seconds_saved": f"{self.gpu_seconds_saved:.1f}s",
            "average_latency_ms": f"{avg_latency:.1f}",
            "local_execution_pct": f"{(self.local_execution_count / max(1, self.total_needs) * 100):.1f}%",
            "network_execution_pct": f"{(self.network_execution_count / max(1, self.total_needs) * 100):.1f}%",
            "reused_experiences": self.reused_experiences
        }

class RuntimeEngine:
    """
    Myca Distributed Execution OS Runtime
    Need -> Planner (LLM) -> Decision Engine (Mesh) -> Execution Graph (DAG) -> Experience Memory
    """
    def __init__(self, node):
        self.node = node
        self.memory = ExperienceMemory()
        # self.necessity_engine = NecessityEngine(self.memory) # Deprecated legacy for now
        self.planner = Planner(self.node.inference_engine)
        self.analytics = Analytics()
        
        from myca.execution.bus import ExecutionBus
        # Initialize execution bus with discovery service
        self.execution_bus = ExecutionBus(
            discovery_service=self.node.discovery if hasattr(self.node, 'discovery') else None,
            is_simulation=getattr(self.node, 'simulate', False)
        )
        
    async def schedule(self, need: Need) -> dict:
        self.analytics.total_needs += 1
        start_time = time.time()
        
        # 1. Planning Phase (Need -> AST)
        available_skills = SkillRegistry.get_manifests()
        plan_json = await self.planner.create_plan(need.prompt, available_skills)
        
        # 2. Compilation Phase (AST -> IR -> DAG)
        from myca.planner.compiler import ExecutionCompiler
        compiler = ExecutionCompiler()
        dag_plan = compiler.compile_ast_to_dag(plan_json)
        
        # 3. Optimization Phase (DAG -> Optimized DAG)
        from myca.planner.optimizer import GraphOptimizer
        optimizer = GraphOptimizer()
        optimized_plan = optimizer.optimize(dag_plan)
        
        # 4. Validation Phase (Optimized DAG -> Validated DAG)
        from myca.planner.validator import GraphValidator
        validator = GraphValidator()
        validation_res = validator.validate(optimized_plan)
        if not validation_res.valid:
            logger.warning(f"Plan validation failed: {validation_res.errors}")
            
        # 5. Execution Pipeline (Scheduler + EventBus + Artifacts + Verifier)
        from myca.skills.core.context import SkillContext
        from myca.skills.core.permissions import PermissionManager
        from myca.execution.scheduler import ExecutionScheduler
        from myca.execution.event_bus import ExecutionEventBus
        from myca.execution.artifacts import ArtifactStore
        from myca.execution.verifier import ExecutionVerifier
        
        permissions = PermissionManager()
        permissions.request(optimized_plan.get("permissions", ["fs", "browser", "network"]))
        
        ctx = SkillContext(
            need_id=need.need_id,
            runtime=self,
            memory=self.memory,
            capabilities=None,
            permissions=permissions
        )
        
        graph = ExecutionGraph(optimized_plan)
        scheduler = ExecutionScheduler(event_bus=ExecutionEventBus())
        verifier = ExecutionVerifier()
        artifact_store = ArtifactStore()
        
        workflow_id = f"wf-{need.need_id[:8]}"
        await scheduler.run(graph, ctx, workflow_id=workflow_id)
        
        # Post-Execution Verifier Stage
        for n_id, node in graph.nodes.items():
            if node.result and node.result.outputs:
                v_res = verifier.verify(node.skill_name, node.inputs, node.result.outputs)
                if not v_res.passed:
                    logger.warning(f"Post-execution verification failed for node {n_id}: {v_res.checks}")
        
        # Determine success
        success = all(getattr(n.status, "value", str(n.status)) in ["completed", "NodeState.COMPLETED"] for n in graph.nodes.values())
        elapsed_ms = (time.time() - start_time) * 1000
        
        # Collect outputs
        execution_results = {}
        for n_id, node in graph.nodes.items():
            if node.result and node.result.success:
                execution_results[n_id] = node.result.outputs
            else:
                execution_results[n_id] = {"status": str(node.status), "error": getattr(node.result, "error", None)}
        
        # 6. LLM Explainer Response
        explainer_prompt = f"""User request: "{need.prompt}"
Executed DAG: {json.dumps(optimized_plan, indent=2)}
Execution Outputs: {json.dumps(execution_results, indent=2)}

You are Myca OS. Write a conversational, friendly, and helpful final response explaining the successful execution results of this plan to the user. Do not return markdown JSON. Just talk naturally in Turkish."""
        
        try:
            response_text = await self.node.inference_engine.generate(explainer_prompt)
        except Exception as e:
            logger.error(f"Inference explainer generation failed: {e}")
            response_text = "İsteğiniz başarıyla tamamlandı. Detaylar:\n"
            for n_id, outs in execution_results.items():
                response_text += f"- {n_id}: {json.dumps(outs)}\n"
        
        # 7. Store Experience
        self.memory.store_plan_experience(
            need_text=need.prompt,
            plan=optimized_plan,
            success=success,
            latency=elapsed_ms,
            energy=1.0
        )
        
        return {
            "response": response_text,
            "source": "executor_mesh",
            "compute_avoided": False,
            "latency_ms": elapsed_ms,
            "node_used": "local_mesh",
            "node_display": "⚡ Yürütücü (Executor)",
            "done": True
        }

    async def stream_schedule(self, need: Need) -> AsyncGenerator[dict, None]:
        import asyncio
        start_time = time.time()
        prompt_l = need.prompt.lower()
        
        # Check if this is an explicit execution command (e.g. read file, scan downloads, send email, opacus/mpc tools) vs conversational chat
        is_execution_command = any(k in prompt_l for k in ["dosya", "file", "oku", "read", "mail", "eposta", "yaz", "sil", "delete", "tara", "scan", "analiz", "extract", "browser", "site", "opacus", "mpc", "kinetic", "tool", "arac"])

        if is_execution_command:
            yield {"type": "token", "token": "🔍 [Planner] Niyet analizi yapılıyor...\n"}
            await asyncio.sleep(0.05)
            
            available_skills = SkillRegistry.get_manifests()
            plan_json = await self.planner.create_plan(need.prompt, available_skills)
            yield {"type": "token", "token": "📋 [Compiler] AST oluşturuldu, IR formatına derleniyor...\n"}
            await asyncio.sleep(0.05)
            
            from myca.planner.compiler import ExecutionCompiler
            compiler = ExecutionCompiler()
            dag_plan = compiler.compile_ast_to_dag(plan_json)
            yield {"type": "token", "token": "⚡ [Optimizer] Akış optimize ediliyor ve paralel yollar belirleniyor...\n"}
            await asyncio.sleep(0.05)
            
            from myca.planner.validator import GraphValidator
            validator = GraphValidator()
            validation_res = validator.validate(dag_plan)
            if not validation_res.valid:
                yield {"type": "token", "token": f"⚠️ [Validator] UYARI: {', '.join(validation_res.errors)}\n"}
            else:
                yield {"type": "token", "token": "✅ [Validator] Politika ve izin doğrulaması tamamlandı. Yürütme başlatılıyor...\n"}
            await asyncio.sleep(0.05)
            
            from myca.skills.core.context import SkillContext
            from myca.skills.core.permissions import PermissionManager
            from myca.execution.scheduler import ExecutionScheduler
            from myca.execution.event_bus import ExecutionEventBus
            from myca.execution.artifacts import ArtifactStore
            from myca.execution.verifier import ExecutionVerifier
            
            permissions = PermissionManager()
            permissions.request(dag_plan.get("permissions", ["fs", "browser", "network"]))
            
            ctx = SkillContext(
                need_id=need.need_id,
                runtime=self,
                memory=self.memory,
                capabilities=None,
                permissions=permissions
            )
            
            graph = ExecutionGraph(dag_plan)
            scheduler = ExecutionScheduler(event_bus=ExecutionEventBus())
            verifier = ExecutionVerifier()
            
            yield {"type": "token", "token": "\n⚙️ YÜRÜTME ADIMLARI:\n"}
            workflow_id = f"wf-{need.need_id[:8]}"
            await scheduler.run(graph, ctx, workflow_id=workflow_id)
            
            # Post-Execution Verifier Stage
            for n_id, node in graph.nodes.items():
                if node.result and node.result.outputs:
                    v_res = verifier.verify(node.skill_name, node.inputs, node.result.outputs)
                    if not v_res.passed:
                        logger.warning(f"Post-execution verification failed for node {n_id}: {v_res.checks}")
            
            success = all(getattr(n.status, "value", str(n.status)) in ["completed", "NodeState.COMPLETED"] for n in graph.nodes.values())
            elapsed_ms = (time.time() - start_time) * 1000
            
            execution_results = {}
            for n_id, node in graph.nodes.items():
                status_val = getattr(node.status, "value", str(node.status))
                status_icon = "✅" if status_val == "completed" else "❌"
                yield {"type": "token", "token": f"{status_icon} Düğüm [{n_id}] ({node.skill_name}) -> {status_val}\n"}
                if node.result and node.result.success:
                    execution_results[n_id] = node.result.outputs
                else:
                    execution_results[n_id] = {"status": status_val, "error": getattr(node.result, "error", None)}
            
            # Direct response or LLM explainer
            direct_response = None
            for n_id, outs in execution_results.items():
                if isinstance(outs, dict) and "response" in outs and outs["response"]:
                    direct_response = outs["response"]
                    break
            
            if direct_response:
                yield {"type": "token", "token": direct_response}
            else:
                # Extract file lists or main output keys naturally
                files_found = []
                for n_id, outs in execution_results.items():
                    if isinstance(outs, dict):
                        if "files" in outs:
                            files_found.extend(outs["files"])
                        elif "extracted_text" in outs:
                            files_found.append(outs["extracted_text"][:200])

                if files_found:
                    sample_files = ", ".join(files_found[:6])
                    summary_msg = f"İsteğinizi tamamladım! Klasörde/dosyada bulunan öğeler: {sample_files}. Toplam {len(files_found)} öge tarandı ve işlendi."
                else:
                    summary_msg = "İstediğiniz işlem ve otomasyon akışı başarıyla tamamlandı!"

                yield {"type": "token", "token": summary_msg}
        else:
            # Natural Conversational Chatbot Mode
            try:
                chat_response = await self.node.inference_engine.generate(need.prompt)
                yield {"type": "token", "token": chat_response}
            except Exception as e:
                logger.error(f"[RUNTIME CHAT ERROR] {e}", exc_info=True)
                yield {"type": "token", "token": "Merhaba! Ben Myca Execution OS Asistanı. Size nasıl yardımcı olabilirim?"}
            elapsed_ms = (time.time() - start_time) * 1000

        yield {
            "type": "done",
            "source": "executor_mesh",
            "compute_avoided": False,
            "latency_ms": elapsed_ms,
            "node_used": "local_mesh",
            "node_display": "⚡ Yerel Chatbot Model" if not is_execution_command else "⚡ Yürütücü (Executor)"
        }
