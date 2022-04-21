// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./uniswapV2/IUniswapV2Factory.sol";
import "./uniswapV2/IUniswapV2Router02.sol";
import "./uniswapV2/IUniswapV2Pair.sol";
import "./uniswapV2/IWETH.sol";
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

    //for addLiquidity, addLiquidityETH
    function _tokenTransferAprove(address iToken, uint256 iAmountToken)
        internal
    {
        IERC20 token = IERC20(iToken);
        token.safeTransferFrom(msg.sender, address(this), iAmountToken);
        token.safeApprove(address(mRouter), iAmountToken);
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
        _tokenTransferAprove(iTokenA, iAmountA);
        _tokenTransferAprove(iTokenB, iAmountB);

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

    //ETH
    function addLiquidityETH(address iToken, uint256 iAmountToken)
        external
        payable
        returns (
            uint256 amountToken,
            uint256 amountETH,
            uint256 liquidity
        )
    {
        _tokenTransferAprove(iToken, iAmountToken);

        (amountToken, amountETH, liquidity) = mRouter.addLiquidityETH{
            value: msg.value
        }(iToken, iAmountToken, 1, 1, msg.sender, block.timestamp);
    }

    function removeLiquidity(address pairAddress, uint256 iLiquidity)
        external
        returns (uint256 amountA, uint256 amountB)
    {
        _tokenTransferAprove(pairAddress, iLiquidity);

        IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);

        (amountA, amountB) = mRouter.removeLiquidity(
            pair.token0(),
            pair.token1(),
            iLiquidity,
            1,
            1,
            msg.sender,
            block.timestamp
        );
    }

    //ETH
    function removeLiquidityETH(address pairAddress, uint256 iLiquidity)
        external
        returns (uint256 amountToken, uint256 amountETH)
    {
        _tokenTransferAprove(pairAddress, iLiquidity);

        IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);

        address token;
        if (pair.token0() == mRouter.WETH()) {
            token = pair.token1();
        } else {
            token = pair.token0();
        }

        (amountToken, amountETH) = mRouter.removeLiquidityETH(
            token,
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
        address sellToken,
        uint256 sellAmount
    ) public view returns (uint256 buyAmount) {
        IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
        require(
            pair.token0() == sellToken || pair.token1() == sellToken,
            "Wrong sell token address"
        );

        (uint256 reserves0, uint256 reserves1, ) = pair.getReserves();

        uint256 reserveIn;
        uint256 reserveOut;

        if (sellToken == pair.token0()) {
            reserveIn = reserves0;
            reserveOut = reserves1;
        } else {
            reserveIn = reserves1;
            reserveOut = reserves0;
        }

        buyAmount = mRouter.getAmountOut(sellAmount, reserveIn, reserveOut);
    }

    function getPathPrice(address[] calldata path, uint256 sellAmount)
        public
        view
        returns (uint256 buyAmount)
    {
        uint256[] memory routerAmounts = mRouter.getAmountsOut(
            sellAmount,
            path
        );
        buyAmount = routerAmounts[routerAmounts.length - 1];
    }

    function swapToken(
        address pairAddress,
        address sellToken,
        uint256 sellAmount,
        uint256 buyAmountMin
    ) external returns (uint256[] memory amounts) {
        IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
        require(
            pair.token0() == sellToken || pair.token1() == sellToken,
            "Wrong sell token address"
        );

        address buyToken;
        if (sellToken == pair.token0()) {
            buyToken = pair.token1();
        } else {
            buyToken = pair.token0();
        }

        IERC20(sellToken).safeTransferFrom(
            msg.sender,
            address(this),
            sellAmount
        );
        IERC20(sellToken).safeApprove(address(mRouter), sellAmount);

        address[] memory path = new address[](2);
        path[0] = sellToken;
        path[1] = buyToken;

        amounts = mRouter.swapExactTokensForTokens(
            sellAmount,
            buyAmountMin,
            path,
            msg.sender,
            block.timestamp
        );
    }

    function swapWithPath(
        address[] calldata path,
        uint256 sellAmount,
        uint256 buyAmountMin
    ) external returns (uint256 buyAmount) {
        address sellToken = path[0];

        IERC20(sellToken).safeTransferFrom(
            msg.sender,
            address(this),
            sellAmount
        );
        IERC20(sellToken).safeApprove(address(mRouter), sellAmount);

        uint256[] memory routerAmounts = mRouter.swapExactTokensForTokens(
            sellAmount,
            buyAmountMin,
            path,
            msg.sender,
            block.timestamp
        );

        buyAmount = routerAmounts[routerAmounts.length - 1];
    }

    function getReserves(address pairAddress)
        external
        view
        returns (uint112 reserve0, uint112 reserve1)
    {
        IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
        uint32 dummy;
        (reserve0, reserve1, dummy) = pair.getReserves();
    }

    // function buyWETH() public payable {
    //     IWETH weth = IWETH(mRouter.WETH());
    //     weth.deposit{value: msg.value}();
    // }
}
