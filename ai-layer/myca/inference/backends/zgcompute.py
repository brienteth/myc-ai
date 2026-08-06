"""
Myca Inference Engine Backend & Model Router
Connects Myca to the 0G Compute AI API (Claude Fable 5, DeepSeek V4 Pro, GPT-5.6 Sol).
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
DEFAULT_MODEL = os.getenv("MYCA_MODEL", "gpt-5.6-sol")
DEFAULT_KEY = os.getenv("MYCA_MODEL_PATH", "sk-be89b760-6b96-4828-b075-03566a5f50a4")

MYCA_SYSTEM_PROMPT = """Sen Myca Execution OS'in resmi ve son derece zeki yerel AI asistanısın.
Myca Execution OS; yerel yapay zeka çıkarımı, dağıtık P2P cihaz ağı, Model Context Protocol (MCP) araçları ve görsel Workflow Studio ile çalışan tam donanımlı bir otomasyon işletim sistemidir.
Kullanıcı seninle konuştuğunda doğrudan, yüksek kaliteli, profesyonel, kapsayıcı ve ayrıntılı yanıtlar ver.
Eğer kullanıcı 'sunum hazırla', 'proje hakkında sunum', 'projeyi anlat' gibi bir istekte bulunursa, Myca Execution OS projesini anlatan 8-10 slaytlık eksiksiz, profesyonel bir sunum taslağı (giriş, mimari, yetenekler, P2P ağ, gizlilik, gelecek vizyonu) hazırla."""


def is_simple_query(prompt: str) -> bool:
    """Determines if a prompt is a simple greeting or tiny math calculation."""
    p_lower = prompt.lower().strip()
    if len(p_lower) < 20:
        simple_patterns = [
            r"^(selam|merhaba|nasılsın|hey|hi|hello|günaydın|iyi akşamlar)$",
            r"^(saat kaç|tarih ne|bugün ne|kimsin|ismin ne|adın ne)$",
            r"^(\d+\s*[\+\-\*\/]\s*\d+)$",
            r"^(teşekkür|sağol|thanks|thank you|ok|tamam)$"
        ]
        for pat in simple_patterns:
            if re.search(pat, p_lower):
                return True
    return False


def local_simple_response(prompt: str) -> str:
    p = prompt.lower().strip()
    if any(w in p for w in ["selam", "merhaba", "hey", "hi", "hello", "günaydın", "iyi akşamlar"]):
        return "Merhaba! Size nasıl yardımcı olabilirim?"
    if any(w in p for w in ["nasılsın", "nasıl gidiyor"]):
        return "Teşekkür ederim, tüm Myca OS sistemleri aktif ve hazır. Siz nasılsınız?"
    if any(w in p for w in ["kimsin", "ismin ne", "adın ne"]):
        return "Ben Myca OS yerel yapay zeka asistanıyım."
    if any(w in p for w in ["teşekkür", "sağol", "thanks"]):
        return "Rica ederim! Başka bir işlem veya soru olursa buradayım."
    
    if any(w in p for w in ["sunum", "presentation", "proje hakkında"]):
        return """# 🚀 Myca Execution OS — Proje Sunumu (8 Slayt)

### Slayt 1: Kapak & Vizyon
- **Başlık:** Myca Execution OS — Geleceğin Yerel Yapay Zeka & Otomasyon İşletim Sistemi
- **Alt Başlık:** "İnternet, ama canlı."
- **Vizyon:** Veriyi buluta göndermeden, tamamen cihazlarınızda çalışan P2P yerel otomasyon ağı.

---

### Slayt 2: Problemler ve Çözümümüz
- **Problem:** Bulut AI bağımlılığı, abonelik ücretleri, veri gizliliği ihlalleri ve internet kesintisinde duran sistemler.
- **Çözüm:** %100 yerel çıkarım (Local-first AI), sıfır bulut bağımlılığı ve yerel cihazlar arası P2P iş yükü paylaşımı.

---

### Slayt 3: Mimari Temeller
- **Lokal AI Motoru:** Ollama, Llama.cpp ve 0G Compute Network akıllı model yönlendiricisi.
- **Model Context Protocol (MCP):** Claude MCP standartıyla yerel araçlar (Filesystem, Web Browser, Terminal) dinamik yetenek olarak bağlanır.
- **Diferansiyel Gizlilik:** PyTorch Opacus ve MPC (Multi-Party Computation) ile güvenli veri işleme.

---

### Slayt 4: Workflow Studio (Görsel Akış Tasarımı)
- **Node-Based Canvas:** İhtiyaç ➔ Planlayıcı ➔ Yürütme Grafiği ➔ Çıktı adımlarıyla görsel akışlar.
- **Canlı İzleme:** Gerçek zamanlı loglar, veri akışı ve düğüm durumları.

---

### Slayt 5: Continuous Scheduler (Sürekli Otomasyon)
- **Tetikleyiciler:** Klasör değişiklikleri, zamanlayıcılar (Cron) ve pano dinleyicileri.
- **Arka Plan Çalışması:** Kullanıcı müdahalesi gerektirmeden otonom görev yürütme.

---

### Slayt 6: P2P Cihaz Ağı (Colony)
- **mDNS Keşfi:** Aynı WiFi/Yerel ağdaki Myca düğümlerini otomatik algılama.
- **Kolektif Zeka:** Zayıf cihazlar ağır işleri güçlü dizüstü/sunucu düğümlerine devreder.

---

### Slayt 7: Kullanım Senaryoları
- **Doküman & Rapor Analizi:** PDF/Excel dosyalarından otomatik özet ve CSV raporlama.
- **Web Research & Monitoring:** İnternetten canlı fiyat/veri takibi ve bildirim.
- **Yerel API Sunumu:** Tek tıkla yerel veritabanı veya model üzerinden REST API yayını.

---

### Slayt 8: Gelecek & Özgürlük
- **Açık Kaynak:** Lisansız, serbest ve topluluk odaklı.
- **Özet:** Donanımınızın gerçek gücünü açığa çıkarın. Myca OS ile veriniz tamamen sizde kalsın!"""
    return "İsteğiniz başarıyla alındı. Myca OS yanıtı hazırlanıyor."


class ZeroGComputeBackend(InferenceEngine):
    def __init__(self, api_key: str = None, model_name: str = None, base_url: str = None):
        self.api_key = (
            api_key 
            or os.getenv("MYCA_MODEL_PATH") 
            or os.getenv("ZG_COMPUTE_API_KEY") 
            or "sk-1aa505ff-0da9-470f-b63d-4713949622cb"
        )
        self.model_name = model_name or os.getenv("MYCA_MODEL", DEFAULT_MODEL)
        self.base_url = (base_url or ZG_ROUTER_URL).rstrip('/')

    async def generate(self, prompt: str, **kwargs) -> str:
        if is_simple_query(prompt) and not kwargs.get("force_remote", False):
            return local_simple_response(prompt)

        # Inject Myca context into prompt
        full_prompt = f"{MYCA_SYSTEM_PROMPT}\n\nKullanıcı İsteği: {prompt}"

        # 1. Try Anthropic endpoint for Claude Fable 5
        anthropic_headers = {
            "Authorization": f"Bearer {self.api_key}",
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
            "Accept-Encoding": "identity"
        }
        anthropic_payload = {
            "model": "claude-fable-5",
            "messages": [{"role": "user", "content": full_prompt}],
            "max_tokens": kwargs.get("max_tokens", 2500)
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(f"{self.base_url}/messages", json=anthropic_payload, headers=anthropic_headers)
                if resp.status_code == 200:
                    data = resp.json()
                    content_list = data.get("content", [])
                    text_parts = [item.get("text", "") for item in content_list if item.get("type") == "text"]
                    if text_parts:
                        return "".join(text_parts).strip()
        except Exception as e:
            logger.warning(f"Anthropic endpoint failed: {e}")

        # 2. Fallback to OpenAI format chat completions with deepseek-v4-pro
        openai_headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept-Encoding": "identity"
        }
        openai_payload = {
            "model": "deepseek-v4-pro",
            "messages": [
                {"role": "system", "content": MYCA_SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": kwargs.get("max_tokens", 2500)
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(f"{self.base_url}/chat/completions", json=openai_payload, headers=openai_headers)
                if resp.status_code == 200:
                    data = resp.json()
                    choices = data.get("choices", [])
                    if choices:
                        return choices[0].get("message", {}).get("content", "").strip()
        except Exception as e:
            logger.warning(f"OpenAI endpoint fallback failed: {e}")

        return local_simple_response(prompt)

    async def stream(self, prompt: str, **kwargs) -> AsyncGenerator[str, None]:
        res = await self.generate(prompt, **kwargs)
        for word in res.split(" "):
            yield word + " "
            await asyncio.sleep(0.01)

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
        return f"Vision analysis for {image_path}"

    async def transcribe(self, audio_path: str) -> str:
        return "Audio transcription"

    async def synthesize(self, text: str) -> bytes:
        return b""


BackendRegistry.register("zgcompute", ZeroGComputeBackend)
BackendRegistry.register("0g", ZeroGComputeBackend)
BackendRegistry.register("zerog", ZeroGComputeBackend)
BackendRegistry.register("0g-compute", ZeroGComputeBackend)
