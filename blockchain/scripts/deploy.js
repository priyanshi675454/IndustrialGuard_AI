const hre = require("hardhat");

async function main() {
  const MaintenanceLog = await hre.ethers.getContractFactory("MaintenanceLog");
  const contract = await MaintenanceLog.deploy();

  // Wait for deployment (ethers v5)
  await contract.deployed();

  // Get the contract address (ethers v5)
  const address = contract.address;
  console.log("✅ Contract deployed to:", address);
  console.log("📋 Copy this address into backend/server.cjs → CONTRACT_ADDRESS");
}

main().catch(console.error);