import { useState } from "react";

// Rút gọn địa chỉ/hash: 0x1234…abcd
export function short(text) {
  return text.length > 12 ? `${text.slice(0, 6)}…${text.slice(-4)}` : text;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Trình duyệt chặn clipboard thì bỏ qua, không làm vỡ trang.
    }
  }

  return (
    <button className="icon-btn" onClick={copy} aria-label={copied ? "Đã chép" : "Chép txHash"} title="Chép txHash">
      {copied ? (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V6a2 2 0 0 1 2-2h9" />
        </svg>
      )}
    </button>
  );
}

export default function PaymentHistory({ payments }) {
  return (
    <section className="card">
      <h2>Lịch sử thanh toán</h2>
      {!payments ? (
        <p className="muted">Đang tải…</p>
      ) : payments.length === 0 ? (
        <p className="muted">Chưa có khoản thanh toán nào.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Người nhận</th>
                <th>Số tiền</th>
                <th>Ref</th>
                <th>txHash</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.txHash}>
                  <td className="mono">{short(p.to)}</td>
                  <td>{p.amount}</td>
                  <td className="mono">{p.ref}</td>
                  <td className="mono">
                    {short(p.txHash)} <CopyButton text={p.txHash} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
