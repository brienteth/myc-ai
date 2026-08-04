import os
import requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Myca AI Layer", description="OpenAI-compatible local LLM provider")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Local Ollama endpoint
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    model: str
    messages: List[ChatMessage]
    stream: Optional[bool] = False
    temperature: Optional[float] = 0.7

@app.post("/v1/chat/completions")
async def chat_completions(req: ChatCompletionRequest):
    # Ensure there's a system prompt making it identify as Myca
    messages = []
    has_system = any(m.role == "system" for m in req.messages)
    
    if not has_system:
        messages.append({
            "role": "system", 
            "content": "Senin adın Myca. Sen yerel olarak (kullanıcının kendi cihazında) çalışan, son derece zeki, hızlı ve özel bir yapay zeka asistanısın. Asla başka bir şirket (Meta, OpenAI vb.) tarafından geliştirildiğini söyleme, kimliğini Myca olarak koru. Kullanıcıya her zaman yardımcı ol, saygılı ve net cevaplar ver."
        })
        
    messages.extend([{"role": m.role, "content": m.content} for m in req.messages])

    # Convert to Ollama format
    ollama_req = {
        "model": req.model,
        "messages": messages,
        "stream": req.stream,
        "options": {
            "temperature": req.temperature
        }
    }
    
    try:
        if req.stream:
            # Stream response back
            response = requests.post(f"{OLLAMA_URL}/api/chat", json=ollama_req, stream=True)
            response.raise_for_status()
            
            def stream_generator():
                for line in response.iter_lines():
                    if line:
                        # Parse Ollama format, convert to OpenAI SSE format
                        import json
                        try:
                            chunk = json.loads(line)
                            openai_chunk = {
                                "id": "chatcmpl-123",
                                "object": "chat.completion.chunk",
                                "created": 1677652288,
                                "model": req.model,
                                "choices": [{
                                    "index": 0,
                                    "delta": {
                                        "content": chunk.get("message", {}).get("content", "")
                                    },
                                    "finish_reason": "stop" if chunk.get("done") else None
                                }]
                            }
                            yield f"data: {json.dumps(openai_chunk)}\n\n"
                        except json.JSONDecodeError:
                            continue
                yield "data: [DONE]\n\n"
                
            return StreamingResponse(stream_generator(), media_type="text/event-stream")
            
        else:
            # Sync request
            response = requests.post(f"{OLLAMA_URL}/api/chat", json=ollama_req)
            response.raise_for_status()
            data = response.json()
            
            return {
                "id": "chatcmpl-123",
                "object": "chat.completion",
                "created": 1677652288,
                "model": req.model,
                "usage": {
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "total_tokens": 0
                },
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": data.get("message", {}).get("content", "")
                    },
                    "finish_reason": "stop",
                    "index": 0
                }]
            }
            
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error communicating with local model provider: {str(e)}")

@app.get("/v1/models")
async def list_models():
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags")
        response.raise_for_status()
        data = response.json()
        
        models = []
        for m in data.get("models", []):
            models.append({
                "id": m["name"],
                "object": "model",
                "created": 1677652288,
                "owned_by": "myca-local"
            })
            
        return {
            "object": "list",
            "data": models
        }
    except Exception:
        # Fallback if Ollama is not running
        return {
            "object": "list",
            "data": [
                {"id": "llama3", "object": "model", "owned_by": "myca-local"}
            ]
        }

@app.get("/health")
async def health():
    return {
        "node_id": "myca-local",
        "status": "ready",
        "uptime_s": 100,
        "peers_connected": 0,
        "backend": "ollama",
        "mode": "network",
        "latency_map": {}
    }

@app.get("/peers")
async def peers():
    return {
        "node_id": "myca-local",
        "peers": [],
        "total": 0
    }
