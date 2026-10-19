# Người 2 — Backend AgentWallet (Interface v1)

Phần code trong thư mục này thuộc vai trò **Backend + Blockchain integration**, không thay đổi interface chung của nhóm (`CLAUDE.md`, mục Interface v1).

## Cài và chạy

Yêu cầu Node.js >=18. Chạy từ thư mục `agent-backend/`:

```bash
npm install
cp .env.example .env   # Windows PowerShell: Copy-Item .env.example .env
npm start
npm test
```

Mặc định `CHAIN_MODE=mock`: mở http://127.0.0.1:3001/api/status. `POST /api/chat` trả `echo:` nếu Người 1 chưa đưa `src/agent/index.js`. Khi Người 1 có file đó, server tự động gọi `runAgent({ message, history, chain })`.

Thử 4 endpoint (PowerShell):

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/status
Invoke-RestMethod http://127.0.0.1:3001/api/services
Invoke-RestMethod http://127.0.0.1:3001/api/payments
Invoke-RestMethod -Uri http://127.0.0.1:3001/api/chat -Method POST -ContentType 'application/json' -Body '{"message":"Ví còn bao nhiêu?","history":[]}'
```

**Chế độ REAL**: chỉ bật khi Người 4 đã cung cấp `../shared/deployments.json` thật và ví agent testnet có coin trả gas. Điền `AGENT_PRIVATE_KEY` vào **.env local** (KHÔNG commit, KHÔNG dán vào chatbot). `chain.js` kiểm tra chainId=11968, dùng ethers v6 để đọc state, gọi `execute` bằng ví agent, đợi `tx.wait()` và đọc event `PaymentExecuted`.

**Cảnh báo:** API chat có thể dẫn đến lệnh chi tiền khi AI thật được tích hợp. Interface v1 chưa có xác thực người yêu cầu: **chỉ chạy localhost**, không deploy API này công khai trước khi cả nhóm duyệt giải pháp xác thực + xác nhận thanh toán.

## API chuẩn v1

| Endpoint | Kết quả |
| --- | --- |
| POST `/api/chat` | `{reply, actions}` |
| GET `/api/status` | `{wallet, owner, agent, balance, perTxLimit, dailyLimit, spentToday, remainingToday, paused}` |
| GET `/api/payments` | `[{to, amount, ref, txHash, blockNumber}]` mới nhất trước |
| GET `/api/services` | `[{id, name, price, payTo, active}]` |

Số tiền qua HTTP luôn là **string coin** (ví dụ `"0.002"`); trên chain `chain.js` dùng `parseEther/formatEther`. `ref` ASCII tối đa 31 ký tự, chuyển `bytes32` bằng `encodeBytes32String`.

## Extension B6 (dịch vụ B)

Đặt `SERVICE_B_PAY_TO` là địa chỉ dịch vụ, cần được Người 4 `setAllowed` và `register("DataFeed", 0.002 coin, payTo)`. Chạy `npm run service-b` trên cổng 4000. `GET /btc-price` không có header → HTTP 402 `{price,payTo,requestId}`. Gửi thanh toán thật bằng `chain.buyData(0)`; gọi lại với `X-Request-Id` sau khi xác minh event → HTTP 200 và dữ liệu BTC **giả lập**; dùng lại requestId → 409. `CHAIN_MODE=mock` không tự chấp nhận thanh toán giả, chỉ thử luồng 402.

Mô hình đang giữ quote trong RAM (restart sẽ làm mất requestId), chỉ dùng để demo testnet, không phải production x402 chuẩn đầy đủ.

## Checklist & bàn giao

- **B1**: 4 endpoint mock, schema đúng; trả `0.002` remaining.
- **B2**: Real `/api/status` khớp Remix. Cần deployments.json.
- **B3**: Real `pay` 0.001 → txHash + PaymentExecuted trong `/payments`.
- **B4**: Real `pay` 0.02 → `EXCEEDS_PER_TX`, server không crash.
- **B5**: Người 1 merge agent module → chat gọi runAgent thật.
- **B6**: 402 → 200 → 409 bằng testnet; cần contract và service address.
- **B7**: Không commit `.env` / khóa / API key.
- **B8**: Giải thích gas của ví agent; `tx.wait()` là receipt; replay là tái sử dụng bằng chứng thanh toán.

Lưu ý: **KHÔNG** được đánh dấu B2–B6 là PASS trước khi có testnet thật. `npm test` đang test module mock và mã lỗi; muốn kiểm chứng server cần chạy `npm install` và thử API local.

## Nhật ký AI (ghi vào docs/ai-declaration.md khi nhóm tích hợp)

2026-10-19: ChatGPT hỗ trợ soạn `agent-backend/src/server.js`, `chain.js`, `errors.js`, `mockChain.js`, `service-b/server.js`, tests và README. Nhóm phải đọc, kiểm tra và giải thích được từng file trước oral defense.
