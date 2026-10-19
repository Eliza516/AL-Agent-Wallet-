// Chạy sau khi đã deploy 2 contract trên TrustKeys bằng Remix.
// Script chỉ đọc blockchain và sinh metadata từ ABI đã compile, không dùng private key.
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { ethers } = require("ethers");

async function main() {
  const walletAddress = process.env.AGENT_WALLET_ADDRESS;
  const registryAddress = process.env.SERVICE_REGISTRY_ADDRESS;
  const deployBlock = Number(process.env.DEPLOY_BLOCK);
  if (!ethers.isAddress(walletAddress) || !ethers.isAddress(registryAddress)) {
    throw new Error("Đặt AGENT_WALLET_ADDRESS, SERVICE_REGISTRY_ADDRESS trong .env (địa chỉ deploy THẬT).");
  }
  if (!process.env.DEPLOY_BLOCK || !Number.isSafeInteger(deployBlock) || deployBlock < 0) {
    throw new Error("DEPLOY_BLOCK phải là số block thật (không đoán hoặc dùng 0 giả).");
  }
  const rpc = process.env.RPC_URL || "https://l1testnet.trustkeys.network";
  const provider = new ethers.JsonRpcProvider(rpc, 11968);
  const network = await provider.getNetwork();
  if (network.chainId !== 11968n) throw new Error("Sai network, cần TrustKeys 11968");
  const artifact = (name) => {
    const file = path.resolve(__dirname, `../artifacts/${name}.sol/${name}.json`);
    if (!fs.existsSync(file)) throw new Error(`Không thấy artifact ${name}. Hãy chạy npm run compile.`);
    return JSON.parse(fs.readFileSync(file, "utf8")).abi;
  };
  if (await provider.getCode(walletAddress) === "0x" || await provider.getCode(registryAddress) === "0x") {
    throw new Error("Ít nhất một địa chỉ không có smart contract trên mạng này");
  }
  const walletAbi = artifact("AgentWallet");
  const registryAbi = artifact("ServiceRegistry");
  const wallet = new ethers.Contract(walletAddress, walletAbi, provider);
  const [owner, agent] = await Promise.all([wallet.owner(), wallet.agent()]);
  const json = {
    version: "v1", deployBlock, network: "trustkeys", chainId: 11968, rpc,
    owner, agent,
    AgentWallet: { address: ethers.getAddress(walletAddress), abi: walletAbi },
    ServiceRegistry: { address: ethers.getAddress(registryAddress), abi: registryAbi },
  };
  const target = path.resolve(__dirname, "../../shared/deployments.json");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log("Đã tạo shared/deployments.json từ địa chỉ và dữ liệu thật:", target);
}
main().catch((error) => { console.error("Xuất deployments thất bại:", error.message); process.exitCode = 1; });
