"""
Mock Backend
Simulates the Unified Inference API without loading heavy models.
"""
import asyncio
from typing import AsyncGenerator, Dict, List
from ..engine import InferenceEngine
from ..registry import BackendRegistry

class MockBackend(InferenceEngine):
    async def generate(self, prompt: str, **kwargs) -> str:
        p_lower = prompt.lower().strip()
        if p_lower in ["hi", "hello", "hey", "merhaba", "selam", "naber", "slm", "sa"]:
            return "Selam! Ben Myca yerel yapay zeka asistanı. Size nasıl yardımcı olabilirim? Dosya okuma, web scraping, API yayını veya otomasyon akışı çalıştırma işlemlerini tamamen yerel olarak yapabilirim."
        elif p_lower in ["nasılsın", "nasilsin", "keyifler nasıl", "keyifler nasil"]:
            return "Harikayım, teşekkürler! Yerel Myca Execution Engine tamamen sağlıklı ve çalışmaya hazır. Siz nasılsınız?"
        elif p_lower in ["test", "ping"]:
            return "Pong! Myca local engine active and responding cleanly."
        elif "opacus" in p_lower or "mpc" in p_lower or "privacy" in p_lower or "gizlilik" in p_lower:
            return "Evet, Opacus ve MPC (Multi-Party Computation / Çok Partili Güvenli Hesaplama) protokollerini görebiliyorum. Myca OS gizlilik katmanında diferansiyel gizlilik (PyTorch Opacus) ve güvenli MPC şifreleme mekanizmaları entegre edilmiştir. Bu sayede verileriniz şifreli olarak işlenir ve hiçbir ham veri dışarı sızmaz."
        elif "saat" in p_lower or "zaman" in p_lower:
            import datetime
            now_str = datetime.datetime.now().strftime("%H:%M:%S")
            return f"Şu anki yerel saat: {now_str}"
        elif "kimsin" in p_lower or "nedir" in p_lower:
            return "Ben Myca OS yerel yapay zeka asistanıyım. Tüm işlemlerinizi cihazınızda %100 gizlilikle çalıştırırım."
        elif "fatura" in p_lower or "invoice" in p_lower or "excel" in p_lower or "pdf" in p_lower:
            return "Fatura analiz planı başarıyla hazırlandı! Fatura bilgilerini okumak, Excel'e yazmak ve mail göndermek için Execution Studio'ya bir DAG akışı oluşturuldu."
        elif any(w in p_lower for w in ["neler yapabilirsin", "ne yapabilirsin", "yetenekler", "özellikler", "neler yapabiliyorsun"]):
            return "Ben Myca OS Execution Assistant! Yapabildiğim başlıca işlemler:\n1. 📁 Dosya ve klasör analizleri (.txt, .pdf, .csv okuma/özetleme)\n2. 🌐 Web scraping ve dinamik araştırma raporları üretme (PDF/MD çıktı)\n3. 📊 Tablo/Excel veri işleme ve export alma\n4. ✉️ Otomatik e-posta ve Telegram bildirimi gönderme\n5. 🚀 Özel REST API endpoints oluşturup yayınlama."
        elif any(w in p_lower for w in ["iyi", "ben de iyi", "harika", "süper", "güzel"]):
            return "Harika olmanıza sevindim! Bugün sizin için hangi otomasyonu çalıştıralım veya ne analiz edelim?"
        return f"Sorunuzu/isteğinizi aldım. Myca Execution OS ile '{prompt}' konusu üzerinde çalışmaya hazırım. Lütfen detay verin veya yapmak istediğiniz otomasyonu söyleyin."
        
    async def stream(self, prompt: str, **kwargs) -> AsyncGenerator[str, None]:
        res = await self.generate(prompt, **kwargs)
        for word in res.split(" "):
            await asyncio.sleep(0.03)
            yield word + " "
            
    async def embed(self, text: str) -> List[float]:
        return [0.1, 0.2, 0.3, 0.4]
        
    async def rerank(self, query: str, documents: List[str]) -> List[float]:
        return [0.9] * len(documents)
        
    async def classify(self, text: str, labels: List[str]) -> Dict[str, float]:
        return {label: 1.0 / len(labels) for label in labels}
        
    async def tokenize(self, text: str) -> List[int]:
        return [1, 2, 3]
        
    async def detokenize(self, tokens: List[int]) -> str:
        return "mock detokenized text"
        
    async def vision(self, image_path: str, prompt: str) -> str:
        return "mock vision analysis"
        
    async def transcribe(self, audio_path: str) -> str:
        return "mock transcription"
        
    async def synthesize(self, text: str) -> bytes:
        return b"mock audio data"

BackendRegistry.register("mock", MockBackend)
