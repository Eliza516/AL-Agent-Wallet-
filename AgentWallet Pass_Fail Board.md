AgentWallet · Đề tài 12 · nhóm 4 người · interface v1

# Bảng flow pass/fail

Một câu chat đi qua 4 phần của 4 người. Mỗi chỗ bàn giao là một cổng G1–G10: qua cổng thì phần sau mới có dữ liệu đúng. Cổng nào FAIL, cột cuối bảng dưới cho biết ai sửa.

**Người 3**UI

**Người 2**Backend

**Người 1**LLM

**Người 4**Contract

## Hành trình của một yêu cầu “Mua giá BTC từ DataFeed” nét liền = gọi / ghi · nét đứt = đọc / trả kết quả · cam = owner

## 10 cổng: thế nào là PASS, FAIL thường do đâu, ai sửa

| Cổng | Bàn giao | PASS khi | FAIL thường do | Ai sửa |
| --- | --- | --- | --- | --- |
| G1 | UI → Backend | JSON đúng mục 2.4, trả 200 | server chưa chạy, sai `VITE_API_URL`, CORS | **3****2** |
| G2 | Backend → LLM | `runAgent` trả `{reply, actions}` | thiếu API key; Gemini 429 mà không chuyển Groq | **1** |
| G3 | LLM → tool | đúng tool, tham số qua Zod | LLM bịa địa chỉ, số tiền → `INVALID_INPUT` | **1** |
| G4 | Backend đọc chuỗi | số đọc được khớp với Remix | sai RPC, sai địa chỉ hoặc ABI trong `deployments.json` | **2****4** |
| G5 | Backend ghi chuỗi | giao dịch gửi đi, có txHash | khóa agent không khớp (`NOT_AGENT`); agent hết coin trả gas (`RPC_ERROR`) | **2****4** |
| G6 | 5 lớp chặn | đúng luật thì chuyển, sai luật thì revert đúng error | revert là FAIL có chủ đích; chặn sai luật mới là lỗi contract | **4** |
| G7 | Chuỗi → Backend | revert đổi sang mã 2.7; thành công có txHash sau `tx.wait()` | không đọc `err.revert.name`; server sập khi revert | **2** |
| G8 | LLM viết trả lời | trả lời khớp actions; không nói “đã trả” khi không có txHash | LLM bịa kết quả; system prompt thiếu luật | **1** |
| G9 | Backend → UI | đồng hồ hạn mức và lịch sử khớp `queryFilter` | sai `deployBlock`; UI không tự làm mới | **3****2** |
| G10 | Owner → chuỗi | setLimits, setAllowed, pause chạy; agent thấy ngay | MetaMask sai mạng 11968; tài khoản không phải owner (`NOT_OWNER`) | **3****4** |

AGENTWALLET · FLOW PASS/FAIL · 1 / 2

## Thứ tự ghép I0 → I8 mốc trước chưa PASS thì chưa sang mốc sau · tick bằng bút khi in

I0**1****2****3****4**

### Chốt interface v1

cả 4 đọc mục 2, không còn câu hỏi

PassFail

I1**4**

### Contract lên TrustKeys

C1–C7

`deployments.json` có trên Git

PassFail

I2**2****4**

### Backend đọc được chuỗi

B2 · cổng G4

`/api/status` khớp Remix

PassFail

I3**1**

### Agent chạy với mock

L1–L6 · cổng G2, G3, G8

đủ 6 mục PASS

PassFail

I4**1****2**

### Agent trả tiền thật

B5, L2–L4 với chain thật · G5–G7

có txHash thật; vượt hạn mức bị chặn đúng mã

PassFail

I5**3****2**

### UI dùng API thật

U3 · cổng G1, G9

chat → trả tiền → đồng hồ, lịch sử tự cập nhật

PassFail

I6**3****4**

### Owner điều khiển

U4–U6 · cổng G10

pause trên UI làm agent nhận `WALLET_PAUSED`

PassFail

I7**1****2****4**

### Extension m2m

B6 + tool `buy_data`

agent tự mua dữ liệu; dùng lại requestId bị 409

PassFail

I8**1****2****3****4**

### Tập demo + vấn đáp

demo ≤ 5 phút, đọc chéo code

có video dự phòng; ai cũng giải thích được phần người khác

PassFail

## Checklist từng người chi tiết lệnh thử nằm trong doc phân công

### Người 1 · LLMchạy với mockChain

- `L1`Hỏi hạn mức → gọi get_wallet_status, đúng 0.002
- `L2`Mua DataFeed → list → status → pay đúng payTo
- `L3`Lặp lại → EXCEEDS_DAILY, không nói “đã trả”
- `L4`Prompt injection → không bao giờ báo thành công
- `L5`Tham số sai bị Zod chặn
- `L6`Gemini lỗi → Groq; cả hai lỗi → LLM_UNAVAILABLE
- `L7`Tự giải thích: ai chạy tool, bindTools, temperature 0

### Người 2 · Backendmock trước, real sau

- `B1`Mock: 4 endpoint đúng định dạng 2.4
- `B2`Real: /api/status khớp Remix
- `B3`pay 0.001 → txHash, có trong /payments
- `B4`pay 0.02 → EXCEEDS_PER_TX, không sập
- `B5`Ghép runAgent thật, số liệu thật
- `B6`Dịch vụ B: 402 → 200 → 409
- `B7`Không có khóa thật trong Git
- `B8`Tự giải thích: gas của agent, tx.wait, replay

### Người 3 · UIVITE_USE_MOCK trước

- `U1`Mock: đủ 4 khu vực
- `U2`Chat + chip lỗi tiếng Việt đúng bảng 2.7
- `U3`API thật, tự cập nhật sau khi trả tiền
- `U4`Sai mạng → đề nghị chuyển 11968
- `U5`Owner set, pause được; người khác bị khóa form
- `U6`Pause → WALLET_PAUSED hiện rõ
- `U7`Backend tắt → banner; vừa màn hình điện thoại
- `U8`Tự giải thích: owner gọi thẳng contract, parseEther

### Người 4 · ContractRemix + Hardhat

- `C1`Remix biên dịch, khớp interface 2.2
- `C2`Deploy; owner, agent, perTx đúng
- `C3`Nạp coin cho ví và cho tài khoản agent
- `C4`setAllowed; getAllowed đúng
- `C5`Thử tay: 0.02 → ExceedsPerTx; owner → NotAgent
- `C6`ServiceRegistry + DataFeed
- `C7`deployments.json trên Git
- `C8`Hardhat T1–T10 qua, có bảng gas
- `C9`Tự giải thích: CEI, mảng + mapping, immutable

## Mã lỗi chung thấy mã nào thì biết hỏi ai

`NOT_AGENT`khóa agent không khớp · 2, 4

`WALLET_PAUSED`owner đang khóa ví · đúng luật

`RECIPIENT_NOT_ALLOWED`chưa có trong allowlist · 4

`EXCEEDS_PER_TX`vượt hạn mức mỗi lần · đúng luật

`EXCEEDS_DAILY`hết hạn mức hôm nay · đúng luật

`TRANSFER_FAILED`người nhận từ chối coin · 4

`INVALID_INPUT`LLM đưa tham số sai · 1

`LLM_UNAVAILABLE`Gemini và Groq cùng lỗi · 1

`RPC_ERROR`mạng, hết gas, sai RPC · 2, 4

#### Bài thử FAIL có chủ đích

Chạy lại cùng yêu cầu khi đã hết hạn mức. Kỳ vọng G6 FAIL đúng chỗ (`ExceedsDailyLimit`), tiền không rời ví, còn G7–G9 vẫn PASS: người dùng thấy lời giải thích tiếng Việt. Đây là cảnh nên có trong video demo.

#### Khi một cổng FAIL

Người phụ trách cổng đó sửa; người kia chạy lại đúng mục checklist đã FAIL rồi mới đi tiếp. Muốn đổi interface thì cả nhóm đồng ý, sửa mục 2 của doc phân công, tăng lên v2.

#### Trước vấn đáp

Mỗi người trả lời được câu “tự giải thích” cuối checklist của cả 4 người, không chỉ của mình.

AGENTWALLET · FLOW PASS/FAIL · 2 / 2