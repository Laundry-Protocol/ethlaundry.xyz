"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const ethers_1 = require("ethers");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
require("dotenv/config");
// ============ CONFIGURATION ============
const PORT = process.env.PORT || 3001;
const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const POOL_ADDRESS = process.env.POOL_ADDRESS || '';
const START_BLOCK = parseInt(process.env.START_BLOCK || '0');
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '12000');
const TREE_DEPTH = 20;
// ============ DATABASE ============
const db = new better_sqlite3_1.default('indexer.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    commitment TEXT UNIQUE NOT NULL,
    leaf_index INTEGER NOT NULL,
    block_number INTEGER NOT NULL,
    tx_hash TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    amount TEXT NOT NULL,
    network TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS merkle_nodes (
    level INTEGER NOT NULL,
    index_at_level INTEGER NOT NULL,
    hash TEXT NOT NULL,
    PRIMARY KEY (level, index_at_level)
  );

  CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_commitment ON deposits(commitment);
  CREATE INDEX IF NOT EXISTS idx_leaf_index ON deposits(leaf_index);
`);
// ============ MERKLE TREE ============
const ZERO_VALUE = ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes('laundry-cash-empty-leaf'));
function getZeroHash(level) {
    let hash = ZERO_VALUE;
    for (let i = 0; i < level; i++) {
        hash = ethers_1.ethers.keccak256(ethers_1.ethers.concat([hash, hash]));
    }
    return hash;
}
function getNode(level, index) {
    const row = db.prepare('SELECT hash FROM merkle_nodes WHERE level = ? AND index_at_level = ?').get(level, index);
    return row?.hash || getZeroHash(level);
}
function setNode(level, index, hash) {
    db.prepare('INSERT OR REPLACE INTO merkle_nodes (level, index_at_level, hash) VALUES (?, ?, ?)').run(level, index, hash);
}
function insertLeaf(commitment) {
    const countResult = db.prepare('SELECT COUNT(*) as count FROM deposits').get();
    const leafIndex = countResult.count;
    // Update tree
    let currentHash = commitment;
    let currentIndex = leafIndex;
    for (let level = 0; level < TREE_DEPTH; level++) {
        setNode(level, currentIndex, currentHash);
        const isRight = currentIndex % 2 === 1;
        const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;
        const sibling = getNode(level, siblingIndex);
        const left = isRight ? sibling : currentHash;
        const right = isRight ? currentHash : sibling;
        currentHash = ethers_1.ethers.keccak256(ethers_1.ethers.concat([left, right]));
        currentIndex = Math.floor(currentIndex / 2);
    }
    // Update root
    setNode(TREE_DEPTH, 0, currentHash);
    return leafIndex;
}
function getMerkleProof(leafIndex) {
    const pathElements = [];
    const pathIndices = [];
    let currentIndex = leafIndex;
    for (let level = 0; level < TREE_DEPTH; level++) {
        const isRight = currentIndex % 2 === 1;
        const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;
        pathElements.push(getNode(level, siblingIndex));
        pathIndices.push(isRight ? 1 : 0);
        currentIndex = Math.floor(currentIndex / 2);
    }
    const root = getNode(TREE_DEPTH, 0);
    return { root, pathElements, pathIndices };
}
function getCurrentRoot() {
    return getNode(TREE_DEPTH, 0) || getZeroHash(TREE_DEPTH);
}
// ============ BLOCKCHAIN SYNC ============
const POOL_ABI = [
    'event Deposit(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp)',
];
let provider;
let poolContract;
async function syncDeposits() {
    if (!POOL_ADDRESS) {
        console.log('No pool address configured, skipping sync');
        return;
    }
    const lastBlockRow = db.prepare("SELECT value FROM sync_state WHERE key = 'last_block'").get();
    const fromBlock = lastBlockRow ? parseInt(lastBlockRow.value) + 1 : START_BLOCK;
    const toBlock = await provider.getBlockNumber();
    if (fromBlock > toBlock)
        return;
    console.log(`Syncing deposits from block ${fromBlock} to ${toBlock}`);
    const filter = poolContract.filters.Deposit();
    const events = await poolContract.queryFilter(filter, fromBlock, toBlock);
    for (const event of events) {
        const log = event;
        const commitment = log.args[0];
        const leafIndex = Number(log.args[1]);
        const timestamp = Number(log.args[2]);
        const existing = db.prepare('SELECT id FROM deposits WHERE commitment = ?').get(commitment);
        if (existing)
            continue;
        // Verify leaf index matches our tree
        const expectedIndex = insertLeaf(commitment);
        if (expectedIndex !== leafIndex) {
            console.error(`Leaf index mismatch: expected ${expectedIndex}, got ${leafIndex}`);
        }
        const block = await log.getBlock();
        db.prepare(`
      INSERT INTO deposits (commitment, leaf_index, block_number, tx_hash, timestamp, amount, network)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(commitment, leafIndex, log.blockNumber, log.transactionHash, timestamp, '0', // Amount would need to be extracted from tx
        'ethereum');
        console.log(`Indexed deposit: ${commitment.slice(0, 10)}... at index ${leafIndex}`);
    }
    db.prepare("INSERT OR REPLACE INTO sync_state (key, value) VALUES ('last_block', ?)").run(toBlock.toString());
}
// ============ API SERVER ============
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', root: getCurrentRoot() });
});
// Get current Merkle root
app.get('/api/root', (req, res) => {
    res.json({ root: getCurrentRoot() });
});
// Get Merkle proof for a commitment
app.post('/api/merkle-proof', (req, res) => {
    const { commitment, network } = req.body;
    if (!commitment) {
        return res.status(400).json({ error: 'Commitment required' });
    }
    const deposit = db.prepare('SELECT leaf_index FROM deposits WHERE commitment = ?').get(commitment);
    if (!deposit) {
        return res.status(404).json({ error: 'Commitment not found in tree' });
    }
    const proof = getMerkleProof(deposit.leaf_index);
    res.json({
        ...proof,
        leafIndex: deposit.leaf_index,
    });
});
// Get deposit info
app.get('/api/deposit/:commitment', (req, res) => {
    const { commitment } = req.params;
    const deposit = db.prepare('SELECT * FROM deposits WHERE commitment = ?').get(commitment);
    if (!deposit) {
        return res.status(404).json({ error: 'Deposit not found' });
    }
    res.json(deposit);
});
// Get all deposits (paginated)
app.get('/api/deposits', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const offset = parseInt(req.query.offset) || 0;
    const deposits = db.prepare('SELECT * FROM deposits ORDER BY leaf_index DESC LIMIT ? OFFSET ?').all(limit, offset);
    const total = db.prepare('SELECT COUNT(*) as count FROM deposits').get().count;
    res.json({ deposits, total, limit, offset });
});
// Get stats
app.get('/api/stats', (req, res) => {
    const total = db.prepare('SELECT COUNT(*) as count FROM deposits').get().count;
    const root = getCurrentRoot();
    const lastBlockRow = db.prepare("SELECT value FROM sync_state WHERE key = 'last_block'").get();
    res.json({
        totalDeposits: total,
        merkleRoot: root,
        lastSyncedBlock: lastBlockRow?.value || '0',
        treeDepth: TREE_DEPTH,
    });
});
// ============ STARTUP ============
async function start() {
    console.log('Starting Laundry Cash Indexer...');
    if (POOL_ADDRESS) {
        provider = new ethers_1.ethers.JsonRpcProvider(RPC_URL);
        poolContract = new ethers_1.ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
        // Initial sync
        await syncDeposits();
        // Periodic sync
        setInterval(syncDeposits, POLL_INTERVAL);
    }
    app.listen(PORT, () => {
        console.log(`Indexer API running on port ${PORT}`);
        console.log(`Pool address: ${POOL_ADDRESS || 'not configured'}`);
        console.log(`Current root: ${getCurrentRoot()}`);
    });
}
start().catch(console.error);
//# sourceMappingURL=index.js.map