// Đồng hồ hạn mức: số dư, đã chi / hạn mức ngày, còn lại, hạn mức mỗi giao dịch, trạng thái pause.
export default function LimitMeter({ status }) {
  if (!status) {
    return (
      <section className="card" aria-busy="true">
        <h2>Hạn mức</h2>
        <p className="muted">Đang tải…</p>
      </section>
    );
  }

  // Number chỉ dùng để vẽ thanh tiến độ; số hiển thị vẫn là chuỗi gốc từ backend.
  const percent = Math.min(100, (Number(status.spentToday) / Number(status.dailyLimit)) * 100 || 0);
  const level = percent >= 100 ? "full" : percent >= 80 ? "warn" : "ok";

  return (
    <section className="card">
      <div className="card-head">
        <h2>Hạn mức</h2>
        {status.paused && <span className="badge badge-danger">Đang khóa</span>}
      </div>

      <p className="big">
        {status.remainingToday} <span className="unit">coin còn lại hôm nay</span>
      </p>

      <div
        className="meter"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-label="Đã chi so với hạn mức ngày"
      >
        <div className={`meter-fill meter-${level}`} style={{ width: `${percent}%` }} />
      </div>
      <p className="muted small">
        Đã chi {status.spentToday} / {status.dailyLimit} coin
      </p>

      <dl className="facts">
        <div>
          <dt>Số dư ví</dt>
          <dd>{status.balance}</dd>
        </div>
        <div>
          <dt>Tối đa mỗi giao dịch</dt>
          <dd>{status.perTxLimit}</dd>
        </div>
      </dl>
    </section>
  );
}
