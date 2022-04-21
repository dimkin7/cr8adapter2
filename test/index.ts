import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { IUniswapV2Factory, IUniswapV2Router02, TestERC20, IUniswapV2Pair, IERC20 } from '../typechain'
import { BigNumber } from 'ethers';
import bn from 'bignumber.js';

const MIN_LIQUIDITY = 10 ** 3; // UniswapV2Pair minimum liqudity

function sqrt(value: BigNumber): BigNumber {
  return BigNumber.from(new bn(value.toString()).sqrt().toFixed().split('.')[0])
}

describe("Adapter", function () {

  let adapter: Contract;
  let router: IUniswapV2Router02;
  let factory: IUniswapV2Factory;
  let TST: TestERC20;
  let ACDM: TestERC20;
  let POP: TestERC20;
  let pair1: IUniswapV2Pair; // TST/ACDM
  let pair2: IUniswapV2Pair; // ACDM/POP
  let pair3: IUniswapV2Pair; // ETH/POP
  let owner: SignerWithAddress;
  let trader: SignerWithAddress;
  let WETHaddr: string;
  let WETH: IERC20;

  before(async function () {
    [owner, trader] = await ethers.getSigners();

    factory = <IUniswapV2Factory>(await ethers.getContractAt("IUniswapV2Factory", process.env.FACTORY_ADDRESS as string));
    router = <IUniswapV2Router02>(await ethers.getContractAt("IUniswapV2Router02", process.env.ROUTER_ADDRESS as string));

    //create adapter
    const fAdapter = await ethers.getContractFactory("DimaAdapter");
    adapter = await fAdapter.deploy(factory.address, router.address);
    await adapter.deployed();

    // deploy erc20 tokens
    const fToken = await ethers.getContractFactory("TestERC20");
    TST = <TestERC20>(await fToken.deploy("TST", "TST", ethers.utils.parseEther("10000")));
    await TST.deployed();
    ACDM = <TestERC20>(await fToken.deploy("ACDM", "ACDM", ethers.utils.parseEther("10000")));
    await ACDM.deployed();
    POP = <TestERC20>(await fToken.deploy("POP", "POP", ethers.utils.parseEther("10000")));
    await POP.deployed();

    WETHaddr = await router.WETH();
    WETH = <IERC20>(await ethers.getContractAt("IERC20", WETHaddr));
  });

  it("Create pairs", async function () {
    //-Создать через адаптер несколько пар (TST/ACDM, ACDM/POP, ETH/POP)
    await adapter.createPair(TST.address, ACDM.address);
    await adapter.createPair(ACDM.address, POP.address);
    await adapter.createPair(WETHaddr, POP.address);
  });

  //для ликвидности
  it("approve for liquidity", async function () {
    await TST.approve(adapter.address, ethers.utils.parseEther("10000"));
    await ACDM.approve(adapter.address, ethers.utils.parseEther("10000"));
    await POP.approve(adapter.address, ethers.utils.parseEther("10000"));
  });

  //для трейдера
  it("give tokens to trader", async function () {
    await TST.transfer(trader.address, ethers.utils.parseEther("1000"));
    await ACDM.transfer(trader.address, ethers.utils.parseEther("1000"));
    await POP.transfer(trader.address, ethers.utils.parseEther("1000"));

    await TST.connect(trader).approve(adapter.address, ethers.utils.parseEther("1000"));
    await ACDM.connect(trader).approve(adapter.address, ethers.utils.parseEther("1000"));
    await POP.connect(trader).approve(adapter.address, ethers.utils.parseEther("1000"));
  });


  // -Добавить/удалить ликвидность к этим парам через адаптер.
  it("Add liqidity 1000 TST : 300 ACDM", async function () {
    await adapter.addLiquidity(TST.address, ACDM.address, ethers.utils.parseEther("1000"), ethers.utils.parseEther("300"));

    pair1 = <IUniswapV2Pair>(await ethers.getContractAt(
      "IUniswapV2Pair", await adapter.getPair(TST.address, ACDM.address)));

    let LP1 = await pair1.balanceOf(owner.address)
    console.log("LP1:", ethers.utils.formatUnits(LP1, 18));

    // uniswap liquidity calcucalted, k = sqrt(a*b)
    let lpCalc = sqrt(ethers.utils.parseEther("1000").mul(ethers.utils.parseEther("300")));

    expect(LP1).to.be.eq(lpCalc.sub(MIN_LIQUIDITY));
  });

  it("Add liqidity 2000 ACDM : 1000 POP", async function () {
    await adapter.addLiquidity(ACDM.address, POP.address,
      ethers.utils.parseEther("2000"), ethers.utils.parseEther("1000"));

    pair2 = <IUniswapV2Pair>(await ethers.getContractAt(
      "IUniswapV2Pair", await adapter.getPair(ACDM.address, POP.address)));

    let lpToken2 = await pair2.balanceOf(owner.address)
    // uniswap liquidity calcucalted, k = sqrt(a*b)
    let lpCalc = sqrt(ethers.utils.parseEther("2000").mul(ethers.utils.parseEther("1000")));

    expect(lpToken2).to.be.eq(lpCalc.sub(MIN_LIQUIDITY));
  });


  //ETH/POP
  it("Add liqidity 5000 POP : 10 ETH", async function () {
    let ETH = await owner.getBalance()
    console.log("ETH before:", ethers.utils.formatUnits(ETH, 18));

    await adapter.addLiquidityETH(POP.address, ethers.utils.parseEther("5000"), { value: ethers.utils.parseEther("10") });

    ETH = await owner.getBalance()
    console.log("ETH after:", ethers.utils.formatUnits(ETH, 18));


    pair3 = <IUniswapV2Pair>(await ethers.getContractAt(
      "IUniswapV2Pair", await adapter.getPair(WETHaddr, POP.address)));

    let lpToken3 = await pair3.balanceOf(owner.address)
    // uniswap liquidity calcucalted, k = sqrt(a*b)
    let lpCalc = sqrt(ethers.utils.parseEther("5000").mul(ethers.utils.parseEther("10")));

    expect(lpToken3).to.be.eq(lpCalc.sub(MIN_LIQUIDITY));



  });



  it("Get token price and swap 10 TST for ~2.96 ACDM", async function () {
    // -Получить цену пары через адаптер 
    let priceTST = await adapter.getTokenPrice(pair1.address, ACDM.address,
      ethers.utils.parseEther("3"));
    console.log("TST price:", ethers.utils.formatUnits(priceTST, 18));

    let priceACDM = await adapter.getTokenPrice(pair1.address, TST.address, ethers.utils.parseEther("10"));
    console.log("ACDM price:", ethers.utils.formatUnits(priceACDM, 18));

    // баланс до обмена
    let TSTbeg = await TST.balanceOf(trader.address)
    console.log("TST beg:", ethers.utils.formatUnits(TSTbeg, 18));
    let ACDMbeg = await ACDM.balanceOf(trader.address)
    console.log("ACDM beg:", ethers.utils.formatUnits(ACDMbeg, 18));

    // -Обменять пару через адаптер 
    await adapter.connect(trader).swapToken(pair1.address, TST.address,
      ethers.utils.parseEther("10"), priceACDM);

    // баланс после обмена
    let TSTend = await TST.balanceOf(trader.address)
    console.log("TST end:", ethers.utils.formatUnits(TSTend, 18));
    //ожидаем, что уменьшилось 10 TST
    expect(TSTend).to.be.eq(TSTbeg.sub(ethers.utils.parseEther("10")));

    let ACDMend = await ACDM.balanceOf(trader.address)
    console.log("ACDM end:", ethers.utils.formatUnits(ACDMend, 18));
    //ожидаем, что добавилось 2,96 ACDM
    expect(ACDMend).to.be.eq(ACDMbeg.add(priceACDM));
  });


  // -Обменять пару TST/POP используя путь - нет прямого пула
  //есть пары (TST/ACDM, ACDM/POP, ETH/POP)
  it("Swap 10 TST = 3 ACDM = 1.5 POP", async function () {
    //баланс трейдера до
    let TSTbeg = await TST.balanceOf(trader.address)
    console.log("TST beg:", ethers.utils.formatUnits(TSTbeg, 18));
    let POPbeg = await POP.balanceOf(trader.address)
    console.log("POP beg:", ethers.utils.formatUnits(POPbeg, 18));

    //путь
    let path = [TST.address, ACDM.address, POP.address];

    //стоимость
    let pricePOP_TST = await adapter.getPathPrice(
      path, ethers.utils.parseEther("10"));
    console.log("POP_TST price:", ethers.utils.formatUnits(pricePOP_TST, 18));

    //обмен
    await adapter.connect(trader).swapWithPath(path, ethers.utils.parseEther("10"), 1);
    TST
    //проверки
    let TSTend = await TST.balanceOf(trader.address)
    console.log("TST end:", ethers.utils.formatUnits(TSTend, 18));
    //ожидаем, что уменьшилось 10 TST
    expect(TSTend).to.be.eq(TSTbeg.sub(ethers.utils.parseEther("10")));

    let POPend = await POP.balanceOf(trader.address)
    console.log("POP end:", ethers.utils.formatUnits(POPend, 18));
    //ожидаем, что добавилось 1,44 POP
    expect(POPend).to.be.eq(POPbeg.add(pricePOP_TST));
  });

  it("Get reserves pair1", async function () {
    let [reserve0, reserve1] = await adapter.getReserves(pair1.address);
    console.log("pair1 reserves:",
      ethers.utils.formatUnits(reserve0, 18), ethers.utils.formatUnits(reserve1, 18));
  });

  it("removeLiquidity pair1", async function () {
    let LP1beg = await pair1.balanceOf(owner.address)
    console.log("LP1 beg:", ethers.utils.formatUnits(LP1beg, 18));
    let TSTbeg = await TST.balanceOf(owner.address)
    console.log("TST beg:", ethers.utils.formatUnits(TSTbeg, 18));
    let ACDMbeg = await ACDM.balanceOf(owner.address)
    console.log("ACDM beg:", ethers.utils.formatUnits(ACDMbeg, 18));

    await pair1.approve(adapter.address, LP1beg);

    await adapter.removeLiquidity(pair1.address, LP1beg);

    let LP1end = await pair1.balanceOf(owner.address)
    console.log("LP1 end:", ethers.utils.formatUnits(LP1end, 18));
    let TSTend = await TST.balanceOf(owner.address)
    console.log("TST end:", ethers.utils.formatUnits(TSTend, 18));
    let ACDMend = await ACDM.balanceOf(owner.address)
    console.log("ACDM end:", ethers.utils.formatUnits(ACDMend, 18));
  });


  it("Get token price and swap 500 POP for ~0.9 WETH", async function () {
    // -Получить цену пары через адаптер 
    let pricePOP = await adapter.getTokenPrice(pair3.address, WETHaddr,
      ethers.utils.parseEther("1"));
    console.log("POP price:", ethers.utils.formatUnits(pricePOP, 18));

    let priceWETH = await adapter.getTokenPrice(pair3.address, POP.address, ethers.utils.parseEther("500"));
    console.log("WETH price:", ethers.utils.formatUnits(priceWETH, 18));

    // баланс до обмена
    let POPbeg = await POP.balanceOf(trader.address)
    console.log("POP beg:", ethers.utils.formatUnits(POPbeg, 18));
    let WETHbeg = await WETH.balanceOf(trader.address)
    console.log("WETH beg:", ethers.utils.formatUnits(WETHbeg, 18));

    // -Обменять пару через адаптер 
    await adapter.connect(trader).swapToken(pair3.address, POP.address,
      ethers.utils.parseEther("500"), priceWETH);

    // баланс после обмена
    let POPend = await POP.balanceOf(trader.address)
    console.log("POP end:", ethers.utils.formatUnits(POPend, 18));
    //ожидаем, что уменьшилось 500 POP
    expect(POPend).to.be.eq(POPbeg.sub(ethers.utils.parseEther("500")));

    let WETHend = await WETH.balanceOf(trader.address)
    console.log("WETH end:", ethers.utils.formatUnits(WETHend, 18));
    //ожидаем, что добавилось 0.9 WETH
    expect(WETHend).to.be.eq(WETHbeg.add(priceWETH));
  });


  it("removeLiquidityETH (ETH/POP)", async function () {
    let LP3beg = await pair3.balanceOf(owner.address)
    console.log("LP3 beg:", ethers.utils.formatUnits(LP3beg, 18));
    let POPbeg = await POP.balanceOf(owner.address)
    console.log("POP beg:", ethers.utils.formatUnits(POPbeg, 18));
    let ETH = await owner.getBalance() //ETH
    console.log("ETH before:", ethers.utils.formatUnits(ETH, 18));

    await pair3.approve(adapter.address, LP3beg);

    await adapter.removeLiquidityETH(pair3.address, LP3beg);

    let LP3end = await pair3.balanceOf(owner.address)
    console.log("LP3 end:", ethers.utils.formatUnits(LP3end, 18));
    let POPend = await POP.balanceOf(owner.address)
    console.log("POP end:", ethers.utils.formatUnits(POPend, 18));
    ETH = await owner.getBalance() //ETH
    console.log("ETH end:", ethers.utils.formatUnits(ETH, 18));
  });


  it("Get reserves pair1", async function () {
    let [reserve0, reserve1] = await adapter.getReserves(pair1.address);
    console.log("pair1 reserves:",
      ethers.utils.formatUnits(reserve0, 18), ethers.utils.formatUnits(reserve1, 18));
  });


  // it("WETH", async function () {
  //   let WETHbeg = await WETH.balanceOf(trader.address)
  //   console.log("WETHbeg beg:", ethers.utils.formatUnits(WETHbeg, 18));
  //   await adapter.buyWETH({ value: ethers.utils.parseEther("0.5") });
  // });

});

//Куда идут проценты? - Они остаются в пуле, 0.3% 
//Увеличивается ли количество ЛП после обмена в пуле? 
//- Нет, сколько было ЛП токенов, столько и осталось, 
//но они стали дороже = sqrt(x*y)

