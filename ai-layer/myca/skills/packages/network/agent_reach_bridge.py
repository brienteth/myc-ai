"""
MYCA Agent-Reach Host Bridge Skill Package
Detects host system agent-reach installation (`agent-reach doctor`), checks channel status,
and routes requests to agent-reach CLI when available.
"""
import logging
import asyncio
import shutil
from pydantic import BaseModel, Field
from myca.skills.core.decorator import skill
from myca.skills.core.result import SkillResult

logger = logging.getLogger("myca.skills.agent_reach_bridge")

class AgentReachDoctorInputs(BaseModel):
    verbose: bool = Field(default=False, description="Whether to include full detailed output from agent-reach doctor")

class AgentReachDoctorOutputs(BaseModel):
    installed: bool = Field(description="Whether agent-reach CLI is installed on host system")
    doctor_output: str = Field(description="Health diagnostic output from agent-reach doctor")

class AgentReachRouteInputs(BaseModel):
    channel: str = Field(description="Target platform channel: 'twitter', 'reddit', 'bilibili', 'xiaohongshu', 'github', 'youtube'")
    action: str = Field(description="Action/query string e.g. 'search LLM', 'view owner/repo', 'read URL'")

class AgentReachRouteOutputs(BaseModel):
    channel: str
    command_executed: str
    output: str

@skill(
    id="agent_reach.doctor",
    name="Agent-Reach Health Check",
    description="Checks if agent-reach CLI is installed and returns health status of all channels.",
    version="1.0.0",
    category="Network",
    permissions=["network.out"],
    inputs_schema=AgentReachDoctorInputs,
    outputs=AgentReachDoctorOutputs
)
async def agent_reach_doctor(ctx, verbose: bool = False) -> SkillResult:
    logger.info("[AGENT_REACH] Running agent-reach doctor health check...")
    
    agent_reach_path = shutil.which("agent-reach")
    installed = bool(agent_reach_path)
    
    if not installed:
        return SkillResult(
            success=True,
            outputs={
                "installed": False,
                "doctor_output": "agent-reach CLI is not installed on the host system. MYCA native skills (web.read, github.read, youtube.transcript, rss.read, twitter.read) are active and handling requests."
            },
            logs=["agent-reach CLI not found. MYCA native zero-config skills active."]
        )

    try:
        proc = await asyncio.create_subprocess_exec(
            "agent-reach", "doctor",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        doctor_output = stdout.decode("utf-8") if stdout else stderr.decode("utf-8")
        
        return SkillResult(
            success=True,
            outputs={
                "installed": True,
                "doctor_output": doctor_output
            },
            logs=["Successfully executed agent-reach doctor on host system."]
        )
    except Exception as e:
        logger.error(f"[AGENT_REACH] Error running agent-reach doctor: {e}")
        return SkillResult(
            success=False,
            logs=[f"Failed to run agent-reach doctor: {str(e)}"]
        )

@skill(
    id="agent_reach.route",
    name="Agent-Reach Router",
    description="Routes queries through agent-reach CLI on host system if available.",
    version="1.0.0",
    category="Network",
    permissions=["network.out"],
    inputs_schema=AgentReachRouteInputs,
    outputs=AgentReachRouteOutputs
)
async def agent_reach_route(ctx, channel: str, action: str) -> SkillResult:
    agent_reach_path = shutil.which("agent-reach")
    if not agent_reach_path:
        return SkillResult(
            success=False,
            logs=["agent-reach CLI is not installed. Use native MYCA skills (web.read, github.read, twitter.read) instead."]
        )
    
    cmd_args = ["agent-reach", channel, action]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd_args,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        output = stdout.decode("utf-8") if stdout else stderr.decode("utf-8")
        
        return SkillResult(
            success=True,
            outputs={
                "channel": channel,
                "command_executed": " ".join(cmd_args),
                "output": output[:20000]
            },
            logs=[f"Successfully routed command via agent-reach CLI for channel '{channel}'"]
        )
    except Exception as e:
        return SkillResult(
            success=False,
            logs=[f"Error executing agent-reach command for channel '{channel}': {str(e)}"]
        )
