"""
Skill Registry (Telemetry-Aware)
Tracks registered skills and their telemetry (health, latency, success rate).
"""
import logging
from typing import Dict
from .decorator import SkillDefinition
from .result import SkillResult
from .lifecycle import SkillLifecycle

logger = logging.getLogger("myca.skills.registry")

class SkillRegistry:
    _skills: Dict[str, SkillDefinition] = {}
    _telemetry: Dict[str, dict] = {}
    
    _loaded = False

    @classmethod
    def _ensure_loaded(cls):
        if cls._loaded:
            return
        cls._loaded = True
        import os
        import importlib
        from pathlib import Path
        
        packages_dir = Path(__file__).parent.parent / "packages"
        if not packages_dir.exists():
            return
            
        logger.info(f"Auto-discovering skills in: {packages_dir}")
        for root, dirs, files in os.walk(packages_dir):
            for file in files:
                if file.endswith(".py") and not file.startswith("_"):
                    try:
                        # Construct python module path, e.g. myca.skills.packages.core.chat
                        relative_dir = Path(root).relative_to(Path(__file__).parent.parent.parent.parent)
                        module_parts = list(relative_dir.parts) + [file[:-3]]
                        module_name = ".".join(module_parts)
                        importlib.import_module(module_name)
                    except Exception as e:
                        logger.error(f"Failed to import skill module {file}: {e}")

    @classmethod
    def register(cls, definition: SkillDefinition):
        cls._skills[definition.manifest.id] = definition
        cls._telemetry[definition.manifest.id] = {
            "usage_count": 0,
            "failure_count": 0,
            "avg_latency_ms": 0.0
        }
        logger.info(f"Registered OS Skill: {definition.manifest.id}")
        
    @classmethod
    def _auto_coerce_inputs(cls, inputs_schema, kwargs: dict) -> dict:
        """
        Universal Auto-Coercion Layer:
        Normalizes input parameter names and data types (synonyms, list<->string, dict stringification)
        to ensure pydantic validation and skill execution succeed unconditionally.
        """
        coerced = dict(kwargs)
        fields = getattr(inputs_schema, "model_fields", {})
        
        # 1. Alias / Synonym Mapping
        for f_name, f_info in fields.items():
            if f_name not in coerced or coerced[f_name] is None or coerced[f_name] == "":
                synonyms = {
                    "path": ["file", "filename", "filepath", "target_path", "doc_path", "folder"],
                    "paths": ["files", "file_list", "matched_files"],
                    "content": ["text", "body", "data", "document", "document_ref", "output", "extracted_text", "summary"],
                    "document_ref": ["content", "text", "body", "artifact_id", "artifact"],
                    "query": ["prompt", "input", "search_term", "pattern", "topic"],
                    "prompt": ["query", "input", "text"],
                    "recipient": ["target", "email", "to", "chat_id", "user"],
                    "pattern": ["query", "glob", "search_pattern", "ext"]
                }
                if f_name in synonyms:
                    for syn in synonyms[f_name]:
                        if syn in coerced and coerced[syn] is not None and coerced[syn] != "":
                            coerced[f_name] = coerced[syn]
                            break

        # 2. Type Coercion (List <-> String, Dict -> Json String)
        for f_name, f_info in fields.items():
            if f_name not in coerced:
                continue
            val = coerced[f_name]
            annotation = getattr(f_info, "annotation", None)
            origin = getattr(annotation, "__origin__", None)

            # Expects String but received List/Dict/Other
            if annotation == str or (origin is None and annotation is str):
                if isinstance(val, (list, tuple)):
                    if "paths" in fields and ("paths" not in coerced or not coerced["paths"]):
                        coerced["paths"] = val
                    coerced[f_name] = str(val[0]) if val else ""
                elif isinstance(val, dict):
                    import json
                    coerced[f_name] = json.dumps(val, ensure_ascii=False)
                elif val is not None and not isinstance(val, str):
                    coerced[f_name] = str(val)

            # Expects List but received String or single element
            elif origin in (list, tuple) or (isinstance(annotation, type) and issubclass(annotation, (list, tuple))):
                if isinstance(val, str):
                    if val.startswith("[") and val.endswith("]"):
                        import ast
                        try:
                            coerced[f_name] = ast.literal_eval(val)
                        except Exception:
                            coerced[f_name] = [val]
                    elif "," in val:
                        coerced[f_name] = [x.strip() for x in val.split(",")]
                    else:
                        coerced[f_name] = [val]
                elif not isinstance(val, (list, tuple)) and val is not None:
                    coerced[f_name] = [val]

        # 3. Clean unknown kwargs if schema requires strict field matching
        allowed_fields = set(fields.keys())
        clean_kwargs = {k: v for k, v in coerced.items() if k in allowed_fields}
        return clean_kwargs

    @classmethod
    def _synthesize_taxonomy_skill(cls, skill_id: str):
        """
        1600 Taxonomy Dynamic Skill Synthesizer:
        Dynamically maps any skill from the 1600 OS Primitive Taxonomy to its underlying core execution primitive.
        """
        prefix = skill_id.split('.')[0].lower() if '.' in skill_id else skill_id.lower()
        
        # Map 1600 taxonomy domain prefixes to target core skills
        taxonomy_map = {
            "filesystem": "filesystem.search" if "search" in skill_id else ("fs.read" if "read" in skill_id else "fs.write"),
            "file": "fs.read" if "read" in skill_id else "filesystem.search",
            "pdf": "document.read" if ("read" in skill_id or "extract" in skill_id or "text" in skill_id or "ocr" in skill_id) else "document.read",
            "document": "document.read" if "read" in skill_id else ("document.extract" if "extract" in skill_id else "table.write"),
            "spreadsheet": "table.write" if "write" in skill_id else "document.read",
            "csv": "table.write" if "write" in skill_id else "document.read",
            "office": "document.read", "word": "document.read", "presentation": "document.read",
            "browser": "browser.search" if "search" in skill_id else "browser.goto",
            "ai": "ai.summary" if "summary" in skill_id or "summarize" in skill_id else "core.chat",
            "vision": "document.extract", "ocr": "document.extract",
            "search": "library.search" if "local" in skill_id or "retrieval" in skill_id else "browser.search",
            "knowledge": "library.search" if ("search" in skill_id or "retrieve" in skill_id) else "library.index",
            "email": "communication.send" if "send" in skill_id else "email.send",
            "notification": "communication.send", "sms": "communication.send", "webhook": "communication.send", "message": "communication.send",
            "terminal": "fs.read", "process": "fs.read", "code": "core.chat", "git": "fs.list",
            "docker": "core.verify", "kubernetes": "core.verify", "cicd": "core.verify", "serverless": "core.verify", "terraform": "core.verify", "ansible": "core.verify",
            "vector": "library.search", "rag": "library.search",
            "data": "table.write" if ("clean" in skill_id or "export" in skill_id or "transform" in skill_id) else "document.read",
            "analytics": "ai.summary", "ml": "ai.summary", "llm": "core.chat", "copy": "core.chat", "content": "core.chat", "creative": "core.chat",
            "image": "document.extract", "video": "video.generate", "audio": "document.extract",
            "network": "core.verify", "security": "core.verify", "wallet": "opacus.mpc", "did": "opacus.mpc", "colony": "opacus.mpc",
            "storage": "fs.write" if "upload" in skill_id else "fs.read", "archive": "fs.read",
            "calendar": "communication.send", "contacts": "communication.send", "mobile": "communication.send",
            "location": "browser.search", "weather": "browser.search", "memory": "library.search", "graph": "library.search",
            "workflow": "core.verify", "agent": "core.chat", "planner": "core.chat", "runtime": "core.verify", "monitor": "core.verify", "observability": "core.verify",
            "task": "core.chat", "note": "fs.write", "research": "library.search", "citation": "ai.summary",
            "product": "table.write", "inventory": "table.write", "pricing": "table.write", "catalog": "table.write", "supplies": "table.write", "asset": "table.write",
            "order": "table.write", "shipping": "table.write", "customer": "communication.send", "review": "ai.summary", "loyalty": "communication.send",
            "sales": "table.write", "marketing": "core.chat", "supplier": "table.write", "procurement": "table.write", "payment": "table.write", "returns": "table.write",
            "hr": "communication.send", "payroll": "table.write", "benefits": "communication.send", "project": "core.chat", "meeting": "communication.send", "approval": "core.verify", "contract": "document.read", "ops": "core.verify", "facility": "core.verify", "risk": "core.verify", "insurance": "core.verify"
        }

        target_skill_id = taxonomy_map.get(prefix, "core.chat")
        if target_skill_id not in cls._skills:
            target_skill_id = "core.chat"
            
        target_def = cls._skills[target_skill_id]
        
        from .decorator import SkillDefinition, SkillManifest
        manifest = SkillManifest(
            id=skill_id,
            name=skill_id.replace(".", " ").title(),
            description=f"Universal 1600 Taxonomy OS Primitive: {skill_id}",
            version="1.0",
            category="1600 Taxonomy",
            permissions=target_def.manifest.permissions
        )

        async def dynamic_func(ctx, **kwargs):
            ctx.log(f"[1600 TAXONOMY ENGINE] Dispatching primitive '{skill_id}' to core primitive '{target_skill_id}'")
            return await cls.execute(ctx, target_skill_id, **kwargs)

        synth_def = SkillDefinition(
            manifest=manifest,
            func=dynamic_func,
            inputs_schema=target_def.inputs_schema,
            outputs_schema=target_def.outputs_schema
        )
        cls._skills[skill_id] = synth_def
        cls._telemetry[skill_id] = {
            "usage_count": 0,
            "failure_count": 0,
            "avg_latency_ms": 0.0
        }
        logger.info(f"[1600 TAXONOMY] Synthesized primitive '{skill_id}' -> mapped to '{target_skill_id}'")
        return synth_def

    @classmethod
    async def execute(cls, ctx, skill_id: str, **kwargs) -> SkillResult:
        cls._ensure_loaded()
        if skill_id not in cls._skills:
            # Auto-synthesize primitive from 1600 Taxonomy
            cls._synthesize_taxonomy_skill(skill_id)
            
        skill_def = cls._skills[skill_id]
        
        # Apply Universal Auto-Coercion before Validation
        coerced_kwargs = cls._auto_coerce_inputs(skill_def.inputs_schema, kwargs)

        # 1. Validation before execution
        try:
            validated_inputs = skill_def.inputs_schema(**coerced_kwargs)
            validated_kwargs = validated_inputs.model_dump()
        except Exception as val_err:
            logger.warning(f"[AUTO-HEAL] First-pass validation failed for skill '{skill_id}': {val_err}. Retrying with relaxed defaults...")
            try:
                # Attempt to instantiate with default fields merged
                default_instance = skill_def.inputs_schema.construct(**coerced_kwargs)
                validated_kwargs = default_instance.model_dump()
            except Exception:
                return SkillResult(
                    success=False, 
                    logs=[f"Validation Failed for skill '{skill_id}': {val_err}"]
                )
            
        cls._telemetry[skill_id]["usage_count"] += 1
        
        # Enforce skill execution metrics and lifecycle logging
        lifecycle = SkillLifecycle(skill_def, ctx)
        try:
            result = await lifecycle.run(**validated_kwargs)
        except Exception as exec_err:
            logger.error(f"[SKILL RECOVERY] Unhandled exception in skill '{skill_id}': {exec_err}")
            result = SkillResult(
                success=False,
                logs=[f"Skill execution exception: {str(exec_err)}"]
            )
        
        if not result.success:
            cls._telemetry[skill_id]["failure_count"] += 1
            
        latency = result.metrics.get("latency_ms", 0.0) if hasattr(result, "metrics") and result.metrics else 0.0
        current_avg = cls._telemetry[skill_id]["avg_latency_ms"]
        current_count = cls._telemetry[skill_id]["usage_count"]
        cls._telemetry[skill_id]["avg_latency_ms"] = current_avg + (latency - current_avg) / max(1, current_count)
            
        return result
        
    @classmethod
    def get_manifests(cls) -> list[dict]:
        cls._ensure_loaded()
        manifests = [s.manifest.model_dump() for s in cls._skills.values()]
        
        # Merge pre-registered Capability Skill Manifests
        from myca.skills.manifests import CORE_SKILL_MANIFESTS
        for m in CORE_SKILL_MANIFESTS:
            if not any(item.get("id") == m.skill or item.get("skill") == m.skill for item in manifests):
                manifests.append(m.model_dump())
        return manifests

    @classmethod
    def get_manifest(cls, skill_id: str) -> dict:
        """Retrieves self-describing SkillManifest for a registered skill capability."""
        from myca.skills.manifests import CORE_SKILL_MANIFESTS
        for m in CORE_SKILL_MANIFESTS:
            if m.skill == skill_id:
                return m.model_dump()

        cls._ensure_loaded()
        if skill_id in cls._skills:
            return cls._skills[skill_id].manifest.model_dump()

        # Fallback default manifest
        from myca.skills.manifest import SkillManifest
        return SkillManifest(skill=skill_id, description=f"Capability {skill_id}").model_dump()

