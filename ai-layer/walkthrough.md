# Myca Phase 2.3 Walkthrough — Execution OS SDK (Architecture Freeze)

Myca's architecture has been officially frozen (Architecture Freeze). The Runtime has been stripped of all specific business logic, tarayıcı, dosya sistemi ya da git gibi kavramlar Runtime çekirdeğinden tamamen temizlenmiştir. Her şey generic birer beceri (Skill) haline getirilmiş ve ortak **Skill ABI** üzerinden koşturulmaktadır.

## 1. Universal Skill ABI & Schemas (`abi.py`)
Beceriler artık katı girdi/çıktı şemalarına sahiptir. Girişler ve çıkışlar Pydantic şemaları ile tanımlanmaktadır:
- `SkillManifest` (v2): `id`, `version`, `permissions`, `traits`, `retry`, `timeout`, vb. içeren güncellenmiş OS Manifest yapısı.
- `ExecutionCost`: Çalışma öncesi `estimate()` ile kaynak tüketimini (GPU, CPU, RAM, Network, Latency) hesaplama şeması.
- `Artifact`: Standartlaştırılmış ilk sınıf işletim sistemi çıktı nesnesi (`id`, `type`, `mime`, `path`, `hash`, `size`, `preview`).
- `SkillEvent`: `Started`, `Progress`, `Log`, `Artifact`, `Warning`, `Recovery`, `Completed`, `Failed` olaylarını yöneten evrensel olay arayüzü.

## 2. Event-Driven DAG Scheduler (`execution_graph.py`)
Eski recursive `ctx.execute()` zincirleme yapısı kaldırılmış ve yerine asenkron (`asyncio.gather`) paralel çalışan, bağımlılıkları (dependencies) dinamik çözen gerçek bir DAG Zamanlayıcı yazılmıştır.
- Polling ve sleep mekanizmaları olmadan event-driven olarak çalışır.
- Bağımsız beceriler (örneğin A'yı bekleyen B ve C) eş zamanlı ve paralel olarak tetiklenir.
- Dependency çıktısı sonraki becerilere dinamik olarak enjekte edilir (örn: `"$A.html"`).

## 3. OS-Seviyesi Kurtarma Motoru (OS-Level Recovery Engine)
Beceriler artık hata yakalama ve kurtarma mantığı içermez. Hatalar OS seviyesine taşınmıştır:
1. **Retry (Tekrar Deneme):** Manifest içindeki `retry` değerine göre hata anında otomatik yeniden deneme yapılır.
2. **Alternative Skill Fallback:** Beceri başarısız olduğunda sistem otomatik olarak alternatif bir beceriyi (örn: `browser.search` yerine `core.chat`) devreye sokar.

## 4. Verification & Sonuçlar (`test_os_sdk.py`)
Yazılan test senaryolarıyla tüm OS SDK doğrulanmıştır:
- **Giriş Şeması Doğrulaması:** Eksik veya yanlış türde veri gönderildiğinde beceri çalışmadan önce Pydantic doğrulaması başarısız olur ve çalışmayı güvenle durdurur.
- **Universal Events:** Tüm beceriler standart `SKILL_STARTED`, `SKILL_PROGRESS`, `SKILL_ARTIFACT` ve `SKILL_COMPLETED` protokol olaylarını fırlatır.
- **Paralel Çalışma:** A nodu tamamlandığında B ve C nodları tamamen paralel olarak çalıştırılır.
- **Kurtarma Testi:** Geçici hatalarda 2 kez otomatik retry yapıldığı ve nihai başarısızlık durumunda alternatif beceri fallback'inin çalıştığı doğrulanmıştır.

`/query` API doğrulaması (Llama 3.2 3B Metal GPU Hızlandırması ile):
```json
{
  "response": "İyiyim, teşekkür ederim. Ne yapabilirsin?",
  "source": "executor_mesh",
  "latency_ms": 970.2279567718506,
  "node_used": "local_mesh"
}
```
**0.97 saniyelik** yanıt süresiyle fully-generic, type-safe OS çekirdeğimiz başarıyla mühürlenmiştir!
