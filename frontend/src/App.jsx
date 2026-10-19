import { useCallback, useEffect, useState } from "react";
import { getStatus, getPayments, USE_MOCK } from "./api.js";
import { explainCode } from "./errors.js";
import ChatPanel from "./components/ChatPanel.jsx";
import LimitMeter from "./components/LimitMeter.jsx";
import PaymentHistory from "./components/PaymentHistory.jsx";
import OwnerPanel from "./components/OwnerPanel.jsx";

const REFRESH_MS = 15000;

export default function App() {
  const [status, setStatus] = useState(null);
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState(null); // mã lỗi khi không tải được số liệu

  // Tải lại đồng hồ + lịch sử. Lỗi thì hiện banner, không làm trắng trang.
  const refresh = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([getStatus(), getPayments()]);
      setStatus(s);
      setPayments(p);
      setError(null);
    } catch (err) {
      setError(err.code ?? "RPC_ERROR");
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_MS); // tự làm mới mỗi 15 giây
    return () => clearInterval(timer); // dọn timer khi rời trang
  }, [refresh]);

  return (
    <div className="page">
      <header className="top">
        <h1>AgentWallet</h1>
        <p className="muted">AI agent tự trả tiền, nhưng mọi khoản chi đều bị smart contract giới hạn.</p>
        {USE_MOCK && <span className="badge">Mock</span>}
      </header>

      {error && (
        <div className="banner" role="alert">
          {explainCode(error)}. Số liệu bên dưới có thể đã cũ; trang sẽ tự thử lại.
        </div>
      )}

      <main className="layout">
        <ChatPanel onChatDone={refresh} />
        <div className="side">
          <LimitMeter status={status} />
          <PaymentHistory payments={payments} />
          <OwnerPanel status={status} onChanged={refresh} />
        </div>
      </main>
    </div>
  );
}
