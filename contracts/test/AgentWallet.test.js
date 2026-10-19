const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

const coin = (value) => ethers.parseEther(value);
const ref = (value) => ethers.encodeBytes32String(value);

async function deployedWallet() {
  const [owner, agent, alice, bob, stranger] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory("AgentWallet");
  const wallet = await Factory.connect(owner).deploy(agent.address, coin("0.01"), coin("0.05"));
  await wallet.waitForDeployment();
  await owner.sendTransaction({ to: await wallet.getAddress(), value: coin("0.3") });
  await wallet.connect(owner).setAllowed(alice.address, true);
  return { wallet, owner, agent, alice, bob, stranger };
}

describe("AgentWallet — interface v1, kiểm thử T1–T10", function () {
  it("T1: nạp coin phát event Deposited", async function () {
    const { wallet, bob } = await loadFixture(deployedWallet);
    const amount = coin("0.01");
    await expect(bob.sendTransaction({ to: await wallet.getAddress(), value: amount }))
      .to.emit(wallet, "Deposited").withArgs(bob.address, amount);
    expect(await ethers.provider.getBalance(await wallet.getAddress())).to.equal(coin("0.31"));
  });

  it("T2: agent thanh toán đúng hạn mức, event PaymentExecuted đúng tham số", async function () {
    const { wallet, agent, alice } = await loadFixture(deployedWallet);
    const amount = coin("0.002");
    const reference = ref("req-17");
    const oldBalance = await ethers.provider.getBalance(alice.address);
    await expect(wallet.connect(agent).execute(alice.address, amount, reference))
      .to.emit(wallet, "PaymentExecuted").withArgs(alice.address, amount, reference, amount);
    expect(await ethers.provider.getBalance(alice.address)).to.equal(oldBalance + amount);
    expect(await wallet.remainingToday()).to.equal(coin("0.048"));
  });

  it("T3: người không phải agent bị NotAgent", async function () {
    const { wallet, stranger, alice } = await loadFixture(deployedWallet);
    await expect(wallet.connect(stranger).execute(alice.address, coin("0.001"), ref("r3")))
      .to.be.revertedWithCustomError(wallet, "NotAgent");
  });

  it("T4: người nhận không thuộc allowlist bị RecipientNotAllowed", async function () {
    const { wallet, agent, bob } = await loadFixture(deployedWallet);
    await expect(wallet.connect(agent).execute(bob.address, coin("0.001"), ref("r4")))
      .to.be.revertedWithCustomError(wallet, "RecipientNotAllowed").withArgs(bob.address);
  });

  it("T5: vượt hạn mức mỗi giao dịch bị ExceedsPerTxLimit", async function () {
    const { wallet, agent, alice } = await loadFixture(deployedWallet);
    await expect(wallet.connect(agent).execute(alice.address, coin("0.02"), ref("r5")))
      .to.be.revertedWithCustomError(wallet, "ExceedsPerTxLimit")
      .withArgs(coin("0.02"), coin("0.01"));
  });

  it("T6: vượt hạn mức 24h bị chặn; 86400s sau được chi lại", async function () {
    const { wallet, agent, alice } = await loadFixture(deployedWallet);
    for (let i = 0; i < 5; i++) {
      await wallet.connect(agent).execute(alice.address, coin("0.01"), ref(`daily-${i}`));
    }
    expect(await wallet.remainingToday()).to.equal(0n);
    await expect(wallet.connect(agent).execute(alice.address, coin("0.001"), ref("over-day")))
      .to.be.revertedWithCustomError(wallet, "ExceedsDailyLimit")
      .withArgs(coin("0.001"), coin("0.05"), coin("0.05"));
    await time.increase(86400);
    await expect(wallet.connect(agent).execute(alice.address, coin("0.001"), ref("new-day")))
      .to.emit(wallet, "PaymentExecuted");
    expect(await wallet.spentInWindow()).to.equal(coin("0.001"));
    expect(await wallet.remainingToday()).to.equal(coin("0.049"));
  });

  it("T7: pause chặn chi; unpause mở lại", async function () {
    const { wallet, owner, agent, alice } = await loadFixture(deployedWallet);
    await expect(wallet.connect(owner).pause()).to.emit(wallet, "PausedSet").withArgs(true);
    await expect(wallet.connect(agent).execute(alice.address, coin("0.001"), ref("paused")))
      .to.be.revertedWithCustomError(wallet, "WalletPaused");
    await expect(wallet.connect(owner).unpause()).to.emit(wallet, "PausedSet").withArgs(false);
    await expect(wallet.connect(agent).execute(alice.address, coin("0.001"), ref("unpaused")))
      .to.emit(wallet, "PaymentExecuted");
  });

  it("T8: không phải owner không thể thực hiện các thao tác quản trị", async function () {
    const { wallet, stranger, bob } = await loadFixture(deployedWallet);
    const calls = [
      () => wallet.connect(stranger).setLimits(coin("0.01"), coin("0.05")),
      () => wallet.connect(stranger).setAllowed(bob.address, true),
      () => wallet.connect(stranger).setAgent(bob.address),
      () => wallet.connect(stranger).pause(),
      () => wallet.connect(stranger).unpause(),
      () => wallet.connect(stranger).withdraw(coin("0.001")),
    ];
    for (const call of calls) {
      await expect(call()).to.be.revertedWithCustomError(wallet, "NotOwner");
    }
  });

  it("T9: người nhận độc hại thử reentrancy nhưng không thể chi thêm", async function () {
    const { wallet, owner, agent } = await loadFixture(deployedWallet);
    const Malicious = await ethers.getContractFactory("ReentrantRecipient");
    const malicious = await Malicious.deploy(await wallet.getAddress());
    await malicious.waitForDeployment();
    await wallet.connect(owner).setAllowed(await malicious.getAddress(), true);
    await expect(wallet.connect(agent).execute(await malicious.getAddress(), coin("0.002"), ref("reentry")))
      .to.emit(wallet, "PaymentExecuted");
    expect(await malicious.attempted()).to.equal(true);
    expect(await malicious.reentered()).to.equal(false);
    expect(await wallet.spentInWindow()).to.equal(coin("0.002"));
    expect(await ethers.provider.getBalance(await malicious.getAddress())).to.equal(coin("0.002"));
  });

  it("T10: 30 thao tác giả ngẫu nhiên có seed; spentInWindow không vượt dailyLimit", async function () {
    const { wallet, agent, alice } = await loadFixture(deployedWallet);
    let seed = 20261019;
    let success = 0;
    let rejected = 0;
    for (let i = 0; i < 30; i++) {
      if (i > 0 && i % 10 === 0) await time.increase(86401);
      seed = (seed * 48271) % 2147483647;
      const amount = BigInt((seed % 12) + 1) * coin("0.001");
      try {
        await (await wallet.connect(agent).execute(alice.address, amount, ref(`fuzz-${i}`))).wait();
        success++;
      } catch {
        rejected++;
      }
      expect(await wallet.spentInWindow()).to.be.lte(await wallet.dailyLimit());
    }
    expect(success).to.be.greaterThan(0);
    expect(rejected).to.be.greaterThan(0);
  });

  it("Extra: owner đổi agent, allowlist và rút coin đều có event", async function () {
    const { wallet, owner, agent, alice, bob } = await loadFixture(deployedWallet);
    await expect(wallet.connect(owner).setAgent(bob.address))
      .to.emit(wallet, "AgentChanged").withArgs(agent.address, bob.address);
    await wallet.connect(owner).setAllowed(bob.address, true);
    await wallet.connect(owner).setAllowed(alice.address, false);
    expect(await wallet.isAllowed(alice.address)).to.equal(false);
    expect(await wallet.getAllowed()).to.deep.equal([bob.address]);
    await expect(wallet.connect(owner).withdraw(coin("0.01")))
      .to.emit(wallet, "Withdrawn").withArgs(owner.address, coin("0.01"));
  });

  it("Extra: constructor và setAllowed không nhận địa chỉ 0", async function () {
    const { wallet, owner, agent } = await loadFixture(deployedWallet);
    const Factory = await ethers.getContractFactory("AgentWallet");
    await expect(Factory.deploy(ethers.ZeroAddress, coin("0.01"), coin("0.05")))
      .to.be.revertedWithCustomError(wallet, "ZeroAddress");
    await expect(wallet.connect(owner).setAllowed(ethers.ZeroAddress, true))
      .to.be.revertedWithCustomError(wallet, "ZeroAddress");
    await expect(wallet.connect(owner).setAgent(ethers.ZeroAddress))
      .to.be.revertedWithCustomError(wallet, "ZeroAddress");
  });
});
