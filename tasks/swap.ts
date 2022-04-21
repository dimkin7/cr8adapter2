import { task } from "hardhat/config";
import * as config from './config';

//function swapToken( address pairAddress, address sellToken, uint256 sellAmount, uint256 buyAmountMin) 

//npx hardhat --network rinkeby  swap --lp "0x2d44bCC640d07a4a5b3ECa225F5b7c2e71BE87D9" --selltoken "0xa2aaE6F6cBd2D7A8F465eF194f5812d8FbF6899b" --sellamount "1000000000000000000"  --minbuy "3312325372013674554"
task("swap", "swap token")
  .addParam("lp", "lp")
  .addParam("selltoken", "sell token")
  .addParam("sellamount", "sell amount")
  .addParam("minbuy", "minbuy")
  .setAction(async (taskArgs, hre) => {
    const adapter = await hre.ethers.getContractAt("DimaAdapter", config.DimaAdapter);

    const selltoken = await hre.ethers.getContractAt("IERC20", taskArgs.selltoken);
    await selltoken.approve(config.DimaAdapter, taskArgs.sellamount);

    let res = await adapter.swapToken(taskArgs.lp, taskArgs.selltoken, taskArgs.sellamount, taskArgs.minbuy);
    console.log('swap: ', res);
  });

