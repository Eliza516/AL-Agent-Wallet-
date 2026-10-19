// 4 hàm gọi backend theo interface 2.4. Nếu VITE_USE_MOCK=true thì dùng dữ liệu giả.
import { mockStatus, mockPayments, mockServices, mockChat } from "./mockData.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

// Lỗi có thêm trường code để UI dịch sang tiếng Việt.
function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function request(path, options) {
  let res;
  try {
    res = await fetch(API_URL + path, options);
  } catch {
    // fetch ném lỗi khi server tắt hoặc sai địa chỉ/CORS.
    throw makeError("BACKEND_DOWN", "Không kết nối được backend");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // Lỗi HTTP luôn có dạng { error: { code, message } }.
    throw makeError(body?.error?.code ?? "RPC_ERROR", body?.error?.message ?? "Lỗi từ backend");
  }
  return body;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getStatus() {
  if (USE_MOCK) return mockStatus();
  return request("/api/status");
}

export async function getPayments() {
  if (USE_MOCK) return [...mockPayments];
  return request("/api/payments");
}

export async function getServices() {
  if (USE_MOCK) return mockServices;
  return request("/api/services");
}

export async function chat(message, history) {
  if (USE_MOCK) {
    await wait(900); // giả lập thời gian chờ để thấy trạng thái "đang chờ"
    return mockChat();
  }
  return request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
}
