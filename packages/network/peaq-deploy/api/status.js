import { fetchPeaqBlockNumber } from "./_peaq.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const blockNumber = await fetchPeaqBlockNumber();

  res.status(200).json({
    network: "peaq Network (Mainnet / Substrate)",
    chainId: 3338,
    latestBlock: blockNumber,
    subscanUrl: `https://peaq.subscan.io/block/${blockNumber}`,
    kernel: {
      standard: "C99 Freestanding",
      ramAllocated: "240 Bytes (malloc=0)",
      targetArchitecture: "ARM Cortex-M33 (Armv8-M)"
    }
  });
}
