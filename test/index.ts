import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { IUniswapV2Factory, IUniswapV2Router02, TestERC20, IUniswapV2Pair } from '../typechain'

const MIN_LIQUIDITY = 10 ** 3; // UniswapV2Pair minimum liqudity

describe("Adapter", function () {

  let adapter: Contract;
  let router: IUniswapV2Router02;
  let factory: IUniswapV2Factory;
  let tokenTST: TestERC20;
  let tokenACDM: TestERC20;
  let tokenPOP: TestERC20;
  let tokenETH: TestERC20;
  let pair1: IUniswapV2Pair;
  let owner: SignerWithAddress;

  before(async function () {
    [owner] = await ethers.getSigners();

    factory = <IUniswapV2Factory>(await ethers.getContractAt("IUniswapV2Factory", process.env.FACTORY_ADDRESS as string));
    router = <IUniswapV2Router02>(await ethers.getContractAt("IUniswapV2Router02", process.env.ROUTER_ADDRESS as string));

    //create adapter
    const fAdapter = await ethers.getContractFactory("DimaAdapter");
    adapter = await fAdapter.deploy(factory.address, router.address);
    await adapter.deployed();

    // deploy erc20 tokens
    const fToken = await ethers.getContractFactory("TestERC20");
    tokenTST = <TestERC20>(await fToken.deploy("TST", "TST", ethers.utils.parseEther("100000")));
    await tokenTST.deployed();
    tokenACDM = <TestERC20>(await fToken.deploy("ACDM", "ACDM", ethers.utils.parseEther("100000")));
    await tokenACDM.deployed();
    tokenPOP = <TestERC20>(await fToken.deploy("POP", "POP", ethers.utils.parseEther("100000")));
    await tokenPOP.deployed();
    tokenETH = <TestERC20>(await fToken.deploy("ETH", "ETH", ethers.utils.parseEther("100000")));
    await tokenETH.deployed();

  });

  it("Create pairs", async function () {
    //-Создать через адаптер несколько пар (TST/ACDM, ACDM/POP, ETH/POP)
    await adapter.createPair(tokenTST.address, tokenACDM.address);
    await adapter.createPair(tokenACDM.address, tokenPOP.address);
    await adapter.createPair(tokenETH.address, tokenPOP.address);
  });


  it("approve", async function () {
    await tokenTST.approve(adapter.address, ethers.constants.MaxUint256);
    await tokenACDM.approve(adapter.address, ethers.constants.MaxUint256);
    await tokenPOP.approve(adapter.address, ethers.constants.MaxUint256);
    await tokenETH.approve(adapter.address, ethers.constants.MaxUint256);
  });


  it("Add liqidity 1", async function () {
    await adapter.addLiquidity(tokenTST.address, tokenACDM.address, ethers.utils.parseEther("1000"), ethers.utils.parseEther("300"));

    pair1 = <IUniswapV2Pair>(await ethers.getContractAt(
      "IUniswapV2Pair", await adapter.getPair(tokenTST.address, tokenACDM.address)));

    let lpToken1 = await pair1.balanceOf(owner.address)

    console.log(lpToken1);
    console.log(ethers.utils.parseUnits(Math.sqrt(1000 * 300).toString(), await pair1.decimals()));
    console.log(MIN_LIQUIDITY);

    //TODO тут не проходит 
    // uniswap liquidity calcucalted, k = sqrt(a*b)
    expect(lpToken1).to.be.eq(
      ethers.utils.parseUnits(Math.sqrt(1000 * 300).toString(), await pair1.decimals()).sub(MIN_LIQUIDITY)
    );
  });


  it("Get token price 1", async function () {
    let price = await adapter.getTokenPrice(pair1.address, tokenACDM.address, ethers.utils.parseEther("3"));
    //console.log(price);
    expect(price).to.be.eq(
      ethers.utils.parseEther("10")
    );

    price = await adapter.getTokenPrice(pair1.address, tokenTST.address, ethers.utils.parseEther("10"));
    //console.log(price);
    expect(price).to.be.eq(
      ethers.utils.parseEther("3")
    );
  });




  // -Добавить/удалить ликвидность к этим парам через адаптер.
  // -Получить цену пары через адаптер 
  // -Обменять пару через адаптер 
  // -Обменять пару TST/POP используя путь - нет прямого пула - функция ~getpath


});
