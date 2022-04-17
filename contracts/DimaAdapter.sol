// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./uniswapV2/IUniswapV2Factory.sol";
import "./uniswapV2/IUniswapV2Router02.sol";
import "./uniswapV2/IUniswapV2Pair.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract DimaAdapter {
    IUniswapV2Factory public mFactory;
    IUniswapV2Router02 public mRouter;
    using SafeERC20 for IERC20;

    constructor(address factory, address router) {
        mFactory = IUniswapV2Factory(factory);
        mRouter = IUniswapV2Router02(router);
    }

    function createPair(address tokenA, address tokenB)
        external
        returns (address pair)
    {
        pair = mFactory.createPair(tokenA, tokenB);
    }

    function getPair(address tokenA, address tokenB)
        external
        view
        returns (address pair)
    {
        pair = mFactory.getPair(tokenA, tokenB);
    }

    function addLiquidity(
        address iTokenA,
        address iTokenB,
        uint256 iAmountA,
        uint256 iAmountB
    )
        external
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 liquidity
        )
    {
        IERC20 tokenA = IERC20(iTokenA);
        IERC20 tokenB = IERC20(iTokenB);
        tokenA.safeTransferFrom(msg.sender, address(this), iAmountA);
        tokenB.safeTransferFrom(msg.sender, address(this), iAmountB);

        tokenA.safeApprove(address(mRouter), iAmountA);
        tokenB.safeApprove(address(mRouter), iAmountB);

        (amountA, amountB, liquidity) = mRouter.addLiquidity(
            iTokenA,
            iTokenB,
            iAmountA,
            iAmountB,
            1,
            1,
            msg.sender, //address(this),
            block.timestamp
        );
    }

    function removeLiquidity(
        address iTokenA,
        address iTokenB,
        uint256 iLiquidity
    ) external returns (uint256 amountA, uint256 amountB) {
        address pair = mFactory.getPair(iTokenA, iTokenB);
        IERC20(pair).safeTransferFrom(msg.sender, address(this), iLiquidity);
        IERC20(pair).safeApprove(address(mRouter), iLiquidity);

        (amountA, amountB) = mRouter.removeLiquidity(
            iTokenA,
            iTokenB,
            iLiquidity,
            1,
            1,
            msg.sender,
            block.timestamp
        );
    }

    // calculate price based on pair reserves
    function getTokenPrice(
        address pairAddress,
        address buyTokenAddress,
        uint256 buyAmount
    ) public view returns (uint256) {
        IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
        address token0Addr = pair.token0();
        address token1Addr = pair.token1();
        require(
            token0Addr == buyTokenAddress || token1Addr == buyTokenAddress,
            "Wrong token address"
        );

        (uint256 reserves0, uint256 reserves1, ) = pair.getReserves();

        // decimals
        //uint256 res0 = reserves0 * (10**token1.decimals); TODO
        if (buyTokenAddress == token0Addr) {
            return ((buyAmount * reserves1) / reserves0);
        } else {
            return ((buyAmount * reserves0) / reserves1);
        }
    }

    // function pairInfo(address tokenA, address tokenB)
    //     internal
    //     view
    //     returns (
    //         uint256 reserveA,
    //         uint256 reserveB,
    //         uint256 totalSupply
    //     )
    // {
    //     IUniswapV2Pair pair = IUniswapV2Pair(
    //         UniswapV2Library.pairFor(factory, tokenA, tokenB)
    //     );
    //     totalSupply = pair.totalSupply();
    //     (uint256 reserves0, uint256 reserves1, ) = pair.getReserves();
    //     (reserveA, reserveB) = tokenA == pair.token0()
    //         ? (reserves0, reserves1)
    //         : (reserves1, reserves0);
    // }
}

// Требования к контракту:
// -Создать через адаптер несколько пар (TST/ACDM, ACDM/POP, ETH/POP)
// -Добавить/удалить ликвидность к этим парам через адаптер.
// -Получить цену пары через адаптер
// -Обменять пару через адаптер
// -Обменять пару TST/POP используя путь - нет прямого пула - функция ~getpath
