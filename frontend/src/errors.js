// Bảng dịch mã lỗi chung (mục 2.7) sang câu tiếng Việt cho người dùng.
export const ERROR_MESSAGES = {
  NOT_AGENT: "Khóa agent không khớp với contract",
  WALLET_PAUSED: "Ví đang bị khóa tạm",
  RECIPIENT_NOT_ALLOWED: "Người nhận không có trong allowlist",
  EXCEEDS_PER_TX: "Vượt hạn mức mỗi giao dịch",
  EXCEEDS_DAILY: "Đã hết hạn mức hôm nay",
  TRANSFER_FAILED: "Người nhận từ chối tiền",
  INVALID_INPUT: "Tham số không hợp lệ",
  LLM_UNAVAILABLE: "AI tạm thời không trả lời được",
  RPC_ERROR: "Không kết nối được TrustKeys",
  BACKEND_DOWN: "Không kết nối được backend",
};

export function explainCode(code) {
  return ERROR_MESSAGES[code] ?? `Lỗi không rõ (${code})`;
}

// Tên custom error của contract (bảng owner gọi thẳng contract) → câu tiếng Việt.
export const CONTRACT_ERROR_MESSAGES = {
  NotOwner: "Tài khoản này không phải owner của ví",
  NotAgent: "Chỉ khóa agent mới được chi tiền",
  WalletPaused: "Ví đang bị khóa tạm",
  ZeroAddress: "Địa chỉ không được để trống (0x000…)",
  RecipientNotAllowed: "Người nhận không có trong allowlist",
  ExceedsPerTxLimit: "Vượt hạn mức mỗi giao dịch",
  ExceedsDailyLimit: "Đã hết hạn mức hôm nay",
  TransferFailed: "Người nhận từ chối tiền",
};
