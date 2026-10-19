# AgentWallet — AI Agent with Wallet

Đồ án cuối kỳ Blockchain, đề tài 12. Người dùng chat với một AI agent; agent tự quyết định trả tiền, nhưng **mọi khoản chi phải đi qua smart contract `AgentWallet`** trên TrustKeys L1 testnet. Nếu LLM bị lừa (prompt injection) hoặc tính sai, contract vẫn chặn. LLM không bao giờ giữ khóa.

> **Chỉ dùng testnet.** Không dùng khóa hoặc tiền thật. Chưa kiểm toán bảo mật.

## Contract chặn 5 lớp (theo đúng thứ tự)

| # | Lớp | Lỗi khi vi phạm |
|---|---|---|
| 1 | Người gọi phải là khóa agent | `NotAgent` |
| 2 | Ví chưa bị pause | `WalletPaused` |
| 3 | Người nhận có trong allowlist | `RecipientNotAllowed` |
| 4 | `amount <= perTxLimit` | `ExceedsPerTxLimit` |
| 5 | Tổng chi trong cửa sổ 24h `<= dailyLimit` | `ExceedsDailyLimit` |

Owner (con người, MetaMask) đặt hạn mức, allowlist, đổi khóa agent, pause. Extension nhóm chọn: **m2m payment** (kiểu x402): dịch vụ B trả HTTP 402 kèm `{price, payTo, requestId}`, agent trả qua `execute`, dùng lại `requestId` thì bị 409.

## Cấu trúc repo

```text
agent-backend/          Người 1 + 2 (Node.js, ES modules)
  src/agent/            Người 1: LLM agent (system prompt, tool, vòng lặp, Gemini + Groq dự phòng, mockChain)
  src/server.js, chain.js, errors.js   Người 2: Express, module chain (ethers v6), REST API
  service-b/            Người 2: dịch vụ B trả 402 (extension)
  scripts/try-agent.js  chạy thử agent với chain giả
frontend/               Người 3: React + Vite (chat, đồng hồ hạn mức, lịch sử, bảng owner)
contracts/              Người 4: Hardhat 2 + test T1–T10 (nhánh `contracts`)
shared/deployments.json Người 4 tạo SAU khi deploy thật (địa chỉ + ABI)
docs/                   tài liệu phân công, bảng pass/fail, khai báo AI
AgentWallet.sol, ServiceRegistry.sol   bản tham chiếu của interface v1
CLAUDE.md               quy ước và interface chung v1 (không tự đổi)
```

## Chạy thử ngay trên máy (chế độ mock, không cần ví hay khóa)

Yêu cầu: Node.js ≥ 18.

```bash
git clone https://github.com/Eliza516/AL-Agent-Wallet-.git
cd AL-Agent-Wallet-

# Terminal 1 — backend (http://localhost:3001)
cd agent-backend
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
npm start

# Terminal 2 — frontend (http://localhost:5173)
cd frontend
npm install
cp .env.example .env
npm run dev
```

- `frontend/.env`: `VITE_USE_MOCK=true` là dữ liệu giả hoàn toàn trong trình duyệt; đổi thành `false` để giao diện gọi backend ở `VITE_API_URL`.
- `agent-backend/.env`: mặc định `CHAIN_MODE=mock` (chain giả, số liệu giả `remainingToday = 0.002`).
- **Chat với LLM thật** cần `GOOGLE_API_KEY` (Gemini) và/hoặc `GROQ_API_KEY` trong `agent-backend/.env`. Khóa chỉ nằm trong `.env` (đã git-ignore), không commit, không dán vào chat. Thiếu khóa thì `/api/chat` trả mã `LLM_UNAVAILABLE`.
- Thử agent không cần server: `cd agent-backend && node scripts/try-agent.js "Mua giá BTC từ DataFeed" --repeat`.

## Kiểm thử

```bash
cd agent-backend && npm test        # agent, mock chain, mã lỗi
cd frontend && npm run build        # kiểm tra frontend biên dịch được
cd contracts && npm install && npm test   # Hardhat T1–T10 (nhánh `contracts`; cần mạng để tải trình biên dịch solc)
REPORT_GAS=true npm test            # kèm bảng gas (PowerShell: $env:REPORT_GAS="true")
```

## Chế độ thật trên TrustKeys (chỉ khi đã có contract)

1. Người 4 deploy bằng Remix + MetaMask trên mạng `chainId 11968` (RPC `https://l1testnet.trustkeys.network`), sau đó chạy `npm run export:deployment` trong `contracts/` để tạo `shared/deployments.json`.
2. Nạp coin cho `AgentWallet` (tiền để trả) và cho tài khoản agent (tiền **gas** riêng).
3. Owner gọi `setAllowed(payTo, true)`.
4. Trong `agent-backend/.env` đặt `CHAIN_MODE=real` và điền `AGENT_PRIVATE_KEY` (khóa testnet của agent, chỉ ở máy bạn).
5. Chỉ chạy localhost: API chat chưa có xác thực người dùng, **không deploy công khai**.

## Interface chung v1

Tên hàm, JSON, mã lỗi nằm trong [`CLAUDE.md`](CLAUDE.md) và `docs/`. Không tự đổi; cần đổi thì cả nhóm thống nhất rồi tăng lên v2.

REST API (gốc `http://localhost:3001`): `POST /api/chat`, `GET /api/status`, `GET /api/payments`, `GET /api/services`. Mã lỗi chung: `NOT_AGENT`, `WALLET_PAUSED`, `RECIPIENT_NOT_ALLOWED`, `EXCEEDS_PER_TX`, `EXCEEDS_DAILY`, `TRANSFER_FAILED`, `INVALID_INPUT`, `LLM_UNAVAILABLE`, `RPC_ERROR`.

## Trạng thái hiện tại

| Phần | Người | Trạng thái |
|---|---|---|
| LLM agent (mock) | 1 | Có; 6 test offline qua. Chưa chạy với Gemini/Groq thật |
| Backend | 2 | Có; mock chạy được, 4 endpoint đúng định dạng. Chế độ real chưa thử vì chưa có `deployments.json` |
| Frontend | 3 | Có; chạy mock và với backend mock. Bảng owner (MetaMask) chưa thử với contract thật |
| Contract + test | 4 | Có trên nhánh `contracts` (chưa gộp `main`); 15 test Hardhat qua. **Chưa deploy**, chưa có `shared/deployments.json` |

Các mốc ghép I0–I8 và checklist L/B/U/C xem `docs/AgentWallet Pass_Fail Board.md`. Chỉ đánh dấu PASS các mục chạy trên chuỗi thật khi có txHash thật.

## Quy tắc làm việc

- Mỗi người một nhánh (`llm`, `backend`, `ui`, `contracts`); gộp vào `main` qua pull request do người khác duyệt.
- Dùng AI được nhưng phải khai báo trong [`docs/ai-declaration.md`](docs/ai-declaration.md); mọi thành viên phải giải thích được mọi dòng code khi vấn đáp.
- Khóa bí mật chỉ ở `.env` (đã git-ignore); chỉ commit `.env.example`.
