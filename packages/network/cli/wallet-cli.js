#!/usr/bin/env node
import { MycSmartWallet } from "../core/crypto/smart_wallet.js";

const wallet = new MycSmartWallet("TURBINE_SUPERVISOR_01");

console.log("====================================================================");
console.log("🛡️ MYC SAFE-SIGN SMART WALLET — ZERO BLIND-SIGNING");
console.log("====================================================================");
console.log("CÜZDAN ADRESİ :", wallet.address);
console.log("CÜZDAN ETİKETİ:", wallet.walletName);
console.log("GAS BAKİYESİ  : 0.00 MYC (Sıfır Gaz Protokolü)");
console.log("--------------------------------------------------------------------");

console.log("📡 ÖRNEK 1: GÜVENLİ İŞLEM İMZALAMA TALEBİ");
const safeTx = wallet.signWithHumanProof({
  device: "TURBINE",
  unit_number: 2,
  action: "START",
  target_register: 130,
  action_value: 0xFF00
});

console.log("🔍 İNSAN TARAFINDAN OKUNABİLİR ÖZET (HEX YERİNE):");
console.log("   • İngilizce Eylem :", safeTx.humanReadableSummary.humanActionEn);
console.log("   • Türkçe Eylem    :", safeTx.humanReadableSummary.humanActionTr);
console.log("   • Risk Seviyesi   :", safeTx.humanReadableSummary.riskLevel);
console.log("   • Fiziksel Voltaj :", safeTx.humanReadableSummary.physicalPinImpact);
console.log("   • Modbus Register :", safeTx.humanReadableSummary.modbusRegister);
console.log("   • Gas Kesintisi   :", safeTx.humanReadableSummary.gasCost);
console.log("   • İmza Durumu     : ✅ ONAYLANDI & İMZALANDI (Sig: " + safeTx.signature.slice(0, 16) + "...)");

console.log("--------------------------------------------------------------------");
console.log("📡 ÖRNEK 2: SALDIRGAN/NEGATİF İŞLEM İMZALAMA TALEBİ (Örn: Sakın açma)");
const attackTx = wallet.signWithHumanProof({
  device: "VALVE",
  unit_number: 5,
  action: "CANCELLED",
  target_register: 0,
  action_value: 0
}, true); // flagged as attack

console.log("🔍 İMZA SONUCU:");
console.log("   • Durum           :", attackTx.status);
console.log("   • Güvenlik Uyarısı:", attackTx.warning);
console.log("   • İmza Üretildi mi: ❌ HAYIR (0-Byte NO-OP)");
console.log("====================================================================");
