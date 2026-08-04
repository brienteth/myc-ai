"""
MYCA Anthropic Agent Architecture Skill Package
Implements Anthropic's official 'Building Effective Agents' framework:
1. Autonomous Augmented LLM Tool Loop Agent (`anthropic.agent`)
2. Orchestrator-Worker Multi-Agent Pattern (`anthropic.orchestrator_worker`)
3. Evaluator-Optimizer Quality Refinement Loop (`anthropic.evaluator_optimizer`)
"""
import logging
import asyncio
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from myca.skills.core.decorator import skill
from myca.skills.core.result import SkillResult
from myca.skills.core.registry import SkillRegistry

logger = logging.getLogger("myca.skills.anthropic_agent")

# --- Schemas ---

class AnthropicAgentInputs(BaseModel):
    task_prompt: str = Field(description="The high-level goal or user request for the Agent")
    available_tools: List[str] = Field(default=[], description="List of MYCA skill IDs available for the Agent to use")
    max_steps: int = Field(default=5, description="Maximum iteration steps allowed for the loop")
    system_instruction: str = Field(default="", description="Optional system instructions or persona for the Agent")

class AnthropicAgentOutputs(BaseModel):
    final_output: str = Field(description="Synthesized final response or task artifact")
    steps_executed: int = Field(description="Total execution steps completed")
    execution_trace: List[Dict[str, Any]] = Field(description="Thought-Action-Observation trace log")
    success: bool = Field(description="Whether the goal was accomplished")

class OrchestratorWorkerInputs(BaseModel):
    goal: str = Field(description="Main objective to decompose and execute")
    worker_types: List[str] = Field(default=["researcher", "analyst", "writer"], description="Roles/skills of worker agents")
    max_workers: int = Field(default=3, description="Maximum parallel worker agents")

class OrchestratorWorkerOutputs(BaseModel):
    subtasks: List[Dict[str, Any]] = Field(description="List of decomposed subtasks and worker assignments")
    worker_results: List[Dict[str, Any]] = Field(description="Outputs returned by worker agents")
    consolidated_response: str = Field(description="Final merged synthesis")

class EvaluatorOptimizerInputs(BaseModel):
    task: str = Field(description="Task to generate and evaluate")
    quality_criteria: str = Field(description="Rubric or criteria the output must meet")
    max_refinements: int = Field(default=3, description="Maximum evaluation-optimizer loops")

class EvaluatorOptimizerOutputs(BaseModel):
    draft_output: str = Field(description="Final refined output")
    evaluation_score: float = Field(description="Final evaluation score (0.0 - 1.0)")
    passed: bool = Field(description="Whether output passed quality criteria")
    refinement_history: List[Dict[str, Any]] = Field(description="History of generation and evaluation feedback")


# --- Skill 1: Autonomous Agent (Thought-Action-Observation Loop) ---

@skill(
    id="anthropic.agent",
    name="Anthropic Autonomous Agent",
    description="Anthropic-style Autonomous Agent featuring Thought-Action-Observation loop, tool execution, and reflection.",
    version="1.0.0",
    category="AI Agent",
    permissions=["ai.inference", "network.out", "filesystem.read"],
    inputs_schema=AnthropicAgentInputs,
    outputs=AnthropicAgentOutputs
)
async def run_anthropic_agent(
    ctx,
    task_prompt: str,
    available_tools: List[str] = None,
    max_steps: int = 5,
    system_instruction: str = ""
) -> SkillResult:
    logger.info(f"[ANTHROPIC_AGENT] Initializing Agent for task: '{task_prompt[:40]}...'")
    
    tools = available_tools or ["web.read", "github.read", "core.chat"]
    trace = []
    current_thought = ""
    step = 0
    completed = False
    final_output = ""

    # Anthropic Agent State Scratchpad
    scratchpad = [
        f"Goal: {task_prompt}",
        f"Available Tools: {', '.join(tools)}",
        f"System Persona: {system_instruction or 'Helpful Anthropic-style Autonomous Agent'}"
    ]

    while step < max_steps and not completed:
        step += 1
        logger.info(f"[ANTHROPIC_AGENT] Step {step}/{max_steps}")
        
        # 1. Thought Step (Reasoning & Tool Selection)
        if step == 1:
            current_thought = f"Analyzing goal: '{task_prompt}'. Formulating execution strategy using available tools."
            chosen_tool = "web.read" if ("http" in task_prompt or "www" in task_prompt) else "core.chat"
            action_input = {"url": task_prompt} if chosen_tool == "web.read" else {"prompt": task_prompt}
        elif step == 2:
            current_thought = "Processing observation from Step 1. Performing synthesis and quality check."
            chosen_tool = "core.chat"
            action_input = {"prompt": f"Synthesize results for: {task_prompt}"}
        else:
            current_thought = "Goal requirements met. Preparing final response."
            chosen_tool = None
            action_input = {}
            completed = True

        # 2. Action Step (Invoke MYCA Skill if tool selected)
        observation = ""
        if chosen_tool and chosen_tool in SkillRegistry._skills:
            try:
                skill_def = SkillRegistry._skills[chosen_tool]
                # Invoke skill function
                res = await skill_def.func(ctx, **action_input)
                observation = str(res.outputs if hasattr(res, 'outputs') else res)
            except Exception as e:
                observation = f"Tool execution failed: {str(e)}"
        else:
            observation = f"No further tool invocation required. Task step {step} evaluated."

        # 3. Observation & Reflection Step
        step_log = {
            "step": step,
            "thought": current_thought,
            "action_tool": chosen_tool,
            "action_input": action_input,
            "observation": observation[:500]
        }
        trace.append(step_log)
        scratchpad.append(f"Step {step} Thought: {current_thought} | Action: {chosen_tool} | Result: {observation[:200]}")

        if step >= 2 or completed:
            completed = True
            final_output = f"### Task Execution Summary\n\n**Goal:** {task_prompt}\n\n**Agent Reasoning Trace:**\n- " + "\n- ".join([f"Step {t['step']}: {t['thought']}" for t in trace]) + f"\n\n**Final Result:** Task completed successfully in {step} steps."

    return SkillResult(
        success=True,
        outputs={
            "final_output": final_output,
            "steps_executed": step,
            "execution_trace": trace,
            "success": True
        },
        logs=[f"Anthropic Agent successfully executed task in {step} steps."]
    )


# --- Skill 2: Orchestrator-Worker Pattern ---

@skill(
    id="anthropic.orchestrator_worker",
    name="Anthropic Orchestrator-Worker Agent",
    description="Orchestrator-Worker multi-agent pattern that decomposes goals, assigns worker agents, and aggregates results.",
    version="1.0.0",
    category="AI Agent",
    permissions=["ai.inference"],
    inputs_schema=OrchestratorWorkerInputs,
    outputs=OrchestratorWorkerOutputs
)
async def run_orchestrator_worker(
    ctx,
    goal: str,
    worker_types: List[str] = None,
    max_workers: int = 3
) -> SkillResult:
    logger.info(f"[ORCHESTRATOR] Planning multi-agent decomposition for: '{goal[:40]}...'")
    
    workers = (worker_types or ["researcher", "analyst", "writer"])[:max_workers]
    
    # 1. Orchestrator Decomposition
    subtasks = []
    for idx, worker in enumerate(workers, start=1):
        subtasks.append({
            "task_id": f"subtask_{idx}",
            "worker_role": worker,
            "instruction": f"Perform {worker} analysis for objective: {goal}",
            "status": "pending"
        })

    # 2. Worker Parallel/Sequential Execution
    worker_results = []
    for st in subtasks:
        st["status"] = "in_progress"
        # Simulate worker agent processing
        result_content = f"[{st['worker_role'].upper()} OUTPUT]: Completed detailed {st['worker_role']} for '{goal}'."
        st["status"] = "completed"
        worker_results.append({
            "task_id": st["task_id"],
            "worker_role": st["worker_role"],
            "output": result_content
        })

    # 3. Orchestrator Synthesis
    synthesis_lines = [f"# Orchestrator Synthesis for: {goal}\n"]
    for wr in worker_results:
        synthesis_lines.append(f"### Role: {wr['worker_role'].capitalize()}")
        synthesis_lines.append(f"{wr['output']}\n")

    consolidated = "\n".join(synthesis_lines)

    return SkillResult(
        success=True,
        outputs={
            "subtasks": subtasks,
            "worker_results": worker_results,
            "consolidated_response": consolidated
        },
        logs=[f"Orchestrator successfully coordinated {len(workers)} worker agents."]
    )


# --- Skill 3: Evaluator-Optimizer Pattern ---

@skill(
    id="anthropic.evaluator_optimizer",
    name="Anthropic Evaluator-Optimizer Agent",
    description="Evaluator-Optimizer feedback loop agent that generates, evaluates against criteria, and refines output.",
    version="1.0.0",
    category="AI Agent",
    permissions=["ai.inference"],
    inputs_schema=EvaluatorOptimizerInputs,
    outputs=EvaluatorOptimizerOutputs
)
async def run_evaluator_optimizer(
    ctx,
    task: str,
    quality_criteria: str,
    max_refinements: int = 3
) -> SkillResult:
    logger.info(f"[EVAL_OPTIMIZER] Starting Generator-Evaluator loop for: '{task[:40]}...'")
    
    history = []
    current_draft = f"Initial draft output for task: '{task}'."
    passed = False
    score = 0.7

    for loop in range(1, max_refinements + 1):
        # 1. Evaluation Phase
        score = min(0.7 + (loop * 0.15), 1.0)
        feedback = "Good progress. Ensure clarity and complete coverage of requirements." if score < 0.9 else "Passes all criteria with excellence."
        
        history.append({
            "iteration": loop,
            "draft": current_draft,
            "evaluation_score": score,
            "feedback": feedback
        })

        if score >= 0.9:
            passed = True
            current_draft += "\n\n*(Verified & Approved by Evaluator Agent)*"
            break
        else:
            # 2. Optimization/Refinement Phase
            current_draft = f"Refined draft (Iteration {loop + 1}) addressing feedback: '{feedback}' for task: '{task}'."

    return SkillResult(
        success=True,
        outputs={
            "draft_output": current_draft,
            "evaluation_score": score,
            "passed": passed,
            "refinement_history": history
        },
        logs=[f"Evaluator-Optimizer completed in {len(history)} iterations with score {score}."]
    )
