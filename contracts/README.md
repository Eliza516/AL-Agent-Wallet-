# Người 4 — Smart Contract & TrustKeys (Interface v1)

**Phần này chỉ bổ sung thư mục `contracts/`**, không sửa mã của người 1, 2, 3. Hai file `AgentWallet.sol`, `ServiceRegistry.sol` được sao chép NGUYÊN VẸN từ `main` tại thời điểm tạo patch. Smart Contract thanh toán **coin native TrustKeys**, không chuyển token ERC-20 CTK.

## 1. Công nghệ và kiểm thử local

- Node.js >= 18, Hardhat **2**, ethers **6**, Solidity **0.8.24**, OpenZeppelin **5**.
- Các file `.sol` giữ đúng đường dẫn `contracts/AgentWallet.sol` và `contracts/ServiceRegistry.sol` theo tài liệu phân công. `hardhat.config.js` liệt kê nguồn Solidity qua một subtask để Hardhat đọc đúng vị trí thay vì đường dẫn mặc định `contracts/contracts/`.
- Test T1–T10 cho AgentWallet, thêm test ServiceRegistry và các trường hợp bảo mật.

Tại repo Git:

```powershell
cd contracts
npm install
npm run compile
npm test
```

Bật báo cáo gas:

```powershell
$env:REPORT_GAS="true"
npm test
Remove-Item Env:REPORT_GAS
```

Lưu ý: Đây là bài test **trên Hardhat local**. Test local PASS không có nghĩa đã deploy TrustKeys. Không đưa private key vào Git, không test trên mainnet.

## 2. Năm lớp chặn trong `execute`

1. `NotAgent`: người ký giao dịch phải là agent được owner chỉ định.
2. `WalletPaused`: ví bị tạm dừng.
3. `RecipientNotAllowed`: người nhận chưa được owner cho phép.
4. `ExceedsPerTxLimit`: số tiền vượt hạn mức mỗi giao dịch.
5. `ExceedsDailyLimit`: tổng chi vượt cửa sổ 24 giờ.

`spentInWindow` được cập nhật **trước** khi chuyển coin (Checks–Effects–Interactions). Nếu external call thất bại, toàn bộ transaction revert nên cập nhật này cũng được hoàn tác. `receive()` chỉ nhận coin và emit `Deposited`.

## 3. Deploy bằng Remix + MetaMask (chỉ TrustKeys testnet)

1. Chuẩn bị **hai địa chỉ testnet riêng**: `owner` (deploy và quản trị) và `agent` (ký `execute`). Agent cần coin testnet riêng để trả gas; contract cũng cần coin để thanh toán.
2. Mở https://remix.trustkeys.com, thêm chính hai `.sol`, compiler 0.8.24, optimizer bật 200 runs.
3. Mở MetaMask chọn **TrustKeys L1 testnet**: Chain ID `11968`; RPC `https://l1testnet.trustkeys.network`. Trong Remix chọn Injected Provider / MetaMask. Kiểm tra địa chỉ đang kết nối đúng `owner`.
4. Deploy `AgentWallet` constructor: `(agentAddress, 10000000000000000, 50000000000000000)` tương ứng **0.01 coin/lần**, **0.05 coin/24 giờ**. Địa chỉ `agentAddress` là địa chỉ công khai, **không phải private key**.
5. Nạp thử coin testnet vào địa chỉ `AgentWallet` (mở ví owner rồi Send đến địa chỉ contract). Kiểm tra `Deposited` / số dư contract.
6. Chạy `setAllowed(payTo, true)` bằng owner (payTo là địa chỉ dịch vụ B do Người 2 cung cấp). Chỉ sau đó agent mới gọi `execute` thành công.
7. Deploy `ServiceRegistry`, gọi `register("DataFeed", 2000000000000000, payTo)` với giá **0.002 coin**. Kiểm tra `getService(0)`.
8. Lưu **địa chỉ thật** của hai contract và **số block thấp nhất** trong hai giao dịch deploy. Không đưa số block giả vào metadata.
9. Kiểm tra T3/T5 bằng Remix: thử ví không phải agent gọi `execute` => `NotAgent`; ví agent chuyển 0.02 coin tới địa chỉ allowed => `ExceedsPerTxLimit`.

## 4. Tạo shared/deployments.json sau khi deploy

```powershell
Copy-Item .env.example .env
# Mở .env bằng VS Code; điền AGENT_WALLET_ADDRESS, SERVICE_REGISTRY_ADDRESS,
# DEPLOY_BLOCK từ deploy thật. Không đưa key vào .env của contract.
npm run export:deployment
npm run verify:deployment
npm run read:events
```

Script `make-deployments.js` lấy ABI từ artifact Hardhat, đọc `owner()` và `agent()` trên TrustKeys, rồi xuất đúng schema Interface v1. `check-deployment.js` xác nhận mạng, địa chỉ, bytecode và quyền sở hữu. `read-events.js` đọc event `PaymentExecuted` qua RPC, format wei thành chuỗi coin, giải mã ref từ bytes32. **Chỉ khi đã deploy thật mới tạo và commit `shared/deployments.json`** để Người 2 và Người 3 tích hợp.

## 5. Chú ý bảo mật và giới hạn

- **Chưa kiểm toán bảo mật**. Không dùng tiền thật hoặc mainnet.
- Contract v1 không tự chống lặp lại `ref`; extension m2m phải chống replay của `requestId` ở backend dịch vụ B, và xác thực người yêu cầu thanh toán.
- Cửa sổ ngày là **24 giờ tính từ `windowStart`**, không phải 00:00 đến 23:59. `remainingToday()` đọc giá trị mới ngay khi hết hạn, còn `spentInWindow` chỉ reset khi giao dịch `execute` thành công.
- Không suy diễn một lần `sendTransaction()` được txHash là thanh toán thành công; cần `receipt.status === 1` và kiểm tra event.
- Khi sử dụng AI hỗ trợ code, bổ sung ghi nhận vào `docs/ai-declaration.md` và nhật ký đóng góp theo yêu cầu môn.

## 6. Checklist C1–C9

- C1: Remix compile 2 files, signatures không đổi.
- C2: Deploy testnet; `owner`, `agent`, `perTxLimit` đúng.
- C3: Nạp coin cho vault và agent trả gas.
- C4: Owner thêm `payTo` vào allowlist.
- C5: Thử `NotAgent`, `ExceedsPerTxLimit` trên testnet.
- C6: Registry trả `DataFeed` đúng.
- C7: Push `shared/deployments.json` thật cho nhóm.
- C8: Chạy Hardhat T1–T10 và gas report.
- C9: Tự giải thích CEI, mapping + array, immutable, reentrancy.

**Trạng thái khi tạo bộ file này:** chưa có deployment/ABI thực trong repository; Hardhat test được soạn nhưng phải chạy bằng `npm install && npm test` ở máy có khả năng tải npm và compiler. Không đánh dấu C1–C8 PASS trước khi có log thực.
