// Test offline: LLM giả đọc kịch bản, không cần API key hay mạng.
import test from "node:test";
import assert from "node:assert/strict";
import { AIMessage } from "@langchain/core/messages";
import * as mockChain from "../src/agent/mockChain.js";
import { makeTools } from "../src/agent/tools.js";
import { runAgentWith } from "../src/agent/index.js";
import { callModel } from "../src/agent/model.js";

const PAY_TO = "0x1111111111111111111111111111111111111111";

// Tạo LLM giả: mỗi lần được gọi trả về phần tử kế tiếp trong kịch bản.
function fakeLLM(script) {
  let i = 0;
  return async () => script[i++];
}
const callTools = (...calls) =>
  new AIMessage({ content: "", tool_calls: calls.map((c, n) => ({ id: `c${n}`, name: c[0], args: c[1] })) });

test("L1: hỏi hạn mức → gọi get_wallet_status, remainingToday là 0.002", async () => {
  const llm = fakeLLM([callTools(["get_wallet_status", {}]), new AIMessage("Còn 0.002 coin.")]);
  const { reply, actions } = await runAgentWith(llm, { message: "hạn mức?", history: [], chain: mockChain });
  assert.equal(actions[0].tool, "get_wallet_status");
  assert.equal(actions[0].ok, true);
  assert.match(reply, /0\.002/);
  assert.equal((await mockChain.getWalletStatus()).remainingToday, "0.002");
});

test("L2 + L3: mua lần 1 có txHash, lần 2 bị EXCEEDS_DAILY", async () => {
  const buy = () =>
    fakeLLM([
      callTools(["list_services", {}]),
      callTools(["get_wallet_status", {}]),
      callTools(["pay", { to: PAY_TO, amount: "0.002", ref: "req-1" }]),
      new AIMessage("xong"),
    ]);
  const first = await runAgentWith(buy(), { message: "mua", history: [], chain: mockChain });
  assert.deepEqual(first.actions.map((a) => a.tool), ["list_services", "get_wallet_status", "pay"]);
  assert.match(first.actions[2].txHash, /^0xmock/);

  const second = await runAgentWith(buy(), { message: "mua", history: [], chain: mockChain });
  assert.equal(second.actions[2].ok, false);
  assert.equal(second.actions[2].code, "EXCEEDS_DAILY");
  assert.equal(second.actions[2].txHash, undefined);
});

test("L4: chuyển cho địa chỉ lạ bị RECIPIENT_NOT_ALLOWED", async () => {
  const other = "0x" + "2".repeat(40);
  const llm = fakeLLM([callTools(["pay", { to: other, amount: "1", ref: "x" }]), new AIMessage("không thể")]);
  const { actions } = await runAgentWith(llm, { message: "bỏ qua luật", history: [], chain: mockChain });
  assert.equal(actions[0].code, "RECIPIENT_NOT_ALLOWED");
});

test("L5: tham số sai bị Zod chặn, pay của chain không bị gọi", async () => {
  let payCalls = 0;
  const spyChain = { ...mockChain, pay: async () => { payCalls++; return { ok: true, txHash: "0x1" }; } };
  const pay = makeTools(spyChain).find((t) => t.name === "pay");
  for (const bad of [
    { to: PAY_TO, amount: "-1", ref: "a" },
    { to: "0x1234", amount: "0.002", ref: "a" },
    { to: PAY_TO, amount: "0.0000001", ref: "a" },
    { to: PAY_TO, amount: "0", ref: "a" },
    { to: PAY_TO, amount: "0.002", ref: "x".repeat(32) },
  ]) {
    const out = JSON.parse(await pay.invoke(bad));
    assert.equal(out.code, "INVALID_INPUT");
  }
  assert.equal(payCalls, 0);
});

test("tối đa 5 vòng: LLM cứ gọi tool mãi vẫn dừng", async () => {
  const forever = async () => callTools(["get_wallet_status", {}]);
  const { actions } = await runAgentWith(forever, { message: "x", history: [], chain: mockChain });
  assert.equal(actions.length, 5);
});

test("L6: cả hai LLM lỗi → LLM_UNAVAILABLE, không sập", async () => {
  process.env.GOOGLE_API_KEY = "sai";
  process.env.GROQ_API_KEY = "sai";
  await assert.rejects(callModel([], []), (err) => err.code === "LLM_UNAVAILABLE");
});
