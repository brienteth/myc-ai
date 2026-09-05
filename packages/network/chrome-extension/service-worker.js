/**
 * MYCA Sovereign Wallet - Background Service Worker (Manifest V3)
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("MYCA Sovereign Wallet installed successfully.");
  // Initialize default network and gas settings
  chrome.storage.local.get(["network", "rpcUrl"], (res) => {
    if (!res.network) {
      chrome.storage.local.set({
        network: "MYC-LATTICE-MAINNET (Chain 108)",
        rpcUrl: "http://localhost:4040/api/rpc",
        nodeUrl: "http://localhost:4040",
        gasFeeSetting: "0.00000000 MYC (Strict Invariant)"
      });
    }
  });
});

// Periodic status ping or badge notification
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_WALLET_STATUS") {
    sendResponse({ status: "ACTIVE", gasProtocol: "ZERO_GAS_POR" });
  }
  return true;
});
