// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title ImpactToken (IMPACT)
/// @notice ERC-20 community/reward token for the Socialstack platform on Celo.
/// @dev Only the owner (Socialstack treasury/admin) can mint. The Missions contract
///      holds NO minter rights — it is funded via transferFrom from pre-minted supply,
///      so a contract bug cannot inflate supply beyond the pre-deposited pool.
contract RewardToken is ERC20, ERC20Burnable, Ownable2Step {
    /// @param initialOwner The address that receives owner privileges (treasury/admin).
    constructor(address initialOwner)
        ERC20("ImpactToken", "IMPACT")
        Ownable(initialOwner)
    {}

    /// @notice Mint new tokens. Only callable by the owner (treasury/admin).
    /// @param to    Recipient of the minted tokens.
    /// @param amount Number of tokens to mint (18-decimal units).
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
