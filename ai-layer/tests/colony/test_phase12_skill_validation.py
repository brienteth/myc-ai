import pytest
import asyncio
from pydantic import BaseModel
from myca.skills.core.decorator import skill
from myca.skills.core.registry import SkillRegistry
from myca.skills.core.context import SkillContext

@skill(id="typed_skill")
async def dummy_typed(ctx, count: int, flag: bool, label: str):
    return {"status": "ok", "result": f"{label}-{count}-{flag}"}

@pytest.mark.asyncio
async def test_phase12_skill_validation():
    """
    PHASE 12: SKILL VALIDATION TEST
    Verify that the Skill Registry automatically generates Pydantic schemas from 
    type hints and enforces them before execution.
    """
    # Create a mock context
    mock_ctx = SkillContext(need_id="test", runtime=None, memory={}, capabilities=None, permissions=[])
    
    # 1. Valid Execution
    res = await SkillRegistry.execute(
        ctx=mock_ctx,
        skill_id="typed_skill",
        count=5,
        flag=True,
        label="test"
    )
    assert res.success is True
    assert res.outputs["result"] == "test-5-True"
    
    # 2. Type coercion (string to int) should work via Pydantic
    res2 = await SkillRegistry.execute(
        ctx=mock_ctx,
        skill_id="typed_skill",
        count="10",
        flag="false",
        label="coerce"
    )
    assert res2.success is True
    assert res2.outputs["result"] == "coerce-10-False"
    
    # 3. Invalid Execution (Missing required arg)
    res3 = await SkillRegistry.execute(
        ctx=mock_ctx,
        skill_id="typed_skill",
        count=5,
        flag=True
        # missing label
    )
    assert res3.success is False
    assert any("Validation Failed" in log for log in res3.logs)
    
    # 4. Invalid Execution (Wrong type that cannot be coerced)
    res4 = await SkillRegistry.execute(
        ctx=mock_ctx,
        skill_id="typed_skill",
        count="not_an_int",
        flag=True,
        label="bad"
    )
    assert res4.success is False
    assert any("Validation Failed" in log for log in res4.logs)
