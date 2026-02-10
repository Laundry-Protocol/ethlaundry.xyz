#!/bin/bash
# Laundry Cash Deployment Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Laundry Cash Deployment ===${NC}"

# Check dependencies
check_dependencies() {
    echo -e "${YELLOW}Checking dependencies...${NC}"

    # Check Foundry
    if ! command -v forge &> /dev/null; then
        echo -e "${RED}Foundry not found. Install: curl -L https://foundry.paradigm.xyz | bash${NC}"
        exit 1
    fi

    # Check Noir
    if ! command -v nargo &> /dev/null; then
        echo -e "${RED}Noir not found. Install: curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash${NC}"
        exit 1
    fi

    # Check Rust
    if ! command -v cargo &> /dev/null; then
        echo -e "${RED}Rust not found. Install: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh${NC}"
        exit 1
    fi

    echo -e "${GREEN}All dependencies found!${NC}"
}

# Build contracts
build_contracts() {
    echo -e "${YELLOW}Building contracts...${NC}"
    cd contracts
    forge build
    cd ..
    echo -e "${GREEN}Contracts built!${NC}"
}

# Build circuits
build_circuits() {
    echo -e "${YELLOW}Building ZK circuits...${NC}"
    cd circuits

    for circuit in withdrawal consistency range inclusion; do
        echo "Building $circuit circuit..."
        cd $circuit
        nargo compile
        cd ..
    done

    cd ..
    echo -e "${GREEN}Circuits built!${NC}"
}

# Build Rust libraries
build_rust() {
    echo -e "${YELLOW}Building Rust libraries...${NC}"
    cd crypto
    cargo build --release
    cd ..

    cd relayer
    cargo build --release
    cd ..
    echo -e "${GREEN}Rust libraries built!${NC}"
}

# Build SDK
build_sdk() {
    echo -e "${YELLOW}Building TypeScript SDK...${NC}"
    cd sdk
    npm install
    npm run build
    cd ..
    echo -e "${GREEN}SDK built!${NC}"
}

# Run tests
run_tests() {
    echo -e "${YELLOW}Running tests...${NC}"

    # Contract tests
    echo "Testing contracts..."
    cd contracts
    forge test -vvv
    cd ..

    # Circuit tests
    echo "Testing circuits..."
    cd circuits
    for circuit in withdrawal consistency range inclusion; do
        cd $circuit
        nargo test
        cd ..
    done
    cd ..

    # Rust tests
    echo "Testing Rust libraries..."
    cd crypto
    cargo test
    cd ..

    echo -e "${GREEN}All tests passed!${NC}"
}

# Deploy to testnet
deploy_testnet() {
    echo -e "${YELLOW}Deploying to testnet...${NC}"

    if [ -z "$SEPOLIA_RPC_URL" ]; then
        echo -e "${RED}SEPOLIA_RPC_URL not set${NC}"
        exit 1
    fi

    if [ -z "$PRIVATE_KEY" ]; then
        echo -e "${RED}PRIVATE_KEY not set${NC}"
        exit 1
    fi

    cd contracts

    # Deploy verifiers first
    echo "Deploying WithdrawalVerifier..."
    forge create --rpc-url $SEPOLIA_RPC_URL \
        --private-key $PRIVATE_KEY \
        src/crypto/verifiers/WithdrawalVerifier.sol:WithdrawalVerifier

    echo "Deploying ConsistencyVerifier..."
    forge create --rpc-url $SEPOLIA_RPC_URL \
        --private-key $PRIVATE_KEY \
        src/crypto/verifiers/ConsistencyVerifier.sol:ConsistencyVerifier

    # Deploy main contracts
    echo "Deploying HomomorphicPool..."
    # Add actual deployment with constructor args

    echo "Deploying HTLCSwap..."
    forge create --rpc-url $SEPOLIA_RPC_URL \
        --private-key $PRIVATE_KEY \
        src/core/HTLCSwap.sol:HTLCSwap

    cd ..

    echo -e "${GREEN}Deployment complete!${NC}"
}

# Main script
case "$1" in
    check)
        check_dependencies
        ;;
    build)
        check_dependencies
        build_contracts
        build_circuits
        build_rust
        build_sdk
        ;;
    test)
        run_tests
        ;;
    deploy)
        deploy_testnet
        ;;
    all)
        check_dependencies
        build_contracts
        build_circuits
        build_rust
        build_sdk
        run_tests
        ;;
    *)
        echo "Usage: $0 {check|build|test|deploy|all}"
        echo ""
        echo "Commands:"
        echo "  check   - Check dependencies"
        echo "  build   - Build all components"
        echo "  test    - Run all tests"
        echo "  deploy  - Deploy to testnet"
        echo "  all     - Build and test everything"
        exit 1
        ;;
esac
