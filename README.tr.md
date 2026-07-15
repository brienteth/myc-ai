<p align="center">
  <img src="hero.png" alt="Myca - İnternet, ama canlı." width="100%" />
</p>

<p align="center">
  <a href="README.md">English</a> · <strong>Türkçe</strong> · <a href="README.zh.md">中文</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/brienteth/myc-ai?style=flat-square&color=00e87a" alt="GitHub stars" />
  <img src="https://img.shields.io/github/license/brienteth/myc-ai?style=flat-square&color=5a5a6e" alt="Lisans" />
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-00e87a?style=flat-square" alt="Platform Desteği" />
  <img src="https://img.shields.io/discord/1234567890?style=flat-square&color=5a5a6e&label=discord" alt="Discord Üyeleri" />
</p>

<p align="center">
  <a href="#başlangıç">Başlangıç</a> · 
  <a href="#dokümantasyon">Dokümantasyon</a> · 
  <a href="docs/MYCA_V2_MANIFESTO.md">Teknik Rapor (Whitepaper)</a> · 
  <a href="https://discord.gg/placeholder">Discord</a> · 
  <a href="CHANGELOG.md">Değişiklik Günlüğü</a>
</p>

---

### myc, cihazlarınızda çalışan, araçları güvenli bir şekilde birbirine bağlayan ve verilerinizi gizli tutan açık kaynaklı, yerel öncelikli (Local-first) bir Yapay Zeka Otomasyon İşletim Sistemidir.

<p align="center">
  <em>Yerel çıkarım (Local inference). Model Context Protocol (MCP) desteği. Bulut yok. Abonelik yok.</em>
</p>

---

## Temel Özellikler

- **Workflow Studio:** Canlı günlükler (logs) ve görsel durum takibi ile yapay zeka akışları (İhtiyaç ➔ Planlayıcı ➔ Yürütme Grafiği ➔ Tamamlandı) tasarlamak için yerleşik düğüm tuvali.
- **Model Context Protocol (MCP):** Harici araçları dinamik yapay zeka yetenekleri olarak kaydetmek için Claude açık kaynaklı MCP sunucularını (stdio veya SSE üzerinden) doğrudan bağlayın.
- **Sürekli Zamanlayıcı (Scheduler):** Arka planda klasör değişiklikleri, zaman aralıkları ve pano (clipboard) değişiklikleri gibi sistem tetikleyicilerini sürekli izler.
- **Secrets Vault (Kasa):** Yerel API anahtarlarını, bot tokenlarını ve veritabanı şifrelerini güvenli bir şekilde saklayın.
- **Yürütme Kontrolü:** Aktif çalışan işlerin gerçek zamanlı izlenmesi ve anında iptal/durdurma işlemleri.

## İndirmeler

| Platform | İndirme Linki |
|---|---|
| **macOS** (Apple Silicon) | [Myca-macOS.dmg](https://github.com/brienteth/myc-ai/releases/latest/download/Myca-macOS.dmg) |
| **macOS** (Intel / Universal) | [Myca-macOS.zip](https://github.com/brienteth/myc-ai/releases/latest/download/Myca-macOS.zip) |
| **Windows** | [Myca-Windows.zip](https://github.com/brienteth/myc-ai/releases/latest/download/Myca-Windows.zip) |
| **Linux** | [Myca-Linux.zip](https://github.com/brienteth/myc-ai/releases/latest/download/Myca-Linux.zip) |

---

## Onu farklı kılan nedir?

| | myc | ChatGPT | Jan |
|---|---|---|---|
| **Yerel çalışır** | ✓ | ✗ | ✓ |
| **Hesap gerekmez** | ✓ | ✗ | ✓ |
| **P2P cihaz paylaşımı** | ✓ | ✗ | ✗ |
| **Çevrimdışı çalışır** | ✓ | ✗ | ✓ |
| **Sonsuza kadar ücretsiz** | ✓ | ✗ | ✓ |
| **Ağ ile büyür** | ✓ | ✗ | ✗ |
| **Açık kaynaklı** | ✓ | ✗ | ✓ |

---

## Nasıl çalışır?

**1. Yakındaki cihazları bulur**  
mDNS, ağınızdaki diğer myc örneklerini otomatik olarak keşfeder. Sıfır yapılandırma.

**2. Doğrudan bağlanır**  
WebRTC DataChannel. Arada sunucu yoktur. Verileriniz yerel kalır.

**3. İş yükünü paylaşır**  
Zayıf bir telefon + güçlü bir laptop = birlikte daha iyi bir model. Cihaz sayısı arttıkça ağ daha akıllı hale gelir.

---

## Bilimsel Altyapı

Verinin hesaplamaya değil, hesaplamanın veriye yöneldiği Niyet-Doğal (Intent-Native) bir internet inşa ediyoruz.  
Tüm araştırma detaylarını [MYCA_V2_MANIFESTO.md](docs/MYCA_V2_MANIFESTO.md) dosyasından okuyabilirsiniz.

---

## Başlangıç

```bash
# macOS
brew install myc
myc start

# veya kaynaktan derleyin
git clone https://github.com/brienteth/myc-ai
cd myc-ai/ai-layer
pip install -r requirements.txt
python main.py
```

### Masaüstü Uygulamasını Derleme (Electron)

Yerel masaüstü istemcisini geliştirme modunda çalıştırmak veya bağımsız bir üretim yükleyicisi (macOS için `.dmg`, Windows için `.exe`) derlemek için:

```bash
cd desktop
npm install

# Uygulamayı geliştirme modunda yerel olarak çalıştırın
npm run electron:start

# Bağımsız yükleyici paketini derleyin (.dmg / .exe)
npm run electron:build
```

Bağımsız yükleyiciler `desktop/release/` dizini altında oluşturulacaktır.

---

## Sistem Gereksinimleri

| İşletim Sistemi | Minimum | Önerilen |
|---|---|---|
| **macOS** | 13.6+, 8GB RAM | Apple Silicon, 16GB |
| **Windows** | 10+, 8GB RAM | NVIDIA GPU, 16GB |
| **Linux** | Ubuntu 22.04+, 8GB | CUDA GPU, 16GB |

---

## Katkıda Bulunma

Araştırmacıları, mühendisleri ve eleştirmenleri aramızda görmekten mutluluk duyarız. Başlamak için [CONTRIBUTING.md](CONTRIBUTING.md) dosyamızı okuyun.

---

## Bağlantılar

- [Dokümantasyon](https://docs.myc.ai)
- [Teknik Rapor (Whitepaper)](docs/MYCA_V2_MANIFESTO.md)
- [Discord](https://discord.gg/placeholder)
- [X/Twitter](https://x.com/myc_ai)

---

## Lisans

Bu proje [MIT Lisansı](LICENSE) altında lisanslanmıştır.

---

## Teşekkürler

myc aşağıdaki açık kaynaklı yapı taşları üzerine inşa edilmiştir:
- [llama.cpp](https://github.com/ggerganov/llama.cpp) (çıkarım motoru)
- [sentence-transformers](https://github.com/UKPLab/sentence-transformers) (anlamsal önbellek)
- [zeroconf](https://github.com/python-zeroconf/python-zeroconf) (mDNS keşfi)
- [aiortc](https://github.com/aiortc/aiortc) (WebRTC iletişimi)
