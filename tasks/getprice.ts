import { task } from "hardhat/config";
import * as config from './config';

//function getTokenPrice(address pairAddress, address sellToken, uint256 sellAmount)

//npx hardhat --network rinkeby  getprice --lp "0x2d44bCC640d07a4a5b3ECa225F5b7c2e71BE87D9" --selltoken "0xa2aaE6F6cBd2D7A8F465eF194f5812d8FbF6899b" --sellamount "1000000000000000000"
task("getprice", "get price")
  .addParam("lp", "lp")
  .addParam("selltoken", "sell token")
  .addParam("sellamount", "sell amount")
  .setAction(async (taskArgs, hre) => {
    const adapter = await hre.ethers.getContractAt("DimaAdapter", config.DimaAdapter);

    let res = await adapter.getTokenPrice(taskArgs.lp, taskArgs.selltoken, taskArgs.sellamount);
    console.log('getprice: ', res);
  });

