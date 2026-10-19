// Dữ liệu giả đúng định dạng mục 2.4, dùng khi VITE_USE_MOCK=true.
const WALLET = "0x00000000000000000000000000000000000000AA";

let spentToday = 0.048;
let paused = false;
let chatCount = 0;

export function mockStatus() {
  return {
    wallet: WALLET,
    owner: "0x00000000000000000000000000000000000000B1",
    agent: "0x00000000000000000000000000000000000000C2",
    balance: "0.95",
    perTxLimit: "0.01",
    dailyLimit: "0.05",
    spentToday: spentToday.toFixed(3),
    remainingToday: (0.05 - spentToday).toFixed(3),
    paused,
  };
}

export const mockPayments = [
  {
    to: "0x1111111111111111111111111111111111111111",
    amount: "0.002",
    ref: "req-17",
    txHash: "0xa1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
    blockNumber: 1204,
  },
  {
    to: "0x1111111111111111111111111111111111111111",
    amount: "0.002",
    ref: "req-16",
    txHash: "0x0f9e8d7c6b5a49382716f5e4d3c2b1a00f9e8d7c6b5a49382716f5e4d3c2b1a0",
    blockNumber: 1180,
  },
];

export const mockServices = [
  {
    id: 0,
    name: "DataFeed",
    price: "0.002",
    payTo: "0x1111111111111111111111111111111111111111",
    active: true,
  },
];

// Lần chat đầu: trả tiền thành công. Các lần sau: hết hạn mức → có cả action lỗi để thử giao diện.
export function mockChat() {
  chatCount += 1;
  if (chatCount === 1) {
    spentToday = 0.05;
    mockPayments.unshift({
      to: mockServices[0].payTo,
      amount: "0.002",
      ref: "req-18",
      txHash: "0xdeadbeef00000000000000000000000000000000000000000000000000000001",
      blockNumber: 1230,
    });
    return {
      reply: "Đã mua dữ liệu BTC từ DataFeed với giá 0.002 coin.",
      actions: [
        { tool: "list_services", args: {}, ok: true },
        { tool: "get_wallet_status", args: {}, ok: true },
        {
          tool: "pay",
          args: { to: mockServices[0].payTo, amount: "0.002", ref: "req-18" },
          ok: true,
          txHash: "0xdeadbeef00000000000000000000000000000000000000000000000000000001",
        },
      ],
    };
  }
  return {
    reply: "Hôm nay đã hết hạn mức nên tôi chưa trả được. Bạn thử lại vào ngày mai.",
    actions: [
      { tool: "get_wallet_status", args: {}, ok: true },
      { tool: "pay", args: { to: mockServices[0].payTo, amount: "0.002", ref: "req-19" }, ok: false, code: "EXCEEDS_DAILY" },
    ],
  };
}
