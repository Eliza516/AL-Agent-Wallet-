// Blockchain giả cho B1 và LLM agent phát triển độc lập (không có giao dịch thật).
const RECIPIENT = "0x1111111111111111111111111111111111111111";
const DAY_LIMIT = 50_000_000_000_000_000n; // 0.05 coin
const TX_LIMIT = 10_000_000_000_000_000n;  // 0.01 coin
const BASE_BALANCE = 950_000_000_000_000_000n;

let spentWei = 48_000_000_000_000_000n; // 0.048 coin
let balanceWei = BASE_BALANCE;
let counter = 0;
const payments = [];

// Dùng số nguyên để mock không mắc lỗi 0.1 + 0.2 của JavaScript.
function asWei(value) {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, "0") || "0");
}
function asCoin(wei) {
  const whole = wei / 10n ** 18n;
  const fract = (wei % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return fract ? `${whole}.${fract}` : `${whole}.0`;
}

export async function getWalletStatus() {
  return {
    wallet: "0x0000000000000000000000000000000000000003",
    owner: "0x0000000000000000000000000000000000000001",
    agent: "0x0000000000000000000000000000000000000002",
    balance: asCoin(balanceWei),
    perTxLimit: "0.01",
    dailyLimit: "0.05",
    spentToday: asCoin(spentWei),
    remainingToday: asCoin(spentWei >= DAY_LIMIT ? 0n : DAY_LIMIT - spentWei),
    paused: false
  };
}

export async function listServices() {
  return [{ id: 0, name: "DataFeed", price: "0.002", payTo: RECIPIENT, active: true }];
}

export async function pay({ to, amount, ref }) {
  if (typeof to !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(to) ||
      typeof ref !== "string" || !/^[\x20-\x7e]{1,31}$/.test(ref)) {
    return { ok: false, code: "INVALID_INPUT", message: "Địa chỉ hoặc mã ref không hợp lệ." };
  }
  const wei = asWei(amount);
  if (wei === null || wei <= 0n) return { ok: false, code: "INVALID_INPUT", message: "Số tiền không hợp lệ." };
  if (to.toLowerCase() !== RECIPIENT.toLowerCase()) return { ok: false, code: "RECIPIENT_NOT_ALLOWED", message: "Ngoài allowlist." };
  if (wei > TX_LIMIT) return { ok: false, code: "EXCEEDS_PER_TX", message: "Vượt hạn mức mỗi lần." };
  if (spentWei + wei > DAY_LIMIT) return { ok: false, code: "EXCEEDS_DAILY", message: "Hết hạn mức 24 giờ." };
  if (wei > balanceWei) return { ok: false, code: "TRANSFER_FAILED", message: "Không đủ số dư." };
  spentWei += wei;
  balanceWei -= wei;
  counter += 1;
  const txHash = `0xmock${counter}`; // Đánh dấu rõ ràng đây KHÔNG phải transaction hash thật.
  payments.unshift({ to, amount, ref, txHash, blockNumber: counter });
  return { ok: true, txHash };
}

export async function listPayments() { return payments.map((item) => ({ ...item })); }

export async function buyData() {
  return { ok: false, code: "RPC_ERROR", message: "M2M chỉ chạy khi kết nối blockchain thật." };
}

// Chỉ dùng trong unit test, không expose qua REST API.
export function resetMock() { spentWei = 48_000_000_000_000_000n; balanceWei = BASE_BALANCE; counter = 0; payments.length = 0; }
