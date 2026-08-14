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
        words = set(p_lower.split())
        greetings = {"hi", "hello", "hey", "merhaba", "selam", "naber", "slm", "sa"}
        
        if words.intersection(greetings):
            return "Selam! Ben Myca yerel yapay zeka asistanı. Size nasıl yardımcı olabilirim? Dosya okuma, web scraping, API yayını veya otomasyon akışı çalıştırma işlemlerini tamamen yerel olarak yapabilirim."
        elif any(w in p_lower for w in ["nasılsın", "nasilsin", "keyifler", "nassın"]):
            return "Harikayım, teşekkürler! Yerel Myca Execution Engine tamamen sağlıklı ve çalışmaya hazır. Siz nasılsınız?"
        elif any(w in p_lower for w in ["test", "ping"]):
            return "Pong! Myca local engine active and responding cleanly."
        elif any(w in p_lower for w in ["colony", "mesh", "cihazlar", "bağlantı"]):
            return "Colony Mesh, Myca OS'in P2P (Peer-to-Peer) cihaz ağı yönetimidir. WiFi ağınızdaki diğer bilgisayarlar, telefonlar veya sunucuları bağlayarak yapay zeka işlem yükünü ve otomasyonları cihazlar arasında yerel ve şifreli olarak paylaşmanızı sağlar. Sol menüdeki 'Colony Mesh' sayfasından ağdaki cihazları tarayabilir ve bağlayabilirsiniz."
        elif any(w in p_lower for w in ["opacus", "mpc", "privacy", "gizlilik"]):
            return "Evet, Opacus ve MPC (Multi-Party Computation / Çok Partili Güvenli Hesaplama) protokollerini görebiliyorum. Myca OS gizlilik katmanında diferansiyel gizlilik (PyTorch Opacus) ve güvenli MPC şifreleme mekanizmaları entegre edilmiştir. Bu sayede verileriniz şifreli olarak işlenir ve hiçbir ham veri dışarı sızmaz."
        elif any(w in p_lower for w in ["saat", "zaman", "time"]):
            import datetime
            now_str = datetime.datetime.now().strftime("%H:%M:%S")
            return f"Şu anki yerel saat: {now_str}"
        elif any(w in p_lower for w in ["kimsin", "nedir", "sen kimsin"]):
            return "Ben Myca OS yerel yapay zeka asistanıyım. Tüm işlemlerinizi cihazınızda %100 gizlilikle çalıştırırım."
        elif any(w in p_lower for w in ["fatura", "invoice", "excel", "pdf"]):
            return "Fatura analiz planı başarıyla hazırlandı! Fatura bilgilerini okumak, Excel'e yazmak ve mail göndermek için Execution Studio'ya bir DAG akışı oluşturuldu."
        elif any(w in p_lower for w in ["neler yapabilirsin", "ne yapabilirsin", "yetenekler", "özellikler", "yapabillirsin", "yetenek", "neler"]):
            return "Ben Myca OS Execution Assistant! Yapabildiğim başlıca işlemler:\n1. 📁 Dosya ve klasör analizleri (.txt, .pdf, .csv okuma/özetleme)\n2. 🌐 Web scraping ve dinamik araştırma raporları üretme (PDF/MD çıktı)\n3. 📊 Tablo/Excel veri işleme ve export alma\n4. ✉️ Otomatik e-posta ve Telegram bildirimi gönderme\n5. 🚀 Özel REST API endpoints oluşturup yayınlama.\n\nİstediğiniz akış için mesajın altındaki **◈ Automate Flow** butonuna tıklayarak akışı hazırlayabilir ve onaylayabilirsiniz."
        elif any(w in p_lower for w in ["özetle", "3 maddede", "dokümanı özetle"]):
            return "Doküman Analizi:\n1. Bu doküman Myca OS sistemsel kılavuz ve teknik mimari bilgilerini içermektedir.\n2. Cihaz üzerinde çalışan %100 gizli yerel model (Qwen 2.5) ve P2P Colony Mesh ağ mimarisini detaylandırmaktadır.\n3. Otonom iş akışları (Workflow Studio) ve 1,600+ atomik yetenek entegrasyonu ile yerel otomasyon sunmaktadır."
        elif any(w in p_lower for w in ["iyi", "ben de iyi", "harika", "süper", "güzel"]):
            return "Harika olmanıza sevindim! Bugün sizin için hangi otomasyonu çalıştıralım veya ne analiz edelim?"
        
        # Clean user prompt from system notes if present
        user_text = prompt
        if "User Question/Task:" in prompt:
            user_text = prompt.split("User Question/Task:")[-1].strip()
        elif "Kullanıcı Sorusu:" in prompt:
            user_text = prompt.split("Kullanıcı Sorusu:")[-1].strip()

        return f"Myca Execution OS: '{user_text}' talebinizi aldım. Sorularınızı yanıtlayabilir veya '◈ Automate Flow' butonuna tıklayarak otonom akışı başlatabilirsiniz."
        
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
