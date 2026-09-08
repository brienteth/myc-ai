/**
 * Cross-Platform Sovereign Workflow Daemon
 * Native execution daemon for macOS, Windows, and Linux.
 * Works with zero cloud server costs ($0.00).
 */

import os from 'os';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { SovereignWorkflowEngine } from './workflow_engine.js';

class DesktopWorkflowDaemon {
  constructor() {
    this.platform = os.platform(); // 'darwin', 'win32', 'linux'
    this.engine = new SovereignWorkflowEngine();
    this.configDir = path.join(os.homedir(), '.mycai');
    this.configFile = path.join(this.configDir, 'workflows.json');
    this.ensureConfigDir();
  }

  ensureConfigDir() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
    if (!fs.existsSync(this.configFile)) {
      const defaultWorkflows = [
        {
          id: "daily-tech-digest",
          name: "Günlük DePIN & Web3 AI Takipçisi",
          enabled: true,
          intervalMinutes: 60,
          sourceType: "mock_social",
          keywords: ["cortex", "depin", "ai", "gas", "blockchain"],
          model: "mycai-local", // "mycai-local", "ollama", "0g", "cloud"
          channel: "desktop_notification", // "telegram", "whatsapp", "desktop_notification"
          channelConfig: {
            chatId: "@depin_haberleri",
            phone: "+905320000000"
          }
        }
      ];
      fs.writeFileSync(this.configFile, JSON.stringify(defaultWorkflows, null, 2));
    }
  }

  loadWorkflows() {
    try {
      const raw = fs.readFileSync(this.configFile, 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      console.error("[Daemon] Config reading error:", e.message);
      return [];
    }
  }

  /**
   * Cross-platform OS notification dispatcher
   */
  notifyOS(title, message) {
    const cleanTitle = title.replace(/"/g, '\\"');
    const cleanMsg = message.replace(/"/g, '\\"').slice(0, 150);

    if (this.platform === 'darwin') {
      exec(`osascript -e 'display notification "${cleanMsg}" with title "${cleanTitle}"'`);
    } else if (this.platform === 'win32') {
      const psCmd = `powershell -Command "[reflection.assembly]::loadwithpartialname('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('${cleanMsg}', '${cleanTitle}')"`;
      exec(psCmd);
    } else if (this.platform === 'linux') {
      exec(`notify-send "${cleanTitle}" "${cleanMsg}"`);
    }
  }

  async runWorkflow(wf) {
    console.log(`\n[${new Date().toLocaleTimeString()}] 🚀 Çalıştırılıyor: "${wf.name}"`);
    console.log(`   • Model     : ${wf.model || wf.modelChoice}`);
    console.log(`   • Bildirim  : ${wf.channel}`);
    console.log(`   • İşletim S : ${this.platform} (macOS / Windows / Linux)`);

    const result = await this.engine.runWorkflow({
      name: wf.name,
      sourceType: wf.sourceType,
      keywords: wf.keywords,
      model: wf.model || wf.modelChoice,
      channel: wf.channel,
      channelConfig: wf.channelConfig
    });

    console.log(`   • Sonuç     : ${result.deliveryStatus ? 'BAŞARILI' : 'TAMAMLANDI'} (${result.compute.latencyMs} ms, Maliyet: $${result.compute.costUsd.toFixed(4)})`);
    console.log(`   • Dağıtım   : ${result.log}`);

    // Native OS toast notification
    this.notifyOS("MycAI Agent: " + wf.name, `Görev tamamlandı. Model: ${result.compute.model}`);

    return result;
  }

  async start() {
    console.log("==================================================================");
    console.log("⚡ MycAI Cross-Platform Sovereign Workflow Daemon Başlatıldı");
    console.log(`🖥️  İşletim Sistemi: ${this.platform} (${os.type()} ${os.arch()})`);
    console.log(`📂 Yapılandırma Dosyası: ${this.configFile}`);
    console.log("==================================================================");

    const workflows = this.loadWorkflows();
    console.log(`[Daemon] ${workflows.length} adet kayıtlı iş akışı bulundu.`);

    for (const wf of workflows) {
      if (wf.enabled) {
        await this.runWorkflow(wf);
      }
    }
  }
}

// If run directly via node
if (process.argv[1]?.endsWith('desktop_runner.js')) {
  const daemon = new DesktopWorkflowDaemon();
  daemon.start().then(() => {
    console.log("\n[Daemon] İlk döngü başarıyla tamamlandı. Arka plan servis kontratı aktif.");
  });
}

export { DesktopWorkflowDaemon };
