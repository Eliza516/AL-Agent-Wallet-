// Bảng owner: gọi THẲNG contract bằng MetaMask (chỉ con người mới giữ khóa owner, không đi qua backend).
import { useState } from "react";
import { BrowserProvider, Contract, parseEther, isAddress } from "ethers";
import { USE_MOCK } from "../api.js";
import { CONTRACT_ERROR_MESSAGES } from "../errors.js";
import { short } from "./PaymentHistory.jsx";

const CHAIN_ID = 11968;
const CHAIN_HEX = "0x" + CHAIN_ID.toString(16);

// ABI rút gọn (dạng chữ) chỉ gồm hàm/lỗi bảng này dùng, đúng interface v1.
const ABI = [
  "function owner() view returns (address)",
  "function getAllowed() view returns (address[])",
  "function setLimits(uint256 perTxLimit, uint256 dailyLimit)",
  "function setAllowed(address who, bool ok)",
  "function pause()",
  "function unpause()",
  "error NotOwner()",
  "error NotAgent()",
  "error WalletPaused()",
  "error ZeroAddress()",
  "error RecipientNotAllowed(address to)",
  "error ExceedsPerTxLimit(uint256 amount, uint256 limit)",
  "error ExceedsDailyLimit(uint256 amount, uint256 spent, uint256 limit)",
  "error TransferFailed()",
];

// Đổi lỗi khi gửi giao dịch thành câu tiếng Việt.
function explainTxError(err, contract) {
  if (err.code === "ACTION_REJECTED") return "Bạn đã từ chối ký giao dịch";
  const name = err.revert?.name ?? contract.interface.parseError(err.data ?? err.info?.error?.data)?.name;
  if (name) return CONTRACT_ERROR_MESSAGES[name] ?? `Contract từ chối: ${name}`;
  return err.shortMessage ?? err.message;
}

export default function OwnerPanel({ status, onChanged }) {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [owner, setOwner] = useState(null);
  const [allowed, setAllowed] = useState([]);
  const [message, setMessage] = useState(null); // { type: "error" | "ok", text }
  const [busy, setBusy] = useState(false);

  const [perTx, setPerTx] = useState("");
  const [daily, setDaily] = useState("");
  const [who, setWho] = useState("");

  const isOwner = account && owner && account.toLowerCase() === owner.toLowerCase();

  async function connect() {
    setMessage(null);
    if (!window.ethereum) {
      setMessage({ type: "error", text: "Chưa cài MetaMask. Hãy cài tiện ích MetaMask rồi tải lại trang." });
      return;
    }
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });

      // Sai mạng thì xin chuyển sang TrustKeys; chưa có mạng thì xin thêm mạng.
      try {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
      } catch (err) {
        if (err.code !== 4902) throw err; // 4902 = ví chưa có mạng này
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: CHAIN_HEX,
              chainName: "TrustKeys L1 Testnet",
              rpcUrls: ["https://l1testnet.trustkeys.network"],
              nativeCurrency: { name: "TrustKeys Coin", symbol: "TK", decimals: 18 },
            },
          ],
        });
      }

      // Tạo provider sau khi đã đúng mạng để ethers không báo "network changed".
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const wallet = new Contract(status.wallet, ABI, signer);

      setAccount(await signer.getAddress());
      setContract(wallet);
      setOwner(await wallet.owner());
      setAllowed(await wallet.getAllowed());
    } catch (err) {
      setMessage({ type: "error", text: err.code === 4001 ? "Bạn đã từ chối kết nối" : (err.shortMessage ?? err.message) });
    }
  }

  // Chạy một giao dịch của owner: gửi, chờ xác nhận, rồi làm mới số liệu.
  async function run(label, send) {
    setBusy(true);
    setMessage(null);
    try {
      const tx = await send();
      await tx.wait(); // chờ giao dịch được đưa vào khối
      setAllowed(await contract.getAllowed());
      setMessage({ type: "ok", text: `${label}: thành công` });
      onChanged();
    } catch (err) {
      setMessage({ type: "error", text: explainTxError(err, contract) });
    } finally {
      setBusy(false);
    }
  }

  function submitLimits(event) {
    event.preventDefault();
    let perTxWei, dailyWei;
    try {
      // parseEther đổi "0.01" (coin) thành wei (BigInt) vì contract chỉ hiểu wei.
      perTxWei = parseEther(perTx);
      dailyWei = parseEther(daily);
    } catch {
      setMessage({ type: "error", text: "Hạn mức phải là số, ví dụ 0.01" });
      return;
    }
    run("Đặt hạn mức", () => contract.setLimits(perTxWei, dailyWei));
  }

  function submitAllowed(ok) {
    if (!isAddress(who)) {
      setMessage({ type: "error", text: "Địa chỉ không hợp lệ (0x + 40 ký tự hex)" });
      return;
    }
    run(ok ? "Thêm vào allowlist" : "Xóa khỏi allowlist", () => contract.setAllowed(who, ok));
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Bảng điều khiển owner</h2>
        {account && <span className="badge">{isOwner ? "Owner" : "Chỉ xem"}</span>}
      </div>

      {USE_MOCK && (
        <p className="notice">Đang ở chế độ mock: địa chỉ ví là giả nên giao dịch thật sẽ không chạy được.</p>
      )}

      {!account ? (
        <button className="btn btn-primary" onClick={connect} disabled={!status}>
          Kết nối MetaMask
        </button>
      ) : (
        <p className="muted small mono">Tài khoản: {short(account)}</p>
      )}

      {account && !isOwner && (
        <p className="notice notice-warn">
          Tài khoản này không phải owner ({short(owner ?? "")}). Form bên dưới bị khóa.
        </p>
      )}

      {account && (
        <fieldset disabled={!isOwner || busy} className="owner-forms">
          <form onSubmit={submitLimits}>
            <h3>Đặt hạn mức (coin)</h3>
            <div className="row">
              <label>
                Mỗi giao dịch
                <input value={perTx} onChange={(e) => setPerTx(e.target.value)} placeholder="0.01" inputMode="decimal" />
              </label>
              <label>
                Mỗi ngày
                <input value={daily} onChange={(e) => setDaily(e.target.value)} placeholder="0.05" inputMode="decimal" />
              </label>
            </div>
            <button className="btn btn-primary">Lưu hạn mức</button>
          </form>

          <div>
            <h3>Allowlist người nhận</h3>
            <label>
              Địa chỉ
              <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="0x…" className="mono" />
            </label>
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={() => submitAllowed(true)}>
                Cho phép
              </button>
              <button type="button" className="btn" onClick={() => submitAllowed(false)}>
                Bỏ cho phép
              </button>
            </div>
            <ul className="allowlist mono">
              {allowed.length === 0 && <li className="muted">Chưa có địa chỉ nào.</li>}
              {allowed.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Khóa ví</h3>
            <div className="row">
              <button type="button" className="btn btn-danger" onClick={() => run("Pause", () => contract.pause())}>
                Pause
              </button>
              <button type="button" className="btn" onClick={() => run("Unpause", () => contract.unpause())}>
                Unpause
              </button>
            </div>
          </div>
        </fieldset>
      )}

      {message && (
        <p role="status" className={`notice ${message.type === "error" ? "notice-error" : "notice-ok"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
