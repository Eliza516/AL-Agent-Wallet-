import { useEffect, useRef, useState } from "react";
import { chat } from "../api.js";
import { explainCode } from "../errors.js";
import { short } from "./PaymentHistory.jsx";

// Chip cho mỗi tool agent đã chạy: tên tool, ok hoặc mã lỗi (kèm câu tiếng Việt), txHash nếu có.
function ActionChip({ action }) {
  return (
    <li className={`chip ${action.ok ? "chip-ok" : "chip-fail"}`}>
      <span className="mono">{action.tool}</span>
      {action.ok ? (
        <span>OK</span>
      ) : (
        <span>
          {action.code}: {explainCode(action.code)}
        </span>
      )}
      {action.txHash && <span className="mono">tx {short(action.txHash)}</span>}
    </li>
  );
}

export default function ChatPanel({ onChatDone }) {
  const [messages, setMessages] = useState([]); // { role, content, actions? }
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const bottomRef = useRef(null);

  // Cuộn xuống cuối mỗi khi có tin mới.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, waiting]);

  async function send(event) {
    event.preventDefault(); // chặn form tải lại trang
    const text = input.trim();
    if (!text || waiting) return;

    // history = các câu trước đó, chỉ gồm role và content (đúng interface 2.4).
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages([...messages, { role: "user", content: text }]);
    setInput("");
    setWaiting(true);

    try {
      const result = await chat(text, history);
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply, actions: result.actions }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: explainCode(err.code), actions: [], failed: true },
      ]);
    } finally {
      setWaiting(false);
      onChatDone(); // làm mới đồng hồ + lịch sử ngay sau mỗi câu trả lời
    }
  }

  return (
    <section className="card chat">
      <h2>Chat với agent</h2>

      <div className="messages" aria-live="polite">
        {messages.length === 0 && (
          <p className="muted">Thử: “Ví còn bao nhiêu hạn mức hôm nay?” hoặc “Mua giá BTC từ DataFeed”.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg msg-${m.role} ${m.failed ? "msg-failed" : ""}`}>
            <p>{m.content}</p>
            {m.actions?.length > 0 && (
              <ul className="chips">
                {m.actions.map((a, j) => (
                  <ActionChip key={j} action={a} />
                ))}
              </ul>
            )}
          </div>
        ))}
        {waiting && <div className="msg msg-assistant muted">Agent đang xử lý…</div>}
        <div ref={bottomRef} />
      </div>

      <form className="chat-form" onSubmit={send}>
        <label htmlFor="chat-input" className="sr-only">
          Tin nhắn cho agent
        </label>
        <input
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhập yêu cầu rồi nhấn Enter"
          autoComplete="off"
        />
        <button className="btn btn-primary" disabled={waiting || !input.trim()}>
          Gửi
        </button>
      </form>
    </section>
  );
}
