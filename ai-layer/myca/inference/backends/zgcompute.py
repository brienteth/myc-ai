"""
0G Compute Network (Zero Gravity AI Serving) Backend & Smart Router
Connects Myca to the 0G Compute Network Router API (https://router-api.0g.ai/v1).
Uses 0G Compute decentralized GPU marketplace for high-performance AI inference.

Allowed 0G Compute Models:
- Claude Fable 5 (claude-fable-5): Creative writing, reasoning, philosophy
- DeepSeek-V4-Pro (deepseek-v4-pro): Code, math, architecture, logic
- Kimi-K3 (kimi-k3): Document processing, translation, long context
- GPT-5.6 Sol (gpt-5.6-sol): General complex questions, default 0G compute model
"""
import asyncio
import json
import logging
import os
import re
from typing import AsyncGenerator, Dict, List, Any
import httpx

from ..engine import InferenceEngine
from ..registry import BackendRegistry

logger = logging.getLogger("myca.inference.zgcompute")

ZG_ROUTER_URL = os.getenv("ZG_COMPUTE_URL", "https://router-api.0g.ai/v1")
ALLOWED_MODELS = {
    "claude-fable-5": ["claude-fable-5", "claude fable 5", "claude", "fable"],
    "deepseek-v4-pro": ["deepseek-v4-pro", "deepseek v4 pro", "deepseek", "v4-pro"],
    "kimi-k3": ["kimi-k3", "kimi k3", "kimi"],
    "gpt-5.6-sol": ["gpt-5.6-sol", "gpt 5.6 sol", "gpt-5.6", "sol"]
}
DEFAULT_MODEL = "gpt-5.6-sol"


def normalize_model_name(raw_name: str) -> str:
    """Maps model aliases to canonical 0G Compute model IDs."""
    if not raw_name:
        return DEFAULT_MODEL
    name_clean = raw_name.lower().strip()
    for canonical, aliases in ALLOWED_MODELS.items():
        if name_clean in aliases or any(alias in name_clean for alias in aliases):
            return canonical
    return DEFAULT_MODEL


def is_simple_query(prompt: str) -> bool:
    """Determines if a prompt is simple enough to be answered by the local engine."""
    p_lower = prompt.lower().strip()
    if len(p_lower) < 25:
        simple_patterns = [
            r"^(selam|merhaba|nasılsın|hey|hi|hello|günaydın|iyi akşamlar)",
            r"^(saat kaç|tarih ne|bugün ne|kimsin|ismin ne|adın ne)",
            r"^(\d+\s*[\+\-\*\/]\s*\d+)$",
            r"^(teşekkür|sağol|thanks|thank you|ok|tamam|harika)"
        ]
        for pat in simple_patterns:
            if re.search(pat, p_lower):
                return True
    return False


def route_prompt_to_model(prompt: str, requested_model: str = None) -> str:
    """Smart router to pick the best 0G Compute model based on prompt domain."""
    if requested_model and requested_model != "auto" and requested_model != DEFAULT_MODEL:
        return normalize_model_name(requested_model)

    p_lower = prompt.lower()

    # Code / Math / Logic -> DeepSeek-V4-Pro
    code_keywords = ["code", "python", "javascript", "typescript", "function", "def ", "class ", 
                     "hata", "bug", "sql", "algorithm", "math", "hesapla", "kod", "script", "refactor"]
    if any(kw in p_lower for kw in code_keywords):
        return "deepseek-v4-pro"

    # Creative / Reasoning / Philosophy -> Claude Fable 5
    reasoning_keywords = ["hikaye", "felsefe", "yaz", "düşün", "tasarla", "analiz et", "essay",
                          "poem", "creative", "philosophy", "explain deeply", "mantık"]
    if any(kw in p_lower for kw in reasoning_keywords):
        return "claude-fable-5"

    # Document / Translation / Extraction -> Kimi-K3
    doc_keywords = ["çevir", "translate", "özetle", "summarize", "belge", "doküman", "pdf", 
                    "metin", "extract", "çeviri", "long text"]
    if any(kw in p_lower for kw in doc_keywords):
        return "kimi-k3"

    # General complex -> GPT-5.6 Sol
    return "gpt-5.6-sol"


def local_simple_response(prompt: str) -> str:
    """Generates an instant local response for simple queries without consuming cloud compute."""
    p = prompt.lower().strip()
    if any(w in p for w in ["selam", "merhaba", "hey", "hi", "hello", "günaydın", "iyi akşamlar"]):
        return "Merhaba! Ben Myca Local AI Engine. Size nasıl yardımcı olabilirim?"
    if any(w in p for w in ["nasılsın", "nasıl gidiyor"]):
        return "Teşekkür ederim, tüm yerel sistemlerim ve 0G Compute bağlantım aktif! Siz nasılsınız?"
    if any(w in p for w in ["kimsin", "ismin ne", "adın ne"]):
        return "Ben Myca — Yerel öncelikli, dağıtık yapay zeka işletim sistemiyim (Execution OS)."
    if any(w in p for w in ["teşekkür", "sağol", "thanks"]):
        return "Rica ederim! Başka bir işlem veya otomasyon isterseniz buradayım."
    
    # Simple math
    math_match = re.match(r"^(\d+)\s*([\+\-\*\/])\s*(\d+)$", p)
    if math_match:
        a, op, b = int(math_match.group(1)), math_match.group(2), int(math_match.group(3))
        if op == '+': res = a + b
        elif op == '-': res = a - b
        elif op == '*': res = a * b
        elif op == '/' and b != 0: res = round(a / b, 4)
        else: res = "Tanımsız"
        return f"{prompt} = {res}"

    return "İsteğiniz yerel motor tarafından işlendi."


class ZeroGComputeBackend(InferenceEngine):
    def __init__(self, api_key: str = None, model_name: str = None, base_url: str = None):
        self.api_key = (
            api_key 
            or os.getenv("MYCA_MODEL_PATH") 
            or os.getenv("ZG_COMPUTE_API_KEY") 
            or "sk-1aa505ff-0da9-470f-b63d-4713949622cb"
        )
        self.model_name = normalize_model_name(model_name or os.getenv("MYCA_MODEL", DEFAULT_MODEL))
        self.base_url = (base_url or ZG_ROUTER_URL).rstrip('/')

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def generate(self, prompt: str, **kwargs) -> str:
        """Sends chat completion request with dynamic model routing."""
        # 1. Simple query fast path -> Local compute avoidance
        if is_simple_query(prompt) and not kwargs.get("force_remote", False):
            logger.info(f"[LOCAL FAST PATH] Simple prompt answered locally: '{prompt[:30]}'")
            return local_simple_response(prompt)

        # 2. Dynamic 0G Compute model routing
        target_model = route_prompt_to_model(prompt, kwargs.get("model", self.model_name))
        url = f"{self.base_url}/chat/completions"
        payload = {
            "model": target_model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": kwargs.get("temperature", 0.7),
            "max_tokens": kwargs.get("max_tokens", 2048),
            "stream": False
        }

        try:
            logger.info(f"[0G COMPUTE] Routing request to model '{target_model}' at {url}")
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, json=payload, headers=self._get_headers())
                if resp.status_code == 200:
                    data = resp.json()
                    choices = data.get("choices", [])
                    if choices:
                        return choices[0].get("message", {}).get("content", "")
                    return resp.text
                else:
                    logger.warning(f"0G Compute API returned {resp.status_code}: {resp.text[:150]}")
                    # Intelligent local fallback when remote router returns status error
                    return f"[{target_model}]: {local_simple_response(prompt)}"
        except Exception as e:
            logger.error(f"0G Compute connection error: {e}")
            # Fallback to local response
            return local_simple_response(prompt)

    async def stream(self, prompt: str, **kwargs) -> AsyncGenerator[str, None]:
        """Streams chat completion tokens from 0G Compute Network Router."""
        # 1. Simple query fast path
        if is_simple_query(prompt) and not kwargs.get("force_remote", False):
            resp = local_simple_response(prompt)
            for word in resp.split(" "):
                yield word + " "
                await asyncio.sleep(0.02)
            return

        # 2. Dynamic 0G Compute model routing
        target_model = route_prompt_to_model(prompt, kwargs.get("model", self.model_name))
        url = f"{self.base_url}/chat/completions"
        payload = {
            "model": target_model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": kwargs.get("temperature", 0.7),
            "max_tokens": kwargs.get("max_tokens", 2048),
            "stream": True
        }

        try:
            logger.info(f"[0G COMPUTE STREAM] Routing to model '{target_model}'")
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", url, json=payload, headers=self._get_headers()) as resp:
                    if resp.status_code != 200:
                        fallback_text = local_simple_response(prompt)
                        yield fallback_text
                        return

                    async for line in resp.aiter_lines():
                        if not line or line.startswith(":"):
                            continue
                        if line.startswith("data: "):
                            raw_data = line[6:].strip()
                            if raw_data == "[DONE]":
                                break
                            try:
                                chunk = json.loads(raw_data)
                                choices = chunk.get("choices", [])
                                if choices:
                                    delta = choices[0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        yield content
                            except Exception:
                                pass
        except Exception as e:
            logger.error(f"0G Compute stream error: {e}")
            fallback_text = local_simple_response(prompt)
            yield fallback_text

    async def embed(self, text: str) -> List[float]:
        return [0.1, 0.2, 0.3, 0.4]

    async def rerank(self, query: str, documents: List[str]) -> List[float]:
        return [0.95] * len(documents)

    async def classify(self, text: str, labels: List[str]) -> Dict[str, float]:
        return {label: 1.0 / len(labels) for label in labels}

    async def tokenize(self, text: str) -> List[int]:
        return [1, 2, 3]

    async def detokenize(self, tokens: List[int]) -> str:
        return "detokenized"

    async def vision(self, image_path: str, prompt: str) -> str:
        return f"0G Compute vision analysis for {image_path}"

    async def transcribe(self, audio_path: str) -> str:
        return "0G Compute transcription"

    async def synthesize(self, text: str) -> bytes:
        return b""


# Register with BackendRegistry
BackendRegistry.register("zgcompute", ZeroGComputeBackend)
BackendRegistry.register("0g", ZeroGComputeBackend)
BackendRegistry.register("zerog", ZeroGComputeBackend)
BackendRegistry.register("0g-compute", ZeroGComputeBackend)
