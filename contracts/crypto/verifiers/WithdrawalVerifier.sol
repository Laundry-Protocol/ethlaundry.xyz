// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IWithdrawalVerifier.sol";

/// @title WithdrawalVerifier
/// @notice Groth16 verifier for withdrawal proofs generated from Noir circuits
/// @dev Generated verification key from trusted setup - replace with production keys
contract WithdrawalVerifier is IWithdrawalVerifier {
    // Scalar field size
    uint256 constant PRIME_Q = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification key components (replace with actual values from circuit compilation)
    uint256 constant ALPHA_X = 20491192805390485299153009773594534940189261866228447918068658471970481763042;
    uint256 constant ALPHA_Y = 9383485363053290200918347156157836566562967994039712273449902621266178545958;

    uint256 constant BETA_X1 = 4252822878758300859123897981450591353533073413197771768651442665752259397132;
    uint256 constant BETA_X2 = 6375614351688725206403948262868962793625744043794305715222011528459656738731;
    uint256 constant BETA_Y1 = 21847035105528745403288232691147584728191162732299865338377159692350059136679;
    uint256 constant BETA_Y2 = 10505242626370262277552901082094356697409835680220590971873171140371331206856;

    uint256 constant GAMMA_X1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant GAMMA_X2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant GAMMA_Y1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant GAMMA_Y2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;

    uint256 constant DELTA_X1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant DELTA_X2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant DELTA_Y1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant DELTA_Y2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;

    // IC (verification key for public inputs)
    uint256 constant IC0_X = 8123939765346088656927443427488393137916097705044820546288386990057762399106;
    uint256 constant IC0_Y = 10283046596088073905757256073989354018982429217498269406894684754800716903632;
    uint256 constant IC1_X = 14125489867738987103755199697729222137570120193986124813866007481391215022951;
    uint256 constant IC1_Y = 18256332502396909978995541414014952890498230695689833266096968091183482350871;
    uint256 constant IC2_X = 6891450661062050029879559068321175251238138841867147152421175953905451813322;
    uint256 constant IC2_Y = 7766462209509748321204903956002266234599415534089622412548541481227376459063;
    uint256 constant IC3_X = 20936111936136615215913493933382985296891887146208934178534562469668604128067;
    uint256 constant IC3_Y = 9808391027740538392830679614696450266942725184553447795416428054485511366215;
    uint256 constant IC4_X = 14125489867738987103755199697729222137570120193986124813866007481391215022951;
    uint256 constant IC4_Y = 18256332502396909978995541414014952890498230695689833266096968091183482350871;

    error InvalidProof();
    error InvalidProofLength();
    error InvalidPublicInput();

    /// @inheritdoc IWithdrawalVerifier
    function verify(bytes calldata proof, uint256[4] memory publicInputs) external view override returns (bool) {
        // Proof should be 8 * 32 = 256 bytes (A, B, C points)
        if (proof.length != 256) revert InvalidProofLength();

        // Validate public inputs are in field
        for (uint256 i = 0; i < 4; i++) {
            if (publicInputs[i] >= PRIME_Q) revert InvalidPublicInput();
        }

        // Decode proof points
        uint256[8] memory p = abi.decode(proof, (uint256[8]));

        // Verify proof using pairing check
        // e(A, B) = e(alpha, beta) * e(vk_x, gamma) * e(C, delta)
        return _verifyProof(p, publicInputs);
    }

    function _verifyProof(uint256[8] memory proof, uint256[4] memory input) internal view returns (bool) {
        // Compute the linear combination vk_x
        uint256[2] memory vk_x = _computeVkX(input);

        // Prepare pairing input
        uint256[24] memory pairingInput;

        // -A
        pairingInput[0] = proof[0];
        pairingInput[1] = PRIME_Q - (proof[1] % PRIME_Q);
        // B
        pairingInput[2] = proof[2];
        pairingInput[3] = proof[3];
        pairingInput[4] = proof[4];
        pairingInput[5] = proof[5];

        // alpha
        pairingInput[6] = ALPHA_X;
        pairingInput[7] = ALPHA_Y;
        // beta
        pairingInput[8] = BETA_X1;
        pairingInput[9] = BETA_X2;
        pairingInput[10] = BETA_Y1;
        pairingInput[11] = BETA_Y2;

        // vk_x
        pairingInput[12] = vk_x[0];
        pairingInput[13] = vk_x[1];
        // gamma
        pairingInput[14] = GAMMA_X1;
        pairingInput[15] = GAMMA_X2;
        pairingInput[16] = GAMMA_Y1;
        pairingInput[17] = GAMMA_Y2;

        // C
        pairingInput[18] = proof[6];
        pairingInput[19] = proof[7];
        // delta
        pairingInput[20] = DELTA_X1;
        pairingInput[21] = DELTA_X2;
        pairingInput[22] = DELTA_Y1;
        pairingInput[23] = DELTA_Y2;

        // Call pairing precompile
        uint256[1] memory result;
        bool success;

        assembly {
            success := staticcall(gas(), 0x08, pairingInput, 768, result, 32)
        }

        return success && result[0] == 1;
    }

    function _computeVkX(uint256[4] memory input) internal view returns (uint256[2] memory vk_x) {
        // vk_x = IC[0] + sum(input[i] * IC[i+1])
        vk_x[0] = IC0_X;
        vk_x[1] = IC0_Y;

        uint256[2][4] memory IC = [
            [IC1_X, IC1_Y],
            [IC2_X, IC2_Y],
            [IC3_X, IC3_Y],
            [IC4_X, IC4_Y]
        ];

        for (uint256 i = 0; i < 4; i++) {
            if (input[i] != 0) {
                // Scalar multiplication and point addition using precompiles
                (uint256 x, uint256 y) = _ecMul(IC[i][0], IC[i][1], input[i]);
                (vk_x[0], vk_x[1]) = _ecAdd(vk_x[0], vk_x[1], x, y);
            }
        }

        return vk_x;
    }

    function _ecAdd(uint256 x1, uint256 y1, uint256 x2, uint256 y2) internal view returns (uint256 x, uint256 y) {
        uint256[4] memory input;
        input[0] = x1;
        input[1] = y1;
        input[2] = x2;
        input[3] = y2;

        bool success;
        assembly {
            success := staticcall(gas(), 0x06, input, 128, input, 64)
        }
        require(success, "ecAdd failed");

        return (input[0], input[1]);
    }

    function _ecMul(uint256 x, uint256 y, uint256 scalar) internal view returns (uint256, uint256) {
        uint256[3] memory input;
        input[0] = x;
        input[1] = y;
        input[2] = scalar;

        uint256[2] memory result;
        bool success;
        assembly {
            success := staticcall(gas(), 0x07, input, 96, result, 64)
        }
        require(success, "ecMul failed");

        return (result[0], result[1]);
    }
}
