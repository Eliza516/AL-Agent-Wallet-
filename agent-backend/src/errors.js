// Mã lỗi cố định theo Interface v1. Không đẩy stack trace hay khóa bí mật ra API.
export const ERROR_MESSAGES = Object.freeze({
  NOT_AGENT: "Ví ký giao dịch không phải agent được cấp quyền.",
  WALLET_PAUSED: "Ví đang bị khóa tạm thời.",
  RECIPIENT_NOT_ALLOWED: "Địa chỉ nhận chưa được cho phép.",
  EXCEEDS_PER_TX: "Số tiền vượt hạn mức mỗi giao dịch.",
  EXCEEDS_DAILY: "Tổng chi tiêu vượt hạn mức 24 giờ.",
  TRANSFER_FAILED: "Không thể chuyển coin tới người nhận.",
  INVALID_INPUT: "Dữ liệu đầu vào không hợp lệ.",
  LLM_UNAVAILABLE: "Dịch vụ AI tạm thời không khả dụng.",
  RPC_ERROR: "Không thể thực hiện yêu cầu với blockchain."
});

const FROM_SOLIDITY = Object.freeze({
  NotAgent: "NOT_AGENT",
  WalletPaused: "WALLET_PAUSED",
  RecipientNotAllowed: "RECIPIENT_NOT_ALLOWED",
  ExceedsPerTxLimit: "EXCEEDS_PER_TX",
  ExceedsDailyLimit: "EXCEEDS_DAILY",
  TransferFailed: "TRANSFER_FAILED"
});

export function toCode(error, contractInterface) {
  const seen = new Set();
  const queue = [error];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    const name = current.revert?.name ?? current.errorName ?? current.name;
    if (typeof name === "string" && FROM_SOLIDITY[name]) return FROM_SOLIDITY[name];
    if (typeof current.code === "string" && current.code in ERROR_MESSAGES) return current.code;
    // ethers v6 đôi khi lồng calldata trong error.info.error.data.
    const data = current.data ?? current.error?.data ?? current.info?.error?.data;
    if (contractInterface && typeof data === "string" && data.startsWith("0x")) {
      try {
        const parsed = contractInterface.parseError(data);
        if (parsed && FROM_SOLIDITY[parsed.name]) return FROM_SOLIDITY[parsed.name];
      } catch { /* Một lỗi RPC có thể không chứa revert data. */ }
    }
    queue.push(current.error, current.cause, current.info?.error);
  }
  return "RPC_ERROR";
}

export function publicError(error, contractInterface) {
  const code = toCode(error, contractInterface);
  return { code, message: ERROR_MESSAGES[code] };
}

export function inputError(message = ERROR_MESSAGES.INVALID_INPUT) {
  return Object.assign(new Error(message), { code: "INVALID_INPUT" });
}
