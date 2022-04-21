import { ethers, config } from "hardhat";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", owner.address);

  //deploy Adapter
  const factoryAdapter = await ethers.getContractFactory("DimaAdapter");
  const adapter = await factoryAdapter.deploy(process.env.FACTORY_ADDRESS as string, process.env.ROUTER_ADDRESS as string);
  await adapter.deployed();
  console.log("DimaAdapter:", adapter.address);
}

// run
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
