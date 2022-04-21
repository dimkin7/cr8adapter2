import { task } from "hardhat/config";
import * as config from './config';

//function createPair(address tokenA, address tokenB)

//npx hardhat --network rinkeby  createpair --tokena "0xeBFB7D54169EeFB884267DCB857c146cD846fa9e" --tokenb "0xa2aaE6F6cBd2D7A8F465eF194f5812d8FbF6899b"
task("createpair", "create Pair")
  .addParam("tokena", "token A")
  .addParam("tokenb", "token B")
  .setAction(async (taskArgs, hre) => {
    const adapter = await hre.ethers.getContractAt("DimaAdapter", config.DimaAdapter);

    let res = await adapter.createPair(taskArgs.tokena, taskArgs.tokenb);
    console.log('createPair: ', res);
  });

