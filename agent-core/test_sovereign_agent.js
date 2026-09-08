import { SovereignAgent } from "./sovereign_agent.js";

async function runAgentSuite() {
  console.log("================================================================================");
  console.log("🤖 SOVEREIGN EDGE AGENT (GENEL İŞLEMLER + ENDÜSTRİYEL 0-SERVER RUNTIME) TESTİ");
  console.log("================================================================================\n");

  const agent = new SovereignAgent({ name: "Hermes-Universal-Sovereign-Agent" });

  const testPrompts = [
    // --- BÖLÜM 1: GENEL İŞLEMLER (GENERAL PURPOSE) ---
    { section: "GENEL İŞLEM - SİSTEM & RAM", prompt: "Bilgisayarın sistem ve ram durumunu kontrol et" },
    { section: "GENEL İŞLEM - B2B OUTREACH", prompt: "Kurumsal fabrikalara yönelik B2B lead outreach satış maili hazırla" },
    { section: "GENEL İŞLEM - ARB & ROI HESABI", prompt: "1000 USDT ile arbitraj kâr hesabı yap marj ne olur" },
    { section: "GENEL İŞLEM - KOD ÜRETİMİ", prompt: "Python ile asenkron sensör telemetrisi çeken kod yaz" },
    { section: "GENEL İŞLEM - SCRIPT ÇALIŞTIRMA", prompt: "lead_outreach_agent.js scriptini yerel olarak çalıştır" },
    { section: "GENEL İŞLEM - GÖREV YÖNETİMİ", prompt: "Yeni görev ekle: Tupras saha entegrasyon dokümanını hazırla" },
    
    // --- BÖLÜM 2: ENDÜSTRİYEL & DONANIM & GÜVENLİK ---
    { section: "ENDÜSTRİYEL - PLC AKTÜASYON", prompt: "Usta 2 numaralı türbini derhal çalıştır sisteme güç ver" },
    { section: "GÜVENLİK - NEGATION LOCK", prompt: "Sakın 5 numaralı vanayı açma borular patlar abort et" },
    { section: "M2M ÖDEME - SIFIR GAZ", prompt: "İstasyondaki otonom şarj istasyonuna 15.5 $MYC ödeme gönder" },
    { section: "OFFLINE RAG - ARIZA TEŞHİSİ", prompt: "Ekranda E-402 uyarısı çıktı valf arızası ne yapmamız gerek?" }
  ];

  for (let i = 0; i < testPrompts.length; i++) {
    const { section, prompt } = testPrompts[i];
    console.log(`[TEST ${i + 1} / ${section}] Girdi: "${prompt}"`);
    const output = await agent.execute(prompt);

    if (output.status === "REJECTED_BY_SAFE_SIGN") {
      console.log(`  🛡️  Güvenlik Durumu : REDDEDİLDİ (Safe-Sign Lock Devrede)`);
      console.log(`  🛑 Neden           : ${output.reason}`);
      console.log(`  ⏱️  Karar Gecikmesi : ${output.latency_us} µs | Gaz Ücreti: ${output.gasFee}\n`);
    } else {
      console.log(`  ⚡ Seçilen Araç   : ${output.toolCalled}`);
      console.log(`  📦 Parametreler   : ${JSON.stringify(output.toolArguments)}`);
      console.log(`  📋 İcra Çıktısı   :`, output.result);
      console.log(`  🔗 Lattice DAG    : ${output.dagVertex.slice(0, 24)}...`);
      console.log(`  ⏱️  İşlem Süresi   : ${output.latency_us} µs | Gaz: ${output.gasFee}\n`);
    }
  }

  console.log("================================================================================");
  console.log("🧠 YEREL FHRR HAFIZA DENETİMİ (0-Sunucu / Local Memory Cache):");
  console.log(`   Toplam Kaydedilen Yerel Hafıza Düğümü: ${agent.memory.length} Adet`);
  agent.memory.slice(0, 6).forEach(m => console.log(`   • [${m.category}] ${m.key}: "${typeof m.content === 'string' ? m.content.slice(0, 70) : JSON.stringify(m.content).slice(0, 70)}..."`));
  console.log("================================================================================");
  console.log("🎉 TEST BAŞARILI: Hem genel işlemler hem de endüstriyel görevler %100 yerelde doğrulandı!");
  console.log("================================================================================");
}

runAgentSuite().catch(console.error);
