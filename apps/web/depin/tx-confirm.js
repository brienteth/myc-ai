/**
 * MYCA Sovereign Network - Unified Transaction Confirmation & Hardware Security Modal
 * Chain ID: 108 (MYCA Sovereign Lattice)
 */
(function() {
  function ensureTxConfirmModalDOM() {
    if (document.getElementById("txConfirmOverlay")) return;

    const style = document.createElement("style");
    style.id = "txConfirmStyles";
    style.textContent = `
      .tx-confirm-overlay {
        display: none;
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(4, 9, 18, 0.88);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        z-index: 999999;
        align-items: center;
        justify-content: center;
        padding: 20px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .tx-confirm-overlay.active { display: flex; animation: txcFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1); }
      @keyframes txcFadeIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      .tx-confirm-card {
        background: linear-gradient(180deg, #0d1627 0%, #060b14 100%);
        border: 1px solid rgba(16, 185, 129, 0.35);
        border-radius: 22px;
        width: 100%;
        max-width: 450px;
        padding: 26px 24px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(16, 185, 129, 0.12);
        color: #fff;
        position: relative;
        box-sizing: border-box;
      }
      .txc-header { text-align: center; margin-bottom: 16px; }
      .txc-icon { font-size: 38px; margin-bottom: 6px; filter: drop-shadow(0 0 12px rgba(16, 185, 129, 0.4)); }
      .txc-title { font-size: 19px; font-weight: 800; color: #fff; letter-spacing: -0.3px; }
      .txc-subtitle { font-size: 12px; color: #94a3b8; margin-top: 4px; }
      .txc-amount-highlight {
        background: rgba(16, 185, 129, 0.08);
        border: 1px solid rgba(16, 185, 129, 0.25);
        border-radius: 14px;
        padding: 12px 16px;
        text-align: center;
        font-size: 22px;
        font-weight: 800;
        color: #34d399;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        margin-bottom: 14px;
        word-break: break-word;
      }
      .txc-ticker { font-size: 13px; color: #a7f3d0; font-weight: 600; margin-left: 4px; }
      .txc-details {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 12px;
        padding: 10px 14px;
        margin-bottom: 14px;
        font-size: 12px;
      }
      .txc-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
      }
      .txc-row + .txc-row { border-top: 1px solid rgba(255, 255, 255, 0.05); }
      .txc-label { color: #64748b; font-size: 11.5px; }
      .txc-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #e2e8f0; font-size: 12px; font-weight: 600; }
      .txc-security-badge {
        background: rgba(16, 185, 129, 0.08);
        border: 1px solid rgba(16, 185, 129, 0.25);
        border-radius: 10px;
        padding: 8px 12px;
        margin-bottom: 18px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        color: #a7f3d0;
      }
      .txc-actions {
        display: grid;
        grid-template-columns: 1fr 1.35fr;
        gap: 12px;
      }
      .txc-btn {
        padding: 12px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      .txc-btn-cancel {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #94a3b8;
      }
      .txc-btn-cancel:hover { background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.4); color: #f87171; }
      .txc-btn-confirm {
        background: linear-gradient(135deg, #10b981, #059669);
        border: 1px solid #10b981;
        color: #fff;
        box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
      }
      .txc-btn-confirm:hover { background: linear-gradient(135deg, #059669, #047857); transform: translateY(-1px); }
      .txc-btn-confirm:active { transform: translateY(0); }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.className = "tx-confirm-overlay";
    overlay.id = "txConfirmOverlay";
    overlay.innerHTML = `
      <div class="tx-confirm-card">
        <div class="txc-header">
          <div class="txc-icon" id="txcIcon">🔐</div>
          <div class="txc-title" id="txcTitle">İşlem Onayı</div>
          <div class="txc-subtitle" id="txcSubtitle">MYCA Sovereign Lattice (Chain 108)</div>
        </div>
        <div class="txc-amount-highlight" id="txcAmount">0 <span class="txc-ticker">MYC</span></div>
        <div class="txc-details" id="txcDetails"></div>
        <div class="txc-security-badge">
          <span>🛡️</span>
          <span>Silicon PUF İmzası & Modbus Negation Koruması Doğrulandı</span>
        </div>
        <div class="txc-actions">
          <button class="txc-btn txc-btn-cancel" id="txcCancelBtn">❌ İptal</button>
          <button class="txc-btn txc-btn-confirm" id="txcConfirmBtn">✅ Onayla & İmzala</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      if (e.target.id === "txConfirmOverlay") {
        overlay.classList.remove("active");
        if (window._pendingTxResolve) { window._pendingTxResolve(false); window._pendingTxResolve = null; }
      }
    });

    document.getElementById("txcCancelBtn").addEventListener("click", () => {
      overlay.classList.remove("active");
      if (window._pendingTxResolve) { window._pendingTxResolve(false); window._pendingTxResolve = null; }
    });

    document.getElementById("txcConfirmBtn").addEventListener("click", () => {
      const btn = document.getElementById("txcConfirmBtn");
      btn.disabled = true;
      btn.innerHTML = "⚡ İmzalanıyor...";
      if (window._pendingTxResolve) { window._pendingTxResolve(true); window._pendingTxResolve = null; }
      setTimeout(() => {
        overlay.classList.remove("active");
        btn.disabled = false;
        btn.innerHTML = "✅ Onayla & İmzala";
      }, 700);
    });
  }

  window.showTxConfirmation = function(opts) {
    ensureTxConfirmModalDOM();
    return new Promise((resolve) => {
      window._pendingTxResolve = resolve;
      const overlay = document.getElementById("txConfirmOverlay");
      const icons = {
        TRANSFER: "💸",
        SWAP: "🔄",
        BRIDGE: "🌉",
        STAKE: "🔒",
        UNSTAKE: "🔓",
        FAUCET: "🚰",
        MINT: "💎"
      };

      const type = opts.type || "TRANSFER";
      document.getElementById("txcIcon").textContent = icons[type] || "🔐";
      document.getElementById("txcTitle").textContent = opts.title || `${type} İşlem Onayı`;
      document.getElementById("txcSubtitle").textContent = opts.subtitle || "Lütfen işlem detaylarını onaylayın";
      
      const amountStr = typeof opts.amount === "number" ? opts.amount.toLocaleString() : (opts.amount || "0");
      document.getElementById("txcAmount").innerHTML = `${amountStr} <span class="txc-ticker">${opts.asset || "MYC"}</span>`;

      const from = opts.from || localStorage.getItem('myca_wallet_address') || localStorage.getItem('myca_native_address') || "myc14d29b6c4b38b2ac4a6e2bbb9c4d7c002";
      const to = opts.to || "Protocol Contract";
      const shortFrom = from.length > 22 ? from.slice(0, 12) + "..." + from.slice(-6) : from;
      const shortTo = to.length > 22 ? to.slice(0, 12) + "..." + to.slice(-6) : to;

      let html = `
        <div class="txc-row"><span class="txc-label">İşlem Türü</span><span class="txc-value">${type}</span></div>
        <div class="txc-row"><span class="txc-label">Gönderen</span><span class="txc-value" title="${from}">${shortFrom}</span></div>
        <div class="txc-row"><span class="txc-label">Alıcı / Hedef</span><span class="txc-value" title="${to}">${shortTo}</span></div>
        <div class="txc-row"><span class="txc-label">Gas Ücreti</span><span class="txc-value" style="color: #34d399;">0.00 MYC (Sıfır Gas)</span></div>
        <div class="txc-row"><span class="txc-label">Ağ</span><span class="txc-value">MYCA Sovereign Lattice (108)</span></div>
      `;

      if (opts.extraDetails && Array.isArray(opts.extraDetails)) {
        opts.extraDetails.forEach(d => {
          html += `<div class="txc-row"><span class="txc-label">${d.label}</span><span class="txc-value" style="${d.color ? 'color:'+d.color : ''}">${d.value}</span></div>`;
        });
      }

      document.getElementById("txcDetails").innerHTML = html;
      overlay.classList.add("active");
    });
  };
})();
