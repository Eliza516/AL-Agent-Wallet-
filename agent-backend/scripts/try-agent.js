// Chạy thử agent với mockChain.
// Dùng:  node scripts/try-agent.js "Mua giá BTC từ DataFeed" [--repeat]
import "dotenv/config";
import * as mockChain from "../src/agent/mockChain.js";
import { runAgent } from "../src/agent/index.js";

const args = process.argv.slice(2);
const repeat = args.includes("--repeat");
const message = args.find((a) => !a.startsWith("--"));

if (!message) {
  console.error('Cách dùng: node scripts/try-agent.js "câu hỏi" [--repeat]');
  process.exit(1);
}

async function ask(history) {
  try {
    const { reply, actions } = await runAgent({ message, history, chain: mockChain });
    console.log("REPLY:", reply);
    console.log("ACTIONS:", JSON.stringify(actions, null, 2));
    return reply;
  } catch (err) {
    // L6: cả hai LLM lỗi thì in mã lỗi, không làm sập chương trình.
    console.log("LỖI:", err.code ?? "UNKNOWN", "-", err.message);
    return null;
  }
}

const reply1 = await ask([]);
if (repeat) {
  console.log("\n--- Lần 2 (cùng câu, cùng mock) ---");
  const history = [{ role: "user", content: message }];
  if (reply1) history.push({ role: "assistant", content: reply1 });
  await ask(history);
}
