// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title RelayerRegistry
/// @notice Registry for relayers with staking, slashing, and reputation system
contract RelayerRegistry {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotRegistered();
    error AlreadyRegistered();
    error InsufficientStake();
    error StakeLocked();
    error InvalidFee();
    error NotOwner();
    error InvalidRelayer();
    error SlashingFailed();
    error WithdrawalFailed();
    error CooldownActive();
    error OnlyPool();

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event RelayerRegistered(address indexed relayer, uint256 stake, uint256 fee);
    event RelayerUpdated(address indexed relayer, uint256 newFee);
    event StakeAdded(address indexed relayer, uint256 amount);
    event StakeWithdrawn(address indexed relayer, uint256 amount);
    event RelayerSlashed(address indexed relayer, uint256 amount, bytes32 reason);
    event RelayerDeregistered(address indexed relayer);
    event ReputationUpdated(address indexed relayer, int256 change, uint256 newScore);

    /*//////////////////////////////////////////////////////////////
                                STRUCTS
    //////////////////////////////////////////////////////////////*/

    struct Relayer {
        uint256 stake;
        uint256 fee; // Fee in basis points (100 = 1%)
        uint256 reputation;
        uint256 successfulRelays;
        uint256 failedRelays;
        uint256 registeredAt;
        uint256 unstakeRequestTime;
        bool active;
    }

    /*//////////////////////////////////////////////////////////////
                                 STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice Minimum stake required to be a relayer
    uint256 public constant MIN_STAKE = 1 ether;

    /// @notice Maximum fee allowed (10%)
    uint256 public constant MAX_FEE = 1000;

    /// @notice Cooldown period before unstaking (7 days)
    uint256 public constant UNSTAKE_COOLDOWN = 7 days;

    /// @notice Initial reputation score
    uint256 public constant INITIAL_REPUTATION = 100;

    /// @notice Mapping of relayer addresses to their data
    mapping(address => Relayer) public relayers;

    /// @notice Array of all registered relayer addresses
    address[] public relayerList;

    /// @notice Mapping from relayer to their index in relayerList
    mapping(address => uint256) private relayerIndex;

    /// @notice Contract owner
    address public owner;

    /// @notice Slashing treasury
    address public treasury;

    /// @notice Authorized pool contract
    address public pool;

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address _treasury) {
        owner = msg.sender;
        treasury = _treasury;
    }

    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRegistered() {
        if (!relayers[msg.sender].active) revert NotRegistered();
        _;
    }

    modifier onlyPool() {
        if (msg.sender != pool) revert OnlyPool();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                         REGISTRATION FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Register as a relayer
    /// @param fee The fee to charge in basis points (100 = 1%)
    function register(uint256 fee) external payable {
        if (relayers[msg.sender].active) revert AlreadyRegistered();
        if (msg.value < MIN_STAKE) revert InsufficientStake();
        if (fee > MAX_FEE) revert InvalidFee();

        relayers[msg.sender] = Relayer({
            stake: msg.value,
            fee: fee,
            reputation: INITIAL_REPUTATION,
            successfulRelays: 0,
            failedRelays: 0,
            registeredAt: block.timestamp,
            unstakeRequestTime: 0,
            active: true
        });

        relayerIndex[msg.sender] = relayerList.length;
        relayerList.push(msg.sender);

        emit RelayerRegistered(msg.sender, msg.value, fee);
    }

    /// @notice Update relayer fee
    /// @param newFee The new fee in basis points
    function updateFee(uint256 newFee) external onlyRegistered {
        if (newFee > MAX_FEE) revert InvalidFee();
        relayers[msg.sender].fee = newFee;
        emit RelayerUpdated(msg.sender, newFee);
    }

    /// @notice Add more stake
    function addStake() external payable onlyRegistered {
        relayers[msg.sender].stake += msg.value;
        emit StakeAdded(msg.sender, msg.value);
    }

    /// @notice Request to unstake (starts cooldown)
    function requestUnstake() external onlyRegistered {
        if (relayers[msg.sender].unstakeRequestTime != 0) revert CooldownActive();
        relayers[msg.sender].unstakeRequestTime = block.timestamp;
    }

    /// @notice Withdraw stake after cooldown
    function withdrawStake() external onlyRegistered {
        Relayer storage relayer = relayers[msg.sender];

        if (relayer.unstakeRequestTime == 0) revert StakeLocked();
        if (block.timestamp < relayer.unstakeRequestTime + UNSTAKE_COOLDOWN) {
            revert CooldownActive();
        }

        uint256 amount = relayer.stake;
        relayer.stake = 0;
        relayer.active = false;

        // Remove from list
        _removeFromList(msg.sender);

        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert WithdrawalFailed();

        emit StakeWithdrawn(msg.sender, amount);
        emit RelayerDeregistered(msg.sender);
    }

    /*//////////////////////////////////////////////////////////////
                          REPUTATION FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Record a successful relay (called by pool contract)
    /// @param relayer The relayer address
    function recordSuccess(address relayer) external onlyPool {
        if (!relayers[relayer].active) revert InvalidRelayer();

        relayers[relayer].successfulRelays++;
        _updateReputation(relayer, 1);
    }

    /// @notice Record a failed relay
    /// @param relayer The relayer address
    function recordFailure(address relayer) external onlyPool {
        if (!relayers[relayer].active) revert InvalidRelayer();

        relayers[relayer].failedRelays++;
        _updateReputation(relayer, -5);
    }

    /// @notice Update reputation score
    function _updateReputation(address relayer, int256 change) internal {
        Relayer storage r = relayers[relayer];
        if (change > 0) {
            r.reputation += uint256(change);
        } else {
            uint256 decrease = uint256(-change);
            r.reputation = r.reputation > decrease ? r.reputation - decrease : 0;
        }
        emit ReputationUpdated(relayer, change, r.reputation);
    }

    /*//////////////////////////////////////////////////////////////
                           SLASHING FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Slash a relayer's stake
    /// @param relayer The relayer to slash
    /// @param amount The amount to slash
    /// @param reason The reason for slashing
    function slash(address relayer, uint256 amount, bytes32 reason) external onlyOwner {
        Relayer storage r = relayers[relayer];
        if (!r.active) revert InvalidRelayer();

        uint256 slashAmount = amount > r.stake ? r.stake : amount;
        r.stake -= slashAmount;

        // Transfer slashed funds to treasury
        (bool success, ) = treasury.call{value: slashAmount}("");
        if (!success) revert SlashingFailed();

        // Reduce reputation significantly
        _updateReputation(relayer, -50);

        // Deactivate if stake below minimum
        if (r.stake < MIN_STAKE) {
            r.active = false;
            _removeFromList(relayer);
        }

        emit RelayerSlashed(relayer, slashAmount, reason);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get all active relayers
    function getActiveRelayers() external view returns (address[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < relayerList.length; i++) {
            if (relayers[relayerList[i]].active) count++;
        }

        address[] memory active = new address[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < relayerList.length; i++) {
            if (relayers[relayerList[i]].active) {
                active[index++] = relayerList[i];
            }
        }
        return active;
    }

    /// @notice Get relayer info
    function getRelayer(address relayer) external view returns (Relayer memory) {
        return relayers[relayer];
    }

    /// @notice Get number of relayers
    function getRelayerCount() external view returns (uint256) {
        return relayerList.length;
    }

    /// @notice Check if address is an active relayer
    function isActiveRelayer(address relayer) external view returns (bool) {
        return relayers[relayer].active;
    }

    /// @notice Get relayer fee
    function getRelayerFee(address relayer) external view returns (uint256) {
        return relayers[relayer].fee;
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Remove relayer from the list
    function _removeFromList(address relayer) internal {
        uint256 index = relayerIndex[relayer];
        uint256 lastIndex = relayerList.length - 1;

        if (index != lastIndex) {
            address lastRelayer = relayerList[lastIndex];
            relayerList[index] = lastRelayer;
            relayerIndex[lastRelayer] = index;
        }

        relayerList.pop();
        delete relayerIndex[relayer];
    }

    /*//////////////////////////////////////////////////////////////
                           ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Set authorized pool contract
    function setPool(address _pool) external onlyOwner {
        pool = _pool;
    }

    /// @notice Update treasury address
    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    /// @notice Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
}
