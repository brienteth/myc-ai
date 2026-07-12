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
    async def execute(cls, ctx, skill_id: str, **kwargs) -> SkillResult:
        cls._ensure_loaded()
        if skill_id not in cls._skills:
            raise ValueError(f"Skill '{skill_id}' not found.")
            
        skill_def = cls._skills[skill_id]
        
        # 1. Validation before execution
        try:
            validated_inputs = skill_def.inputs_schema(**kwargs)
            validated_kwargs = validated_inputs.model_dump()
        except Exception as val_err:
            logger.error(f"Input validation failed for skill '{skill_id}': {val_err}")
            return SkillResult(
                success=False, 
                logs=[f"Validation Failed: {val_err}"]
            )
            
        cls._telemetry[skill_id]["usage_count"] += 1
        
        # Enforce skill execution metrics and lifecycle logging
        lifecycle = SkillLifecycle(skill_def, ctx)
        result = await lifecycle.run(**validated_kwargs)
        
        if not result.success:
            cls._telemetry[skill_id]["failure_count"] += 1
            
        latency = result.metrics.get("latency_ms", 0.0)
        current_avg = cls._telemetry[skill_id]["avg_latency_ms"]
        current_count = cls._telemetry[skill_id]["usage_count"]
        cls._telemetry[skill_id]["avg_latency_ms"] = current_avg + (latency - current_avg) / current_count
            
        return result
        
    @classmethod
    def get_manifests(cls) -> list[dict]:
        cls._ensure_loaded()
        return [s.manifest.model_dump() for s in cls._skills.values()]
