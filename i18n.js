// Global Myca Network Bilingual Translation Engine (Default: EN, Secondary: TR)
(function() {
  const translations = {
    en: {
      nav_hub: "🌐 Hub",
      nav_explorer: "🧭 Explorer",
      nav_depin: "🤖 DePIN",
      nav_agent: "🧠 AI Colony",
      nav_build: "🛠️ Build",
      
      nav_docs: "📚 Docs",
      nav_faucet: "🎁 Faucet",

      // DePIN Workbench
      depin_tag: "LAYER 0 & 1 • PHYSICAL MACHINE DEPIN • CHAIN ID 108",
      depin_title: "Rhizome DePIN — Bio-Industrial Machine Fleet & Silicon PUF Sentinel",
      depin_desc: "Industrial microcontrollers (RP2350, STM32H5), wind turbines, cryogenic pipeline valves, and SCADA actuators connect directly to the Living Lattice DAG. 240-Byte static RAM C99 micro-kernel delivering 4.95 µs hardware Safe-Sign interlock and zero-gas deterministic execution.",
      depin_sc1_tab: "🏭 Scenario 1: Refinery Pipeline Pressure Isolation (Tüpraş)",
      depin_sc2_tab: "📡 Scenario 2: Telecom Base Station Offline Microgrid (Turkcell)",
      depin_sc3_tab: "⚡ Scenario 3: Siemens Gamesa 2.5MW Wind Turbine #02",
      depin_puf_title: "🛡️ Field Device Hardware Identity (Silicon PUF Root-of-Trust)",
      depin_scada_title: "SCADA TELEMETRY MONITOR (RS-485 MODBUS)",
      depin_locks_title: "C99 Safe-Sign 6-Lock Hardware Airbag",
      depin_actuation_title: "Physical Actuation & Hardware Signal Dispatch",
      depin_bus_title: "📡 Modbus RS-485 / DAG Vertex Stream",
      depin_dune_btn: "📊 Dune Analytics Query #8625163 ↗",

      // AI Colony Swarm
      colony_tag: "LAYER 4 • AUTONOMOUS AGENT SWARM & M2M ORCHESTRATOR",
      colony_title: "Mycelial AI Colony (Autonomous Machine-to-Machine Swarm)",
      colony_desc: "Not a human chat interface; an autonomous DePIN colony where physical and logical machines communicate peer-to-peer. Turbines, batteries, sensors, and robotic drones collaborate via MycStreamPay zero-gas micro-payments and local FHRR holographic memory.",
      colony_stat1: "Swarm Nodes",
      colony_stat2: "Resonance Speed",
      colony_stat3: "M2M Gas Overhead",
      colony_stat4: "Phase Lock Coherence",
      colony_stat5: "FHRR Vector Latency",
      colony_m2m_title: "📡 Live Machine-to-Machine (M2M) Transaction & Task Stream",
      colony_dispatch_title: "⚙️ Autonomous Swarm Dispatch Matrix",
      colony_pin_lbl: "PIN VOLTAGE SAFETY (GPIO)",
      colony_fhrr_lbl: "LOCAL FHRR VECTOR DIM",
      colony_cloud_lbl: "CLOUD VPS OVERHEAD",
      colony_cloud_val: "$0.00 (100% AIR-GAPPED)"
    },
    tr: {
      nav_hub: "🌐 Hub",
      nav_explorer: "🧭 Gezgin",
      nav_depin: "🤖 DePIN",
      nav_agent: "🧠 AI Kolonisi",
      nav_build: "🛠️ İnşa",
      
      nav_docs: "📚 Doküman",
      nav_faucet: "🎁 Musluk",

      // DePIN Workbench
      depin_tag: "KATMAN 0 & 1 • FİZİKSEL MAKİNE DEPIN • ZİNCİR 108",
      depin_title: "Rhizome DePIN — Biyo-Endüstriyel Makine Filosu & Silikon PUF Nöbetçisi",
      depin_desc: "Endüstriyel mikrokontrolcüler (RP2350, STM32H5), rüzgar türbinleri, boru hattı kriyojenik vanaları ve SCADA aktüatörleri doğrudan Living Lattice DAG'a bağlıdır. 240 Bayt Statik RAM C99 Çekirdeği ile 4.95 µs donanımsal Safe-Sign kalkanı ve sıfır-gas deterministik icra.",
      depin_sc1_tab: "🏭 Senaryo 1: Rafineri Boru Hattı Basınç İzolasyonu (Tüpraş)",
      depin_sc2_tab: "📡 Senaryo 2: Telekom Baz İstasyonu Çevrimdışı Mikroşebeke (Turkcell)",
      depin_sc3_tab: "⚡ Senaryo 3: Siemens Gamesa 2.5MW Rüzgar Türbini #02",
      depin_puf_title: "🛡️ Saha Cihazı Donanım Kimliği (Silicon PUF Root-of-Trust)",
      depin_scada_title: "SCADA TELEMETRİ MONİTÖRÜ (RS-485 MODBUS)",
      depin_locks_title: "C99 Safe-Sign 6-Lock Donanım Hava Yastığı",
      depin_actuation_title: "Fiziksel Aktüasyon & Donanım Sinyali Gönder",
      depin_bus_title: "📡 Modbus RS-485 / DAG Vertex Akışı",
      depin_dune_btn: "📊 Dune Analytics Sorgusu #8625163 ↗",

      // AI Colony Swarm
      colony_tag: "KATMAN 4 • OTONOM AJAN SÜRÜSÜ & M2M ORKESTRATÖRÜ",
      colony_title: "Miselial Yapay Zeka Kolonisi (Otonom Makineler Arası Sürü)",
      colony_desc: "İnsan-chat arayüzü değil; fiziksel ve mantıksal makinelerin eşler arası (P2P) konuştuğu otonom DePIN kolonisidir. Türbinler, bataryalar, sensörler ve robotik dronlar; MycStreamPay ile sıfır-gas mikro-ödemeler yaparak ve FHRR holografik bellekle yerel kararlar alarak işbirliği yapar.",
      colony_stat1: "Swarm Düğümleri",
      colony_stat2: "Rezonans Hızı",
      colony_stat3: "M2M Gas Masrafı",
      colony_stat4: "Faz Kilidi Uyumu",
      colony_stat5: "FHRR Vektör Gecikmesi",
      colony_m2m_title: "📡 Canlı Makineler Arası (M2M) İşlem & Görev Akışı",
      colony_dispatch_title: "⚙️ Otonom Koloni Görev Dağıtıcı (Dispatch Matrix)",
      colony_pin_lbl: "PİN VOLTAJ GÜVENLİĞİ (GPIO)",
      colony_fhrr_lbl: "YEREL FHRR VEKTÖR BOYUTU",
      colony_cloud_lbl: "BULUT VPS MALİYETİ",
      colony_cloud_val: "$0.00 (TAM ÇEVRİMDIŞI)"
    }
  };

  function applyLanguage(lang) {
    const d = translations[lang] || translations.en;

    // Nav links
    document.querySelectorAll('.myca-nav-center a').forEach(a => {
      const href = (a.getAttribute('href') || '').toLowerCase();
      if (href.includes('/hub')) a.textContent = d.nav_hub;
      else if (href.includes('/explorer')) a.textContent = d.nav_explorer;
      else if (href.includes('/depin')) a.textContent = d.nav_depin;
      else if (href.includes('/agent')) a.textContent = d.nav_agent;
      else if (href.includes('/build')) a.textContent = d.nav_build;
      else if (href.includes('/marketplace')) a.textContent = d.nav_market;
      else if (href.includes('/docs')) a.textContent = d.nav_docs;
    });

    const faucetBtn = document.querySelector('.myca-btn-primary');
    if (faucetBtn && faucetBtn.textContent.includes('Faucet')) {
      faucetBtn.innerHTML = `<span>${d.nav_faucet}</span>`;
    }

    // Dynamic keys with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (d[key]) el.textContent = d[key];
    });

    // DePIN Page
    const heroTag = document.querySelector('.hero-badge-tag');
    if (heroTag) heroTag.textContent = d.depin_tag;
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) heroTitle.textContent = d.depin_title;
    const heroDesc = document.querySelector('.hero-desc');
    if (heroDesc) heroDesc.textContent = d.depin_desc;

    const btnSc1 = document.getElementById('btnSc1');
    if (btnSc1) btnSc1.querySelector('span').textContent = d.depin_sc1_tab;
    const btnSc2 = document.getElementById('btnSc2');
    if (btnSc2) btnSc2.querySelector('span').textContent = d.depin_sc2_tab;
    const btnSc3 = document.getElementById('btnSc3');
    if (btnSc3) btnSc3.querySelector('span').textContent = d.depin_sc3_tab;

    // Colony Page
    const swarmTag = document.querySelector('.swarm-tag');
    if (swarmTag) swarmTag.textContent = d.colony_tag;
    const swarmTitle = document.querySelector('.swarm-title');
    if (swarmTitle) swarmTitle.textContent = d.colony_title;
    const swarmDesc = document.querySelector('.swarm-desc');
    if (swarmDesc) swarmDesc.textContent = d.colony_desc;

    // Update active state on buttons
    const btnEn = document.getElementById('langBtnEn');
    const btnTr = document.getElementById('langBtnTr');
    if (btnEn && btnTr) {
      if (lang === 'tr') {
        btnTr.classList.add('active');
        btnEn.classList.remove('active');
      } else {
        btnEn.classList.add('active');
        btnTr.classList.remove('active');
      }
    }
  }

  window.setLanguage = function(lang) {
    try { localStorage.setItem('myca_lang', lang); } catch (e) {}
    applyLanguage(lang);
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const saved = (function() {
        try { return localStorage.getItem('myca_lang') || 'en'; } catch (e) { return 'en'; }
      })();
      applyLanguage(saved);
    });
  } else {
    const saved = (function() {
      try { return localStorage.getItem('myca_lang') || 'en'; } catch (e) { return 'en'; }
    })();
    applyLanguage(saved);
  }
})();
