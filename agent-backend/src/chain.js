// Kết nối TrustKeys thật; chỉ module này chuyển coin string ↔ wei BigInt.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  Contract, JsonRpcProvider, Wallet, formatEther, parseEther,
  encodeBytes32String, decodeBytes32String, isAddress
} from "ethers";
import { inputError, publicError } from "./errors.js";

let contextPromise;

async function context() {
  if (!contextPromise) contextPromise = (async () => {
    const path = fileURLToPath(new URL("../../shared/deployments.json", import.meta.url));
    const deployment = JSON.parse(await readFile(path, "utf8"));
    const chainId = Number(process.env.CHAIN_ID || 11968);
    if (deployment.version !== "v1" || chainId !== 11968 || deployment.chainId !== chainId ||
        deployment.network !== "trustkeys" || !deployment.AgentWallet?.abi?.length ||
        !deployment.ServiceRegistry?.abi?.length || !isAddress(deployment.AgentWallet.address) ||
        !isAddress(deployment.ServiceRegistry.address) || !Number.isSafeInteger(deployment.deployBlock)) {
      throw new Error("shared/deployments.json chưa đủ hoặc không khớp Interface v1.");
    }
    const provider = new JsonRpcProvider(process.env.RPC_URL || deployment.rpc, chainId);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== chainId) throw new Error("RPC đang ở sai chainId.");
    // Chỉ nạp PRIVATE KEY khi cần một giao dịch WRITE; các GET không cần khóa.
    const wallet = new Contract(deployment.AgentWallet.address, deployment.AgentWallet.abi, provider);
    const registry = new Contract(deployment.ServiceRegistry.address, deployment.ServiceRegistry.abi, provider);
    return { deployment, provider, wallet, registry };
  })().catch((error) => { contextPromise = undefined; throw error; });
  return contextPromise;
}

export async function getWalletStatus() {
  const { provider, wallet, deployment } = await context();
  const [balance, owner, agent, perTxLimit, dailyLimit, rawSpent, windowStart, paused, remaining, lastBlock] =
    await Promise.all([
      provider.getBalance(deployment.AgentWallet.address), wallet.owner(), wallet.agent(),
      wallet.perTxLimit(), wallet.dailyLimit(), wallet.spentInWindow(), wallet.windowStart(),
      wallet.paused(), wallet.remainingToday(), provider.getBlock("latest")
    ]);
  if (!lastBlock) throw new Error("RPC chưa trả về block mới nhất.");
  const expired = BigInt(lastBlock.timestamp) >= windowStart + 86400n;
  return {
    wallet: deployment.AgentWallet.address,
    owner, agent,
    balance: formatEther(balance),
    perTxLimit: formatEther(perTxLimit),
    dailyLimit: formatEther(dailyLimit),
    spentToday: formatEther(expired ? 0n : rawSpent),
    remainingToday: formatEther(remaining),
    paused
  };
}

export async function listServices() {
  const { registry } = await context();
  const count = Number(await registry.serviceCount());
  if (!Number.isSafeInteger(count) || count > 200) throw new Error("Danh sách dịch vụ vượt giới hạn demo.");
  const results = [];
  for (let i = 0; i < count; i++) {
    const [name, price, payTo, _provider, active] = await registry.getService(i);
    results.push({ id: i, name, price: formatEther(price), payTo, active });
  }
  return results;
}

export async function listPayments() {
  const { provider, wallet, deployment } = await context();
  const latest = await provider.getBlockNumber();
  const events = [];
  // RPC có thể giới hạn khoảng block; quét từng đoạn từ block deploy.
  for (let from = deployment.deployBlock; from <= latest; from += 2000) {
    const to = Math.min(latest, from + 1999);
    events.push(...await wallet.queryFilter(wallet.filters.PaymentExecuted(), from, to));
  }
  return events.sort((a, b) => b.blockNumber - a.blockNumber || (b.index ?? 0) - (a.index ?? 0))
    .map((event) => ({
      to: event.args.to,
      amount: formatEther(event.args.amount),
      ref: decodeBytes32String(event.args.ref),
      txHash: event.transactionHash,
      blockNumber: event.blockNumber
    }));
}

function checkPayArgs({ to, amount, ref } = {}) {
  if (!isAddress(to) || typeof amount !== "string" ||
      !/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(amount) ||
      typeof ref !== "string" || !/^[\x20-\x7e]{1,31}$/.test(ref)) throw inputError();
  const wei = parseEther(amount);
  if (wei <= 0n) throw inputError();
  return { wei, encodedRef: encodeBytes32String(ref) };
}

export async function pay(args) {
  let contractInterface;
  try {
    const { wei, encodedRef } = checkPayArgs(args);
    const { provider, wallet } = await context();
    contractInterface = wallet.interface;
    if (!process.env.AGENT_PRIVATE_KEY) throw new Error("Thiếu AGENT_PRIVATE_KEY trong .env.");
    const signer = new Wallet(process.env.AGENT_PRIVATE_KEY, provider);
    const expectedAgent = await wallet.agent();
    if (signer.address.toLowerCase() !== expectedAgent.toLowerCase())
      return { ok: false, code: "NOT_AGENT", message: "Ví agent không khớp với contract." };
    const signedWallet = wallet.connect(signer);
    // Kiểm tra revert trước khi gửi; smart contract vẫn là nguồn phán quyết cuối.
    await signedWallet.execute.staticCall(args.to, wei, encodedRef);
    const tx = await signedWallet.execute(args.to, wei, encodedRef);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error("Giao dịch chưa được xác nhận thành công.");
    return { ok: true, txHash: tx.hash };
  } catch (error) {
    return { ok: false, ...publicError(error, contractInterface) };
  }
}

export async function buyData(serviceId) {
  if (!Number.isSafeInteger(serviceId) || serviceId < 0) return { ok: false, code: "INVALID_INPUT" };
  try {
    const service = (await listServices()).find((s) => s.id === serviceId);
    if (!service || !service.active) return { ok: false, code: "INVALID_INPUT" };
    const url = new URL("/btc-price", process.env.SERVICE_B_URL || "http://127.0.0.1:4000");
    const quoteResponse = await fetch(url);
    if (quoteResponse.status === 200) return { ok: true, data: await quoteResponse.json() };
    if (quoteResponse.status !== 402) return { ok: false, code: "RPC_ERROR" };
    const quote = await quoteResponse.json();
    // Tin giá dịch vụ CHỈ khi khớp giá và địa chỉ đăng ký trên chain.
    if (quote.price !== service.price || !isAddress(quote.payTo) ||
        quote.payTo.toLowerCase() !== service.payTo.toLowerCase() ||
        typeof quote.requestId !== "string" || !/^[\x20-\x7e]{1,31}$/.test(quote.requestId)) {
      return { ok: false, code: "INVALID_INPUT" };
    }
    const payment = await pay({ to: service.payTo, amount: service.price, ref: quote.requestId });
    if (!payment.ok) return payment;
    const dataResponse = await fetch(url, { headers: { "X-Request-Id": quote.requestId } });
    if (!dataResponse.ok) return { ok: false, code: "RPC_ERROR" };
    return { ok: true, data: await dataResponse.json(), txHash: payment.txHash };
  } catch (error) {
    return { ok: false, ...publicError(error) };
  }
}
