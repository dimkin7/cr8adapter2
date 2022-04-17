import * as dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
//tasks
require("./tasks/index.ts");

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.6.2',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: '0.8.11',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  networks: {

    rinkeby: {
      chainId: 4,
      url: process.env.RENKEBY_URL || '',
      accounts: { mnemonic: process.env.MNEMONIC, }
    },

    //workaround for coverage error: InvalidInputError: Transaction gasPrice (1) is too low for the next block, which has a baseFeePerGas of 875000000
    hardhat: {
      initialBaseFeePerGas: 0,
      forking: {
        url: process.env.RENKEBY_URL || '',
        blockNumber: 10509242
      }
    },


  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
