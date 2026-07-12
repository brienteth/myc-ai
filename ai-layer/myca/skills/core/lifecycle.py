"""
Skill Lifecycle Engine
Manages the execution pipeline of a skill.
Loading -> Permission Check -> Prepare -> Execute -> Recover -> Cleanup -> Learn
"""
import asyncio
import logging
import time
from typing import Any
from .context import SkillContext
from .result import SkillResult

logger = logging.getLogger("myca.skills.lifecycle")

class SkillLifecycle:
    def __init__(self, skill_def: Any, context: SkillContext):
        self.skill = skill_def
        self.ctx = context
        
    async def run(self, **kwargs) -> SkillResult:
        start_time = time.time()
        
        # 1. Loading
        self.ctx.emit("lifecycle.loading")
        
        # 2. Permission Check
        self.ctx.emit("lifecycle.permission_check")
        for perm in self.skill.manifest.permissions:
            if not self.ctx._permissions.check(perm):
                return SkillResult(success=False, logs=["Permission Denied"])
                
        # 3. Prepare
        self.ctx.emit("lifecycle.prepare")
        # (E.g. ensure browser context is awake, network is up)
        
        # 4. Execute
        self.ctx.emit("lifecycle.execute")
        result = None
        try:
            # Check if skill is an async generator (streaming)
            import inspect
            if inspect.isasyncgenfunction(self.skill.func):
                # Consume generator (for testing, we just exhaust it and return last yield)
                # In real OS, this would pipe to the transport layer.
                outputs = {}
                async for chunk in self.skill.func(self.ctx, **kwargs):
                    outputs.update(chunk)
                result = SkillResult(success=True, outputs=outputs)
            elif inspect.iscoroutinefunction(self.skill.func):
                res = await self.skill.func(self.ctx, **kwargs)
                if isinstance(res, SkillResult):
                    result = res
                else:
                    result = SkillResult(success=True, outputs=res or {})
            else:
                res = self.skill.func(self.ctx, **kwargs)
                result = SkillResult(success=True, outputs=res or {})
                
        except asyncio.CancelledError:
            self.ctx.log("Execution cancelled.")
            result = SkillResult(success=False, warnings=["Cancelled by user"])
        except Exception as e:
            self.ctx.log(f"Execution failed: {e}")
            
            # 5. Recover
            self.ctx.emit("lifecycle.recover")
            # Trigger recovery engine
            logger.warning(f"Skill {self.skill.manifest.id} failed, attempting recovery...")
            result = SkillResult(success=False, recoverable=True, warnings=[str(e)])
            
        # 6. Cleanup
        self.ctx.emit("lifecycle.cleanup")
        
        # 7. Learn
        self.ctx.emit("lifecycle.learn")
        elapsed_ms = (time.time() - start_time) * 1000
        if result:
            result.metrics["latency_ms"] = elapsed_ms
            result.logs.extend(self.ctx._logs)
            
        return result
