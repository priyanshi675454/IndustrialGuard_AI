const hre = require("hardhat");

async function main() {
  const MaintenanceLog = await hre.ethers.getContractFactory("MaintenanceLog");
  const contract = await MaintenanceLog.deploy();
  await contract.deployed();
  console.log("✅ Contract deployed to:", contract.address);
}

main().catch(console.error);