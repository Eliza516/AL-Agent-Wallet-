// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AgentWallet - ví có hạn mức cho AI agent (interface v1)
contract AgentWallet is ReentrancyGuard {
    address public immutable owner;
    address public agent;
    uint256 public perTxLimit;
    uint256 public dailyLimit;
    uint256 public windowStart;
    uint256 public spentInWindow;
    bool public paused;
    mapping(address => bool) public isAllowed;
    address[] private allowedList;

    event Deposited(address indexed from, uint256 amount);
    event PaymentExecuted(address indexed to, uint256 amount, bytes32 indexed ref, uint256 spentInWindow);
    event LimitsUpdated(uint256 perTxLimit, uint256 dailyLimit);
    event RecipientSet(address indexed who, bool allowed);
    event AgentChanged(address indexed oldAgent, address indexed newAgent);
    event PausedSet(bool paused);
    event Withdrawn(address indexed to, uint256 amount);

    error NotOwner();
    error NotAgent();
    error WalletPaused();
    error ZeroAddress();
    error RecipientNotAllowed(address to);
    error ExceedsPerTxLimit(uint256 amount, uint256 limit);
    error ExceedsDailyLimit(uint256 amount, uint256 spent, uint256 limit);
    error TransferFailed();

    modifier onlyOwner() { if (msg.sender != owner) revert NotOwner(); _; }
    modifier onlyAgent() { if (msg.sender != agent) revert NotAgent(); _; }

    constructor(address _agent, uint256 _perTxLimit, uint256 _dailyLimit) {
        if (_agent == address(0)) revert ZeroAddress();
        owner = msg.sender;
        agent = _agent;
        perTxLimit = _perTxLimit;
        dailyLimit = _dailyLimit;
        windowStart = block.timestamp;
    }

    receive() external payable { emit Deposited(msg.sender, msg.value); }

    function execute(address payable to, uint256 amount, bytes32 ref) external onlyAgent nonReentrant {
        if (paused) revert WalletPaused();
        if (!isAllowed[to]) revert RecipientNotAllowed(to);
        if (amount > perTxLimit) revert ExceedsPerTxLimit(amount, perTxLimit);
        if (block.timestamp >= windowStart + 1 days) {
            windowStart = block.timestamp;
            spentInWindow = 0;
        }
        if (spentInWindow + amount > dailyLimit) revert ExceedsDailyLimit(amount, spentInWindow, dailyLimit);
        spentInWindow += amount;
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit PaymentExecuted(to, amount, ref, spentInWindow);
    }

    function remainingToday() external view returns (uint256) {
        if (block.timestamp >= windowStart + 1 days) return dailyLimit;
        return spentInWindow >= dailyLimit ? 0 : dailyLimit - spentInWindow;
    }

    function getAllowed() external view returns (address[] memory) { return allowedList; }

    function setLimits(uint256 _perTxLimit, uint256 _dailyLimit) external onlyOwner {
        perTxLimit = _perTxLimit;
        dailyLimit = _dailyLimit;
        emit LimitsUpdated(_perTxLimit, _dailyLimit);
    }

    function setAllowed(address who, bool ok) external onlyOwner {
        if (who == address(0)) revert ZeroAddress();
        if (ok && !isAllowed[who]) allowedList.push(who);
        if (!ok && isAllowed[who]) {
            for (uint256 i = 0; i < allowedList.length; i++) {
                if (allowedList[i] == who) {
                    allowedList[i] = allowedList[allowedList.length - 1];
                    allowedList.pop();
                    break;
                }
            }
        }
        isAllowed[who] = ok;
        emit RecipientSet(who, ok);
    }

    function setAgent(address newAgent) external onlyOwner {
        if (newAgent == address(0)) revert ZeroAddress();
        emit AgentChanged(agent, newAgent);
        agent = newAgent;
    }

    function pause() external onlyOwner { paused = true; emit PausedSet(true); }
    function unpause() external onlyOwner { paused = false; emit PausedSet(false); }

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        (bool ok, ) = payable(owner).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(owner, amount);
    }
}
