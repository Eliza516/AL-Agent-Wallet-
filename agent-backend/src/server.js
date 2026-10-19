import "dotenv/config";
import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { inputError, publicError } from "./errors.js";

const isMock = (process.env.CHAIN_MODE ?? "mock") === "mock";
if (!isMock && process.env.CHAIN_MODE !== "real") throw new Error("CHAIN_MODE phải là mock hoặc real.");
const chain = await import(isMock ? "./mockChain.js" : "./chain.js");

// Chờ Người 1 đưa src/agent/index.js. Không giả vờ giao dịch thành công.
async function loadAgent() {
  if (existsSync(fileURLToPath(new URL("./agent/index.js", import.meta.url)))) {
    const module = await import("./agent/index.js");
    if (typeof module.runAgent !== "function") throw new Error("src/agent/index.js phải export runAgent().");
    return module.runAgent;
  }
  if (!isMock) return async () => { throw Object.assign(new Error("LLM chưa được tích hợp"), { code: "LLM_UNAVAILABLE" }); };
  return async ({ message }) => ({ reply: `echo: ${message}`, actions: [] });
}
const runAgent = await loadAgent();

export function createApp({ chainModule = chain, agentRunner = runAgent } = {}) {
  const app = express();
  app.use(cors({ origin: "http://localhost:5173" }));
  app.use(express.json({ limit: "32kb" }));
  // JSON không hợp lệ cũng phải tuân theo format lỗi v1, không trả HTML.
  app.use((error, _req, res, next) => {
    if (error instanceof SyntaxError && "body" in error) {
      return res.status(400).json({ error: { code: "INVALID_INPUT", message: "JSON không hợp lệ." } });
    }
    next(error);
  });

  const route = (fn) => async (req, res) => {
    try { res.json(await fn(req)); }
    catch (error) {
      const { code, message } = publicError(error);
      const status = code === "INVALID_INPUT" ? 400 : code === "LLM_UNAVAILABLE" ? 503 : 502;
      res.status(status).json({ error: { code, message } });
    }
  };

  app.post("/api/chat", route(async ({ body }) => {
    const { message, history = [] } = body || {};
    if (typeof message !== "string" || !message.trim() || message.length > 2000 ||
        !Array.isArray(history) || history.length > 20 ||
        !history.every((x) => x && (x.role === "user" || x.role === "assistant") &&
          typeof x.content === "string" && x.content.length <= 2000)) throw inputError();
    const result = await agentRunner({ message, history, chain: chainModule });
    // Không đưa private key, các lỗi nội bộ hay stack trace qua API.
    if (!result || typeof result.reply !== "string" || !Array.isArray(result.actions)) throw inputError();
    for (const a of result.actions) console.log("Agent tool:", a.tool, a.ok ? "OK" : a.code || "FAIL");
    return { reply: result.reply, actions: result.actions };
  }));
  app.get("/api/status", route(() => chainModule.getWalletStatus()));
  app.get("/api/payments", route(() => chainModule.listPayments()));
  app.get("/api/services", route(() => chainModule.listServices()));
  app.use((_req, res) => res.status(404).json({ error: { code: "INVALID_INPUT", message: "Không tìm thấy API." } }));
  return app;
}

// Mặc định chỉ mở localhost, tránh public endpoint tự ký và gửi tiền testnet.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const PORT = Number(process.env.PORT || 3001);
  const HOST = process.env.HOST || "127.0.0.1";
  createApp().listen(PORT, HOST, () => console.log(`Backend: http://${HOST}:${PORT} (CHAIN_MODE=${isMock ? "mock" : "real"})`));
}
