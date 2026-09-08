import logging
import uuid
import time
from typing import Dict, Any, List

from myca_intelligence.inference.context_orchestrator import ContextOrchestrator
from myca_intelligence.inference.inference_router import InferenceRouter
from myca_intelligence.automation.brain import VaultDB

from myca.core.need import Need, PrivacyLevel
from myca.skills.core.registry import SkillRegistry
from myca.skills.core.context import SkillContext
from myca.skills.core.permissions import PermissionManager
from myca.execution.scheduler import ExecutionScheduler
from myca.execution.event_bus import ExecutionEventBus
from myca.execution.verifier import ExecutionVerifier
from myca.contracts.execution import ExecutionGraph
from myca_intelligence.planner.compiler import ExecutionCompiler
from myca_intelligence.planner.optimizer import GraphOptimizer
from myca_intelligence.planner.validator import GraphValidator

logger = logging.getLogger("myca_intelligence.inference.assistant")

class MycaAssistant:
    """
    Unified Myca OS AI Assistant.
    Orchestrates the entire loop: Intent -> Context -> Router -> Execution -> Verification -> Memory.
    """

    def __init__(self, node_ref=None):
        self.node = node_ref
        self.orchestrator = ContextOrchestrator()
        self.router = InferenceRouter(node_ref)
        self.system_prompt = (
            "Sen Myca'sın — kullanıcının cihazında yerel ve çevrimdışı çalışan zeki bir yapay zeka asistanısın.\n"
            "Kurallar:\n"
            "1. Türkçe sorulara doğal, akıcı ve doğru Türkçe ile cevap ver.\n"
            "2. Meyveler (erik, elma vb.), sebzeler (patlıcan vb.), günlük hayat, tıp ve bilim konularında doğru bilgiler ver. Asla hayali tanımlar uydurma.\n"
            "3. Kod istendiğinde modern, çalışan ve temiz kodlar üret.\n"
            "4. Yanıtı net, doğrudan ve amaca yönelik tut.\n"
        )
    def classify_intent(self, prompt: str) -> str:
        """Classifies the prompt into CHAT, QUESTION, KNOWLEDGE_RETRIEVAL, FILE_OPERATION, EXECUTION, RESEARCH, AUTOMATION, SYSTEM_COMMAND, MULTI_STEP_TASK"""
        p = prompt.lower().strip()
        
        # CHAT & SUMMARIZATION / GENERAL READING
        if any(w in p for w in ["nasılsın", "neler yapabilirsin", "türkçe konuş", "selam", "merhaba", "hey", "hello", "hi", "özet", "özetle", "açıkla", "anlat", "nedir"]):
            return "CHAT"
            
        # AUTOMATION / CRON
        if any(w in p for w in ["otomasyon", "cron", "zamanlayıcı", "schedule", "trigger", "tetikle"]):
            return "AUTOMATION"
            
        # RESEARCH / COMPARISON
        if any(w in p for w in ["araştır", "karşılaştır", "competitor", "research", "compare"]):
            return "RESEARCH"
            
        # EXECUTION / WORKFLOW
        if any(w in p for w in [
            "çalıştır", "gönder", "send", "run", "workflow", "pipeline", "deploy", "build dag", "yürüt", "mpc", "opacus", "kinetic",
            "fotoğrafını çek", "fotoğraf çek", "resmini çek", "resim çek", "analiz et", "analiz yap", "bilgi çıkar", "bilgileri çıkar",
            "rapor oluştur", "raporu oluştur", "pdf oluştur", "pdf yap", "pdf raporu", "dosya oluştur", "tarat"
        ]):
            return "EXECUTION"
            
        # FILE OPERATION (Explicit actions like creating/deleting/moving files)
        if any(w in p for w in ["dosya oluştur", "dosya sil", "klasör sil", "klasör oluştur", "pdf oluştur"]):
            return "FILE_OPERATION"

            
        # KNOWLEDGE RETRIEVAL
        if any(w in p for w in ["vault", "not", "arama", "bul", "getir", "search notes", "semantic", "karar", "hakkında", "geçen"]):
            return "KNOWLEDGE_RETRIEVAL"
            
        # SYSTEM COMMAND
        if any(w in p for w in ["terminal", "komut", "execute command", "bash", "shell"]):
            return "SYSTEM_COMMAND"
            
        # QUESTION
        if p.endswith("?") or any(w in p for w in ["nelerdir", "nasıl", "why", "what", "how", "who"]):
            return "QUESTION"
            
        # Default fallback is CHAT unless explicit execution intent was specified above
        return "CHAT"

    async def process_prompt(self, prompt: str, history: List[Dict[str, Any]] = None, skip_planner: bool = False) -> Dict[str, Any]:
        """
        Main unified cognitive cycle.
        """
        history = history or []
        start_time = time.time()
        
        # 1. Intent Classification
        intent_mode = self.classify_intent(prompt)
        
        # Override: skip_planner forces simple chat path (e.g. Knowledge OS document analysis)
        if skip_planner:
            intent_mode = "CHAT"
            
        is_simple = intent_mode in ["CHAT", "QUESTION", "KNOWLEDGE_RETRIEVAL"]
        
        logger.info(f"[ASSISTANT] Processing prompt: '{prompt[:45]}' -> Intent: {intent_mode} (Simple: {is_simple}, SkipPlanner: {skip_planner})")

        # 2. Context Orchestrator (Personal Brain Retrieval)
        context = await self.orchestrator.build_context(prompt, history)
        context["intent_mode"] = intent_mode

        # Standard initializations
        response_text = ""
        provider = "Local Engine"
        route = "LOCAL"
        model_name = "Qwen2.5-3B"
        fallback_used = False
        cost = 0.00
        execution_id = None
        execution_status = None
        passed_verifications = True
        verification_score = 1.0

        # Scenario A: Simple Request (CHAT, QUESTION, KNOWLEDGE_RETRIEVAL)
        if is_simple:
            # Inject active MCP tools into system prompt context so the LLM is fully aware of MCP servers
            available_skills = SkillRegistry.get_manifests()
            mcp_skills = []
            for s in available_skills:
                s_cat = s.get("category", "") if isinstance(s, dict) else getattr(s, "category", "")
                s_id = s.get("id", "") if isinstance(s, dict) else getattr(s, "id", "")
                if s_cat == "mcp" or (isinstance(s_id, str) and s_id.startswith("mcp.")):
                    mcp_skills.append(s)
            
            sys_prompt = self.system_prompt
            if mcp_skills:
                mcp_items = []
                for s in mcp_skills[:20]:
                    s_id = s.get("id", "") if isinstance(s, dict) else getattr(s, "id", "")
                    s_desc = s.get("description", "") if isinstance(s, dict) else getattr(s, "description", "")
                    name = s_id.split(".")[-1] if isinstance(s_id, str) else "mcp"
                    desc = s_desc[:40] if isinstance(s_desc, str) else ""
                    mcp_items.append(f"{name} ({desc})")
                mcp_summary = ", ".join(mcp_items)
                sys_prompt += f"\n\n[Aktif Bağlı MCP Sunucuları ve Araçları]: {mcp_summary}. (Toplam {len(mcp_skills)} MCP yeteneği entegre edildi.)"

            inference_result = await self.router.route_and_generate(prompt, context, sys_prompt)
            response_text = inference_result.get("response", "")
            provider = inference_result.get("provider", "Local Engine")
            route = inference_result.get("route", "LOCAL")
            model_name = inference_result.get("model", "Qwen2.5-3B")
            fallback_used = inference_result.get("fallback_used", False)
            cost = inference_result.get("cost", 0.00)

        # Scenario B: Execution Request (triggers Planner + Graph compiler + Execution scheduler + Verifier + Repair)
        else:
            runtime = getattr(self.node, "runtime", None)
            if runtime and runtime.planner:
                try:
                    logger.info("[ASSISTANT] Triggering Execution Brain pipeline...")
                    available_skills = SkillRegistry.get_manifests()
                    
                    # Plan
                    plan_json = await runtime.planner.create_plan(prompt, available_skills)
                    
                    # Compile
                    compiler = ExecutionCompiler()
                    dag_plan = compiler.compile_ast_to_dag(plan_json)
                    
                    # Optimize & Validate
                    optimizer = GraphOptimizer()
                    optimized_plan = optimizer.optimize(dag_plan)
                    
                    validator = GraphValidator()
                    validation_res = validator.validate(optimized_plan)
                    if not validation_res.valid:
                        logger.warning(f"[ASSISTANT] Plan validation warnings: {validation_res.errors}")
                    
                    # Onay (Approval) Mekanizması: Yürütme yok, sadece taslağı LLM'e gösterip onay istiyoruz.
                    execution_status = "PROPOSED"
                    
                    explainer_prompt = f"""Kullanıcı isteği: "{prompt}"
Hazırlanan Otomasyon Akış Planı (DAG): {optimized_plan}

Sen Myca Asistan'sın. Kullanıcının isteğini yerine getirmek için yukarıdaki otomasyon planını başarıyla hazırladın.
Ancak güvenlik gereği bu planı doğrudan çalıştırmadın. Kullanıcıya planı hazırladığını müjdele, planın ne yapacağını kısaca açıkla (teknik detaylara boğmadan) ve planı onaylamak / çalıştırmak için 'Automate Flow' butonuna (veya sekmesine) tıklamasını söyle.
Lütfen doğal, samimi ve Türkçe konuş."""
                    
                    inference_result = await self.router.route_and_generate(explainer_prompt, context, self.system_prompt)
                    response_text = inference_result.get("response", "")
                    provider = inference_result.get("provider", "Local Engine")
                    route = inference_result.get("route", "LOCAL")
                    model_name = inference_result.get("model", "Qwen2.5-3B")
                    fallback_used = inference_result.get("fallback_used", False)
                    cost = inference_result.get("cost", 0.00)
                    
                    execution_id = f"draft-{uuid.uuid4().hex[:8]}"
                    
                except Exception as ex:
                    logger.error(f"[ASSISTANT] Execution pipeline failed: {ex}", exc_info=True)
                    response_text = f"İşlem planlanırken hata oluştu: {ex}"
                    execution_status = "FAILED"
                    passed_verifications = False
                    verification_score = 0.0
            else:
                logger.warning("[ASSISTANT] Runtime planner not found. Executing fallback direct generation.")
                inference_result = await self.router.route_and_generate(prompt, context, self.system_prompt)
                response_text = inference_result.get("response", "")
                provider = inference_result.get("provider", "Local Engine")
                route = inference_result.get("route", "LOCAL")
                model_name = inference_result.get("model", "Qwen2.5-3B")
                fallback_used = inference_result.get("fallback_used", False)
                cost = inference_result.get("cost", 0.00)
                execution_status = "FAILED"

        # 5. Knowledge Write-Back (Personal Brain update)
        if self._is_durable_memory(prompt, response_text) or (not is_simple and execution_status == "SUCCESS"):
            logger.info("[ASSISTANT] Durable decision or execution experience detected. Writing back to Second Brain...")
            note_id = f"note-{uuid.uuid4().hex[:8]}"
            VaultDB.save_note({
                "id": note_id,
                "title": f"Experience: {prompt[:50]}",
                "content_preview": response_text[:400],
                "tags": ["learned", "experience", "decision"] if is_simple else ["experience", "execution", "success"],
                "links": [],
                "source_type": "decision" if is_simple else "experience",
                "created_at": time.time()
            })

        latency = time.time() - start_time

        # Standart Response Contract
        result = {
            "response": response_text,
            "intent": intent_mode,
            "provider": provider,
            "route": route,
            "model": model_name,
            "fallback_used": fallback_used,
            "cost": cost,
            "execution_id": execution_id,
            "execution_status": execution_status,
            "latency_s": round(latency, 2),
            "verification_score": verification_score,
            "passed_verifications": passed_verifications
        }
        
        if execution_status == "PROPOSED" and 'optimized_plan' in locals():
            result["requires_approval"] = True
            result["proposed_plan"] = optimized_plan
            
        return result

    def _is_durable_memory(self, prompt: str, response: str) -> bool:
        """Determines if the interaction contains persistent preference or decision memory."""
        durable_triggers = ["her zaman", "always", "bundan sonra", "decide", "karar", "tercih", "preference", "policy"]
        return any(trig in prompt.lower() for trig in durable_triggers)
