// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgentWallet {
    function execute(address payable to, uint256 amount, bytes32 ref) external;
}

/// @dev Contract nhận tiền và thử gọi ngược execute() để kiểm thử T9.
contract ReentrantRecipient {
    IAgentWallet public immutable wallet;
    bool public attempted;
    bool public reentered;

    constructor(address walletAddress) { wallet = IAgentWallet(walletAddress); }

    receive() external payable {
        attempted = true;
        // Nếu được gọi lại thành công, reentered sẽ là true (đây là lỗi).
        try wallet.execute(payable(address(this)), 1, bytes32("reenter")) {
            reentered = true;
        } catch { /* Contract AgentWallet bắt buộc phải chặn lần gọi này. */ }
    }
}
