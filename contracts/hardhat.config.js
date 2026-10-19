// Hardhat 2 dùng CommonJS (tách biệt với backend ES modules).
require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");

const path = require("path");
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } = require("hardhat/builtin-tasks/task-names");

// Giữ đúng paths contracts/AgentWallet.sol và contracts/ServiceRegistry.sol theo Interface v1.
// Hardhat mặc định tìm ở contracts/contracts/, nên liệt kê 3 nguồn Solidity rõ ràng.
subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS, async () => [
  path.join(__dirname, "AgentWallet.sol"),
  path.join(__dirname, "ServiceRegistry.sol"),
  path.join(__dirname, "testhelpers", "ReentrantRecipient.sol"),
]);

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: { chainId: 31337 },
    // Chỉ khai báo RPC, không cấu hình khóa deploy. Deploy testnet bằng Remix/MetaMask.
    trustkeys: { url: process.env.RPC_URL || "https://l1testnet.trustkeys.network", chainId: 11968 },
  },
  gasReporter: { enabled: process.env.REPORT_GAS === "true", currency: "USD", coinmarketcap: undefined },
};
