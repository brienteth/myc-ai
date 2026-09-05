import { fetchIotexBlockNumber } from "./_iotex.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const blockNumber = await fetchIotexBlockNumber();

  res.status(200).json({
    network: "IoTeX Mainnet",
    chainId: 4689,
    latestBlock: blockNumber,
    iotexScanUrl: `https://iotexscan.io/block/${blockNumber}`,
    kernel: {
      standard: "C99 Freestanding",
      ramAllocated: "240 Bytes (malloc=0)",
      targetArchitecture: "ARM Cortex-M33 (Armv8-M)"
    }
  });
}
