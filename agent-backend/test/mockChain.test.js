import test from "node:test";
import assert from "node:assert/strict";
import * as chain from "../src/mockChain.js";

const ALLOWED = "0x1111111111111111111111111111111111111111";
test("B1: mock status trả string và hạn mức 0.002", async () => {
  chain.resetMock();
  const status = await chain.getWalletStatus();
  assert.equal(status.remainingToday, "0.002");
  assert.equal(status.perTxLimit, "0.01");
  assert.equal(status.paused, false);
  assert.equal(typeof status.balance, "string");
  assert.equal((await chain.listServices())[0].payTo, ALLOWED);
  assert.deepEqual(await chain.listPayments(), []);
});

test("B1: pay hợp lệ và vượt hạn mức ngày", async () => {
  chain.resetMock();
  const result = await chain.pay({ to: ALLOWED, amount: "0.002", ref: "req-17" });
  assert.equal(result.ok, true);
  assert.match(result.txHash, /^0xmock/);
  assert.equal((await chain.getWalletStatus()).remainingToday, "0.0");
  assert.equal((await chain.listPayments()).length, 1);
  const repeat = await chain.pay({ to: ALLOWED, amount: "0.002", ref: "req-18" });
  assert.deepEqual([repeat.ok, repeat.code], [false, "EXCEEDS_DAILY"]);
});

test("B1: thứ tự allowlist → per-tx → daily", async () => {
  chain.resetMock();
  assert.equal((await chain.pay({ to: "0x2222222222222222222222222222222222222222", amount: "0.02", ref: "r" })).code, "RECIPIENT_NOT_ALLOWED");
  assert.equal((await chain.pay({ to: ALLOWED, amount: "0.02", ref: "r" })).code, "EXCEEDS_PER_TX");
  assert.equal((await chain.pay({ to: ALLOWED, amount: "-1", ref: "r" })).code, "INVALID_INPUT");
});
