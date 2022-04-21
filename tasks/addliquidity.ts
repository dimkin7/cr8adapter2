import { task } from "hardhat/config";
import * as config from './config';

//function addLiquidity(address iTokenA, address iTokenB, uint256 iAmountA, uint256 iAmountB)

//npx hardhat --network rinkeby  addliquidity --tokena "0xeBFB7D54169EeFB884267DCB857c146cD846fa9e" --tokenb "0xa2aaE6F6cBd2D7A8F465eF194f5812d8FbF6899b" --amounta "1000000000000000000000" --amountb "300000000000000000000"
task("addliquidity", "add liquidity")
    .addParam("tokena", "token A")
    .addParam("tokenb", "token B")
    .addParam("amounta", "amount A")
    .addParam("amountb", "amount B")
    .setAction(async (taskArgs, hre) => {
        const adapter = await hre.ethers.getContractAt("DimaAdapter", config.DimaAdapter);

        const tokenA = await hre.ethers.getContractAt("IERC20", taskArgs.tokena);
        await tokenA.approve(config.DimaAdapter, taskArgs.amounta);
        const tokenB = await hre.ethers.getContractAt("IERC20", taskArgs.tokenb);
        await tokenB.approve(config.DimaAdapter, taskArgs.amountb);

        let res = await adapter.addLiquidity(taskArgs.tokena, taskArgs.tokenb, taskArgs.amounta, taskArgs.amountb);
        console.log('addLiquidity: ', res);
    });


