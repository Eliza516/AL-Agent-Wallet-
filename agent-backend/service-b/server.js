// Demo m2m theo mẫu HTTP 402. Xác minh thanh toán bằng event on-chain, không tin client.
import "dotenv/config";
import express from "express";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { Contract, JsonRpcProvider, encodeBytes32String, isAddress, parseEther } from "ethers";

const quotes = new Map();
const inFlight = new Set();
const MOCK_PRICE = "0.002";

// verifyPayment là hàm đọc blockchain (có thể thay bằng mock khi unit test).
export function createServiceApp({ payTo, verifyPayment, price = MOCK_PRICE } = {}) {
  if (!isAddress(payTo) || typeof verifyPayment !== "function") throw new Error("Service B chưa cấu hình đúng payTo / verifier.");
  const app = express();
  app.get("/btc-price", async (req, res) => {
    const requestId = req.get("X-Request-Id");
    if (!requestId) {
      const id = `req-${randomBytes(12).toString("hex")}`; // 28 ASCII, vừa bytes32
      quotes.set(id, { price, payTo, used: false });
      res.status(402).json({ price, payTo, requestId: id });
      return;
    }
    const quote = quotes.get(requestId);
    if (!quote || quote.used || inFlight.has(requestId)) {
      res.status(409).json({ error: { code: "INVALID_INPUT", message: "RequestId không còn hợp lệ hoặc đã sử dụng." } });
      return;
    }
    inFlight.add(requestId); // chặn hai request đồng thời dùng chung 1 thanh toán
    try {
      const ok = await verifyPayment({ requestId, price: quote.price, payTo: quote.payTo });
      if (!ok) {
        res.status(402).json({ price: quote.price, payTo: quote.payTo, requestId });
        return;
      }
      quote.used = true;
      res.status(200).json({ symbol: "BTC", price_usd: 72000, note: "dữ liệu giả lập" });
    } catch {
      res.status(502).json({ error: { code: "RPC_ERROR", message: "Không kiểm tra được giao dịch trên chain." } });
    } finally {
      inFlight.delete(requestId);
    }
  });
  return app;
}

async function onChainVerifier(payTo) {
  const path = fileURLToPath(new URL("../../shared/deployments.json", import.meta.url));
  const dep = JSON.parse(await readFile(path, "utf8"));
  if (dep.chainId !== 11968 || !isAddress(dep.AgentWallet?.address) || !dep.AgentWallet?.abi?.length ||
      !Number.isSafeInteger(dep.deployBlock)) throw new Error("Chưa có deployments.json TrustKeys hợp lệ.");
  const rpc = new JsonRpcProvider(process.env.RPC_URL || dep.rpc, 11968);
  const contract = new Contract(dep.AgentWallet.address, dep.AgentWallet.abi, rpc);
  return async ({ requestId, price }) => {
    const ref = encodeBytes32String(requestId);
    const filter = contract.filters.PaymentExecuted(payTo, null, ref);
    const latest = await rpc.getBlockNumber();
    for (let from = dep.deployBlock; from <= latest; from += 2000) {
      const logs = await contract.queryFilter(filter, from, Math.min(latest, from + 1999));
      if (logs.some((event) => event.args.to.toLowerCase() === payTo.toLowerCase() && event.args.amount >= parseEther(price))) return true;
    }
    return false;
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const payTo = process.env.SERVICE_B_PAY_TO;
  if (!isAddress(payTo)) throw new Error("Hãy đặt SERVICE_B_PAY_TO trong .env thành địa chỉ testnet của dịch vụ B.");
  const isReal = process.env.CHAIN_MODE === "real";
  const verifier = isReal ? await onChainVerifier(payTo) : async () => false;
  const app = createServiceApp({ payTo, verifyPayment: verifier });
  const port = Number(process.env.SERVICE_B_PORT || 4000);
  app.listen(port, "127.0.0.1", () => console.log(`Service B: http://127.0.0.1:${port} (${isReal ? "on-chain" : "mock: 402 only"})`));
}
