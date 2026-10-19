import test from "node:test";
import assert from "node:assert/strict";
import { toCode, publicError } from "../src/errors.js";

test("B2: mapping Solidity custom errors", () => {
  const names = {
    NotAgent: "NOT_AGENT", WalletPaused: "WALLET_PAUSED",
    RecipientNotAllowed: "RECIPIENT_NOT_ALLOWED",
    ExceedsPerTxLimit: "EXCEEDS_PER_TX", ExceedsDailyLimit: "EXCEEDS_DAILY",
    TransferFailed: "TRANSFER_FAILED"
  };
  for (const [name, code] of Object.entries(names)) assert.equal(toCode({ revert: { name } }), code);
});

test("B2: nested errors, RPC error, INVALID_INPUT", () => {
  assert.equal(toCode({ info: { error: { errorName: "ExceedsDailyLimit" } } }), "EXCEEDS_DAILY");
  assert.equal(toCode(new Error("RPC timeout")), "RPC_ERROR");
  assert.equal(publicError({ code: "INVALID_INPUT" }).message, "Dữ liệu đầu vào không hợp lệ.");
});
