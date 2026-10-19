// Chain giả cho người 1 dùng khi chưa có chain.js thật của người 2.
// Cùng interface 2.5: getWalletStatus, listServices, pay.
import { parseEther, formatEther } from "ethers";

// Mọi phép cộng trừ dùng BigInt (wei) để tránh lỗi số thực (0.1 + 0.2 ≠ 0.3).
const perTxLimit = parseEther("0.01");
const dailyLimit = parseEther("0.05");
let spentToday = parseEther("0.048");
let balance = parseEther("0.95");

const WALLET = "0x00000000000000000000000000000000000000AA";
const DATAFEED_PAYTO = "0x1111111111111111111111111111111111111111";

const services = [
  { id: 0, name: "DataFeed", price: "0.002", payTo: DATAFEED_PAYTO, active: true },
];

export async function getWalletStatus() {
  return {
    wallet: WALLET,
    owner: "0x00000000000000000000000000000000000000B1",
    agent: "0x00000000000000000000000000000000000000C2",
    balance: formatEther(balance),
    perTxLimit: formatEther(perTxLimit),
    dailyLimit: formatEther(dailyLimit),
    spentToday: formatEther(spentToday),
    remainingToday: formatEther(dailyLimit - spentToday),
    paused: false,
  };
}

export async function listServices() {
  return services;
}

// Không bao giờ throw: lỗi trả về { ok: false, code, message }.
// Thứ tự kiểm tra giống contract: allowlist → perTx → daily.
export async function pay({ to, amount }) {
  const wei = parseEther(amount);

  // Allowlist của mock chỉ có payTo của DataFeed (so sánh không phân biệt hoa thường).
  if (to.toLowerCase() !== DATAFEED_PAYTO.toLowerCase()) {
    return { ok: false, code: "RECIPIENT_NOT_ALLOWED", message: "Người nhận không có trong allowlist" };
  }
  if (wei > perTxLimit) {
    return { ok: false, code: "EXCEEDS_PER_TX", message: "Vượt hạn mức mỗi giao dịch" };
  }
  if (spentToday + wei > dailyLimit) {
    return { ok: false, code: "EXCEEDS_DAILY", message: "Đã hết hạn mức hôm nay" };
  }

  spentToday += wei;
  balance -= wei;
  return { ok: true, txHash: "0xmock" + Date.now().toString(16).padStart(60, "0") };
}
