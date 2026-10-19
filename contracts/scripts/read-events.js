// Đọc lịch sử thanh toán trực tiếp từ RPC TrustKeys (không cần explorer).
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { ethers } = require("ethers");

async function main() {
  const jsonPath = path.resolve(__dirname, "../../shared/deployments.json");
  if (!fs.existsSync(jsonPath)) throw new Error("Chưa có shared/deployments.json. Hãy deploy và chạy npm run export:deployment trước.");
  const deployment = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  if (deployment.version !== "v1" || deployment.chainId !== 11968) throw new Error("Deployment không khớp Interface v1 / TrustKeys 11968");
  if (!Number.isInteger(deployment.deployBlock) || deployment.deployBlock < 0) throw new Error("deployBlock không hợp lệ");
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || deployment.rpc, 11968);
  const network = await provider.getNetwork();
  if (network.chainId !== 11968n) throw new Error(`Sai chainId: ${network.chainId}`);
  const contract = new ethers.Contract(deployment.AgentWallet.address, deployment.AgentWallet.abi, provider);
  const latest = await provider.getBlockNumber();
  const items = [];
  // Phân trang để tránh RPC từ chối phạm vi block quá lớn.
  for (let from = deployment.deployBlock; from <= latest; from += 2000) {
    const to = Math.min(from + 1999, latest);
    const logs = await contract.queryFilter(contract.filters.PaymentExecuted(), from, to);
    for (const log of logs) {
      let reference;
      try { reference = ethers.decodeBytes32String(log.args.ref); }
      catch { reference = log.args.ref; }
      items.push({ to: log.args.to, amount: ethers.formatEther(log.args.amount), ref: reference,
        txHash: log.transactionHash, blockNumber: log.blockNumber });
    }
  }
  items.sort((a, b) => b.blockNumber - a.blockNumber);
  console.log(JSON.stringify(items, null, 2));
}

main().catch((error) => { console.error("Đọc events thất bại:", error.message); process.exitCode = 1; });
