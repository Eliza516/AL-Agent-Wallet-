const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

async function deployedRegistry() {
  const [owner, provider, stranger, receiver] = await ethers.getSigners();
  const Registry = await ethers.getContractFactory("ServiceRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  return { registry, owner, provider, stranger, receiver };
}

describe("ServiceRegistry — đăng ký và quản lý DataFeed", function () {
  it("register: event và getService có giá, payTo, provider chính xác", async function () {
    const { registry, provider, receiver } = await loadFixture(deployedRegistry);
    const price = ethers.parseEther("0.002");
    await expect(registry.connect(provider).register("DataFeed", price, receiver.address))
      .to.emit(registry, "ServiceRegistered")
      .withArgs(0n, "DataFeed", price, receiver.address, provider.address);
    const service = await registry.getService(0);
    expect(service.name).to.equal("DataFeed");
    expect(service.price).to.equal(price);
    expect(service.payTo).to.equal(receiver.address);
    expect(service.provider).to.equal(provider.address);
    expect(service.active).to.equal(true);
    expect(await registry.serviceCount()).to.equal(1n);
  });

  it("update: chỉ provider được sửa, người ngoài bị NotProvider", async function () {
    const { registry, provider, receiver, stranger } = await loadFixture(deployedRegistry);
    await registry.connect(provider).register("DataFeed", ethers.parseEther("0.002"), receiver.address);
    await expect(registry.connect(stranger).update(0, 1n, false))
      .to.be.revertedWithCustomError(registry, "NotProvider");
    await expect(registry.connect(provider).update(0, ethers.parseEther("0.003"), false))
      .to.emit(registry, "ServiceUpdated")
      .withArgs(0n, ethers.parseEther("0.003"), false);
    const service = await registry.getService(0);
    expect(service.price).to.equal(ethers.parseEther("0.003"));
    expect(service.active).to.equal(false);
  });

  it("getService/update id sai bị UnknownService", async function () {
    const { registry, provider } = await loadFixture(deployedRegistry);
    await expect(registry.getService(9))
      .to.be.revertedWithCustomError(registry, "UnknownService").withArgs(9);
    await expect(registry.connect(provider).update(9, 1n, true))
      .to.be.revertedWithCustomError(registry, "UnknownService").withArgs(9);
  });
});
