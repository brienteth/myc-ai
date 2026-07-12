"""
Verification tests for the Myca Execution API (Phase 2.1).
Run this script to verify Lifecycle, Composition, and Cancellation/Streaming.
"""
import asyncio
import logging
from myca.skills.core.context import SkillContext
from myca.skills.core.registry import SkillRegistry
from myca.skills.core.permissions import PermissionManager
from myca.skills.core.decorator import skill

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_sdk")

# --- Mock OS Services ---
class MockRuntime:
    pass

class MockMemory:
    pass

class MockCapabilities:
    pass

# --- 1. Mock Skill for Lifecycle/Failure ---
@skill(id="test.failing_skill", permissions=["test"])
def failing_skill(ctx):
    ctx.emit("Executing failing skill")
    raise ValueError("Simulated skill failure")

# --- 2. Mock Skill for Streaming & Cancel ---
@skill(id="test.streaming_skill", permissions=["test"], streaming=True)
async def streaming_skill(ctx):
    ctx.emit("Starting streaming")
    for i in range(10):
        await ctx.check_cancel()
        ctx.progress(i / 10.0)
        yield {"chunk": f"data_{i}"}
        await asyncio.sleep(0.1)

# --- 3. Mock Skill for Composition ---
@skill(id="test.composed_skill", permissions=["test"])
async def composed_skill(ctx):
    ctx.emit("Starting composition")
    # Calling another skill internally
    result = await ctx.execute("test.streaming_skill")
    return {"composition_success": result.success, "sub_outputs": result.outputs}

async def run_tests():
    permissions = PermissionManager()
    permissions.request(["test", "browser", "network"])
    
    ctx = SkillContext(
        need_id="need_123",
        runtime=MockRuntime(),
        memory=MockMemory(),
        capabilities=MockCapabilities(),
        permissions=permissions
    )

    print("\n=== Test 1: Lifecycle & Failure Recovery ===")
    res1 = await SkillRegistry.execute(ctx, "test.failing_skill")
    print(f"Result: {res1.success}, Warnings: {res1.warnings}, Recoverable: {res1.recoverable}")

    print("\n=== Test 2: Streaming & Cancel ===")
    # We will cancel it midway
    cancel_task = asyncio.create_task(cancel_after(ctx, 0.3))
    res2 = await SkillRegistry.execute(ctx, "test.streaming_skill")
    print(f"Result: {res2.success}, Outputs: {res2.outputs}, Warnings: {res2.warnings}")
    
    # Reset cancellation for next test
    ctx._is_cancelled = False

    print("\n=== Test 3: Composition ===")
    res3 = await SkillRegistry.execute(ctx, "test.composed_skill")
    print(f"Result: {res3.success}, Outputs: {res3.outputs}")

async def cancel_after(ctx, delay: float):
    await asyncio.sleep(delay)
    print(">>> Cancelling execution now!")
    ctx.cancel()

if __name__ == "__main__":
    asyncio.run(run_tests())
