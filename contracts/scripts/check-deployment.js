// Đối chiếu cấu hình triển khai với trạng thái contract trên TrustKeys.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

async function main() {
  const file = path.resolve(__dirname, "../../shared/deployments.json");
  if (!fs.existsSync(file)) throw new Error("Không thấy shared/deployments.json");
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  if (d.chainId !== 11968 || d.version !== "v1") throw new Error("Sai network/version");
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || d.rpc, 11968);
  const net = await provider.getNetwork();
  if (net.chainId !== 11968n) throw new Error("RPC đang nối sai mạng");
  for (const name of ["AgentWallet", "ServiceRegistry"]) {
    if (!ethers.isAddress(d[name]?.address) || !Array.isArray(d[name]?.abi)) throw new Error(`Thiếu địa chỉ/ABI ${name}`);
    if ((await provider.getCode(d[name].address)) === "0x") throw new Error(`${name} chưa có bytecode tại địa chỉ`);
  }
  const wallet = new ethers.Contract(d.AgentWallet.address, d.AgentWallet.abi, provider);
  const [owner, agent, perTxLimit, dailyLimit, remainingToday, paused] = await Promise.all([
    wallet.owner(), wallet.agent(), wallet.perTxLimit(), wallet.dailyLimit(), wallet.remainingToday(), wallet.paused()
  ]);
  if (owner.toLowerCase() !== d.owner.toLowerCase() || agent.toLowerCase() !== d.agent.toLowerCase()) {
    throw new Error("owner/agent trong JSON không khớp trên chuỗi");
  }
  console.log(JSON.stringify({ chainId: 11968, wallet: d.AgentWallet.address, owner, agent,
    perTxLimit: ethers.formatEther(perTxLimit), dailyLimit: ethers.formatEther(dailyLimit),
    remainingToday: ethers.formatEther(remainingToday), paused }, null, 2));
}
main().catch((error) => { console.error("Kiểm tra deploy thất bại:", error.message); process.exitCode = 1; });
