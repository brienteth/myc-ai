import asyncio
import json
import logging
import subprocess
import shlex
import time
from typing import Dict, Any, List
from myca.skills.core.registry import SkillRegistry
from myca.skills.core.decorator import SkillDefinition
from myca.skills.core.abi import SkillManifest
from myca.skills.core.result import SkillResult
from pydantic import BaseModel, create_model
from .history import AutomationDB

logger = logging.getLogger("myca.automation.mcp")

class MCPClient:
    def __init__(self, server_id: str, command: str):
        self.server_id = server_id
        self.command = command
        self.process = None
        self.tools = []
        self.request_id = 0
        self.pending_requests = {}
        self.read_task = None
        self.is_connected = False

    async def connect(self):
        try:
            logger.info(f"[MCP CLIENT] Spawning server {self.server_id} with cmd: {self.command}")
            args = shlex.split(self.command)
            self.process = await asyncio.create_subprocess_exec(
                *args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            self.is_connected = True
            self.read_task = asyncio.create_task(self._read_loop())
            
            # Handshake
            init_res = await self._send_request("initialize", {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "myca-client", "version": "1.0.0"}
            })
            
            await self._send_notification("notifications/initialized", {})
            
            # Get Tools
            tools_res = await self._send_request("tools/list", {})
            self.tools = tools_res.get("tools", [])
            logger.info(f"[MCP CLIENT] Discovered {len(self.tools)} tools from {self.server_id}")
            return True
        except Exception as e:
            logger.error(f"[MCP CLIENT] Connection failed: {e}")
            await self.disconnect()
            raise e

    async def disconnect(self):
        self.is_connected = False
        if self.read_task:
            self.read_task.cancel()
            self.read_task = None
        if self.process:
            try:
                self.process.terminate()
                await self.process.wait()
            except Exception:
                pass
            self.process = None
        self.tools = []

    async def call_tool(self, tool_name: str, arguments: dict) -> dict:
        if not self.is_connected:
            raise RuntimeError(f"MCP Server {self.server_id} not connected.")
        res = await self._send_request("tools/call", {
            "name": tool_name,
            "arguments": arguments
        })
        return res

    async def _send_request(self, method: str, params: dict) -> dict:
        self.request_id += 1
        rid = self.request_id
        fut = asyncio.get_running_loop().create_future()
        self.pending_requests[rid] = fut
        
        payload = {
            "jsonrpc": "2.0",
            "id": rid,
            "method": method,
            "params": params
        }
        
        req_str = json.dumps(payload) + "\n"
        self.process.stdin.write(req_str.encode('utf-8'))
        await self.process.stdin.drain()
        
        try:
            return await asyncio.wait_for(fut, timeout=30.0)
        except asyncio.TimeoutError:
            self.pending_requests.pop(rid, None)
            raise TimeoutError(f"MCP Request {method} (id={rid}) timed out.")

    async def _send_notification(self, method: str, params: dict):
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        }
        req_str = json.dumps(payload) + "\n"
        self.process.stdin.write(req_str.encode('utf-8'))
        await self.process.stdin.drain()

    async def _read_loop(self):
        try:
            while self.is_connected:
                line = await self.process.stdout.readline()
                if not line:
                    break
                try:
                    msg_str = line.decode('utf-8').strip()
                    logger.debug(f"[MCP READ] {msg_str}")
                    # Skip empty lines or plain text output (e.g. npm/npx logs)
                    if not msg_str.startswith("{"):
                        continue
                    msg = json.loads(msg_str)
                    if "id" in msg:
                        rid = msg["id"]
                        if rid in self.pending_requests:
                            fut = self.pending_requests.pop(rid)
                            if "error" in msg:
                                fut.set_exception(Exception(msg["error"].get("message", "MCP JSON-RPC Error")))
                            else:
                                fut.set_result(msg.get("result", {}))
                except Exception as ex:
                    # Log but do not crash the loop for single malformed lines
                    logger.warning(f"[MCP READ] Ignored non-JSON line: {ex}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"[MCP READ LOOP ERROR] {e}")

class MCPManager:
    _instances: Dict[str, MCPClient] = {}

    @classmethod
    async def connect_server(cls, server_id: str, command: str):
        if server_id in cls._instances:
            await cls.disconnect_server(server_id)
            
        client = MCPClient(server_id, command)
        try:
            await client.connect()
            cls._instances[server_id] = client
            
            # Register tools
            for tool in client.tools:
                name = tool["name"]
                desc = tool.get("description", "")
                schema = tool.get("inputSchema", {})
                
                props = schema.get("properties", {})
                req = schema.get("required", [])
                
                field_defs = {}
                for p_name, p_val in props.items():
                    p_type = str
                    p_desc = p_val.get("description", "")
                    is_req = p_name in req
                    default = ... if is_req else None
                    field_defs[p_name] = (p_type, default)
                
                inputs_model = create_model(f"mcp_{server_id}_{name}_Inputs", **field_defs)
                
                # Dynamic call closure
                async def run_mcp_tool(ctx, s_id=server_id, t_name=name, **kwargs):
                    cli = cls._instances.get(s_id)
                    if not cli:
                        return SkillResult(success=False, logs=[f"MCP Server {s_id} is disconnected."])
                    try:
                        res = await cli.call_tool(t_name, kwargs)
                        content = res.get("content", [])
                        out_text = ""
                        for c in content:
                            if c.get("type") == "text":
                                out_text += c.get("text", "")
                        
                        is_err = res.get("isError", False)
                        return SkillResult(
                            success=not is_err,
                            outputs={"result": out_text},
                            logs=[f"MCP Tool {t_name} executed. Output: {out_text[:100]}..."]
                        )
                    except Exception as err:
                        return SkillResult(success=False, logs=[f"MCP Tool execution failed: {str(err)}"])
                
                manifest = SkillManifest(
                    id=f"mcp.{server_id}.{name}",
                    version="1.0.0",
                    description=desc,
                    category="mcp",
                    permissions=["network.out"]
                )
                
                definition = SkillDefinition(
                    manifest=manifest,
                    func=run_mcp_tool,
                    inputs_schema=inputs_model,
                    outputs_schema=create_model(f"mcp_{server_id}_{name}_Outputs", result=(str, None))
                )
                
                # Auto Register in registry
                SkillRegistry.register(definition)
                
            AutomationDB.update_mcp_status(server_id, "Connected", len(client.tools))
            logger.info(f"[MCP MANAGER] Saved server {server_id} to DB. Exposed {len(client.tools)} tools.")
        except Exception as e:
            AutomationDB.update_mcp_status(server_id, "Error", 0, str(e))
            logger.error(f"[MCP MANAGER] Error connecting to {server_id}: {e}")
            raise e

    @classmethod
    async def disconnect_server(cls, server_id: str):
        client = cls._instances.pop(server_id, None)
        if client:
            await client.disconnect()
            for tool in client.tools:
                t_id = f"mcp.{server_id}.{tool['name']}"
                SkillRegistry._skills.pop(t_id, None)
                
        AutomationDB.update_mcp_status(server_id, "Disconnected", 0)
        logger.info(f"[MCP MANAGER] Disconnected {server_id}")
