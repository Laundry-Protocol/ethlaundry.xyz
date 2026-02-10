import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import Database from 'better-sqlite3';
import 'dotenv/config';

// ============ CONFIGURATION ============
const PORT = process.env.PORT || 3001;
const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const POOL_ADDRESS = process.env.POOL_ADDRESS || '';
const START_BLOCK = parseInt(process.env.START_BLOCK || '0');
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '12000');
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '1');
const TREE_DEPTH = 20;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'; // Set to frontend URL in production

// Map chain ID to network name for deposit records
function getNetworkName(chainId: number): string {
  switch (chainId) {
    case 1: return 'ethereum';
    case 42161: return 'arbitrum';
    case 137: return 'polygon';
    default: return 'ethereum';
  }
}

const NETWORK_NAME = getNetworkName(CHAIN_ID);

// Must match MerkleTree.sol ZERO_VALUE = keccak256("laundry_zero")
const ZERO_VALUE_STRING = 'laundry_zero';

// ============ DATABASE ============
const db = new Database('indexer.db');

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

// ============ MERKLE TREE (KECCAK256 - on-chain compatible) ============
// Must match contracts: keccak256("laundry_zero")
const ZERO_VALUE = ethers.keccak256(ethers.toUtf8Bytes(ZERO_VALUE_STRING));

function getZeroHash(level: number): string {
  let hash = ZERO_VALUE;
  const coder = ethers.AbiCoder.defaultAbiCoder();
  for (let i = 0; i < level; i++) {
    // Must match MerkleTree.sol hashPair: keccak256(abi.encode(left, right))
    hash = ethers.keccak256(coder.encode(['bytes32', 'bytes32'], [hash, hash]));
  }
  return hash;
}

function getNode(level: number, index: number): string {
  const row = db.prepare('SELECT hash FROM merkle_nodes WHERE level = ? AND index_at_level = ?').get(level, index) as { hash: string } | undefined;
  return row?.hash || getZeroHash(level);
}

function setNode(level: number, index: number, hash: string): void {
  db.prepare('INSERT OR REPLACE INTO merkle_nodes (level, index_at_level, hash) VALUES (?, ?, ?)').run(level, index, hash);
}

function hashPair(left: string, right: string): string {
  // Must match MerkleTree.sol: keccak256(abi.encode(left, right))
  const coder = ethers.AbiCoder.defaultAbiCoder();
  return ethers.keccak256(coder.encode(['bytes32', 'bytes32'], [left, right]));
}

function insertLeaf(commitment: string): number {
  const countResult = db.prepare('SELECT COUNT(*) as count FROM deposits').get() as { count: number };
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

    currentHash = hashPair(left, right);
    currentIndex = Math.floor(currentIndex / 2);
  }

  // Update root
  setNode(TREE_DEPTH, 0, currentHash);

  return leafIndex;
}

function getMerkleProof(leafIndex: number): { root: string; pathElements: string[]; pathIndices: number[] } {
  const pathElements: string[] = [];
  const pathIndices: number[] = [];
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

function getCurrentRoot(): string {
  return getNode(TREE_DEPTH, 0) || getZeroHash(TREE_DEPTH);
}

// ============ PEDERSEN MERKLE TREE (ZK-compatible) ============
// The ZK circuits use Barretenberg's Pedersen hash (Grumpkin curve).
// This tree mirrors the keccak256 tree but uses Pedersen hashing.
// Pedersen proofs are what the ZK withdrawal circuit verifies.

// Pedersen tree state: stored in separate DB tables
db.exec(`
  CREATE TABLE IF NOT EXISTS pedersen_nodes (
    level INTEGER NOT NULL,
    index_at_level INTEGER NOT NULL,
    hash TEXT NOT NULL,
    PRIMARY KEY (level, index_at_level)
  );
`);

// Barretenberg instance for Pedersen hash computation.
// In @aztec/bb.js@0.58.0, pedersenHash() is directly available on the Barretenberg instance.
let bbInstance: any = null;
let bbFrClass: any = null;

async function initBarretenberg(): Promise<void> {
  if (bbInstance) return;
  try {
    const { Barretenberg, Fr } = await import('@aztec/bb.js');
    bbFrClass = Fr;
    bbInstance = await Barretenberg.new();
    console.log('Barretenberg initialized for Pedersen hashing');
  } catch (err) {
    console.warn(
      'Barretenberg not available. Install @aztec/bb.js for Pedersen tree support. ' +
      'Pedersen proofs will not be served until the dependency is installed.',
      err
    );
  }
}

// Precomputed Pedersen zero hashes (populated on startup if bb.js available)
let pedersenZeroHashes: string[] = [];

async function initPedersenZeroHashes(): Promise<void> {
  if (!bbInstance) return;

  let zeroHash = '0x' + '0'.repeat(64);
  pedersenZeroHashes = [zeroHash];

  for (let i = 0; i < TREE_DEPTH; i++) {
    const left = new bbFrClass(BigInt(zeroHash));
    const right = new bbFrClass(BigInt(zeroHash));
    const result = await bbInstance.pedersenHash([left, right], 0);
    const hex = Array.from(new Uint8Array(result.toBuffer()))
      .map((b: number) => (b as number).toString(16).padStart(2, '0'))
      .join('');
    zeroHash = '0x' + hex;
    pedersenZeroHashes.push(zeroHash);
  }

  console.log(`Pedersen zero hashes computed (${pedersenZeroHashes.length} levels)`);
}

function getPedersenZeroHash(level: number): string {
  return pedersenZeroHashes[level] || '0x' + '0'.repeat(64);
}

function getPedersenNode(level: number, index: number): string {
  const row = db.prepare('SELECT hash FROM pedersen_nodes WHERE level = ? AND index_at_level = ?').get(level, index) as { hash: string } | undefined;
  return row?.hash || getPedersenZeroHash(level);
}

function setPedersenNode(level: number, index: number, hash: string): void {
  db.prepare('INSERT OR REPLACE INTO pedersen_nodes (level, index_at_level, hash) VALUES (?, ?, ?)').run(level, index, hash);
}

async function pedersenHashPair(left: string, right: string): Promise<string> {
  if (!bbInstance) throw new Error('Barretenberg not initialized');

  const l = new bbFrClass(BigInt(left));
  const r = new bbFrClass(BigInt(right));
  const result = await bbInstance.pedersenHash([l, r], 0);
  const hex = Array.from(new Uint8Array(result.toBuffer()))
    .map((b: number) => (b as number).toString(16).padStart(2, '0'))
    .join('');
  return '0x' + hex;
}

async function insertLeafPedersen(commitment: string): Promise<number> {
  if (!bbInstance) return -1; // Pedersen not available

  const countResult = db.prepare('SELECT COUNT(*) as count FROM deposits').get() as { count: number };
  const leafIndex = countResult.count;

  let currentHash = commitment;
  let currentIndex = leafIndex;

  for (let level = 0; level < TREE_DEPTH; level++) {
    setPedersenNode(level, currentIndex, currentHash);

    const isRight = currentIndex % 2 === 1;
    const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;
    const sibling = getPedersenNode(level, siblingIndex);

    const left = isRight ? sibling : currentHash;
    const right = isRight ? currentHash : sibling;

    currentHash = await pedersenHashPair(left, right);
    currentIndex = Math.floor(currentIndex / 2);
  }

  setPedersenNode(TREE_DEPTH, 0, currentHash);
  return leafIndex;
}

function getPedersenMerkleProof(leafIndex: number): { root: string; pathElements: string[]; pathIndices: number[] } | null {
  if (pedersenZeroHashes.length === 0) return null; // Not initialized

  const pathElements: string[] = [];
  const pathIndices: number[] = [];
  let currentIndex = leafIndex;

  for (let level = 0; level < TREE_DEPTH; level++) {
    const isRight = currentIndex % 2 === 1;
    const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;

    pathElements.push(getPedersenNode(level, siblingIndex));
    pathIndices.push(isRight ? 1 : 0);

    currentIndex = Math.floor(currentIndex / 2);
  }

  const root = getPedersenNode(TREE_DEPTH, 0);

  return { root, pathElements, pathIndices };
}

function getCurrentPedersenRoot(): string | null {
  if (pedersenZeroHashes.length === 0) return null;
  return getPedersenNode(TREE_DEPTH, 0) || getPedersenZeroHash(TREE_DEPTH);
}

// ============ BLOCKCHAIN SYNC ============
const POOL_ABI = [
  'event Deposit(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp)',
  'function postPedersenRoot(bytes32 pedersenRoot, uint256 leafCount) external',
  'function historicalRoots(bytes32) external view returns (bool)',
];

const ROOT_POSTER_KEY = process.env.ROOT_POSTER_KEY || '';
let provider: ethers.JsonRpcProvider;
let poolContract: ethers.Contract;
let poolSigner: ethers.Contract | null = null; // Pool contract with signer for root posting
let lastPostedLeafCount = -1; // Track to avoid redundant posts

async function syncDeposits(): Promise<void> {
  if (!POOL_ADDRESS) {
    console.log('No pool address configured, skipping sync');
    return;
  }

  const lastBlockRow = db.prepare("SELECT value FROM sync_state WHERE key = 'last_block'").get() as { value: string } | undefined;
  const fromBlock = lastBlockRow ? parseInt(lastBlockRow.value) + 1 : START_BLOCK;
  const toBlock = await provider.getBlockNumber();

  if (fromBlock > toBlock) return;

  console.log(`Syncing deposits from block ${fromBlock} to ${toBlock}`);

  const filter = poolContract.filters.Deposit();
  const events = await poolContract.queryFilter(filter, fromBlock, toBlock);

  for (const event of events) {
    const log = event as ethers.EventLog;
    const commitment = log.args[0] as string;
    const leafIndex = Number(log.args[1]);
    const timestamp = Number(log.args[2]);

    const existing = db.prepare('SELECT id FROM deposits WHERE commitment = ?').get(commitment);
    if (existing) continue;

    // Insert into keccak256 tree (on-chain compatible)
    const expectedIndex = insertLeaf(commitment);
    if (expectedIndex !== leafIndex) {
      console.error(`Leaf index mismatch: expected ${expectedIndex}, got ${leafIndex}`);
    }

    // Insert into Pedersen tree (ZK-compatible)
    await insertLeafPedersen(commitment);

    const block = await log.getBlock();

    db.prepare(`
      INSERT INTO deposits (commitment, leaf_index, block_number, tx_hash, timestamp, amount, network)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      commitment,
      leafIndex,
      log.blockNumber,
      log.transactionHash,
      timestamp,
      '0', // Amount would need to be extracted from tx
      NETWORK_NAME
    );

    console.log(`Indexed deposit: ${commitment.slice(0, 10)}... at index ${leafIndex}`);
  }

  db.prepare("INSERT OR REPLACE INTO sync_state (key, value) VALUES ('last_block', ?)").run(toBlock.toString());

  // Post Pedersen root to the pool contract if new deposits were processed
  if (events.length > 0 && bbInstance && poolSigner) {
    await postPedersenRootToContract();
  }
}

async function postPedersenRootToContract(): Promise<void> {
  if (!poolSigner || !bbInstance) return;

  const pedersenRoot = getCurrentPedersenRoot();
  if (!pedersenRoot) return;

  const countResult = db.prepare('SELECT COUNT(*) as count FROM deposits').get() as { count: number };
  const leafCount = countResult.count;

  // Skip if we already posted for this leaf count
  if (leafCount === lastPostedLeafCount) return;

  try {
    // Check if root is already posted
    const alreadyPosted = await poolSigner.historicalRoots(pedersenRoot);
    if (alreadyPosted) {
      lastPostedLeafCount = leafCount;
      return;
    }

    console.log(`Posting Pedersen root: ${pedersenRoot.slice(0, 10)}... (${leafCount} leaves)`);
    const tx = await poolSigner.postPedersenRoot(pedersenRoot, leafCount);
    await tx.wait();
    lastPostedLeafCount = leafCount;
    console.log(`Pedersen root posted successfully (tx: ${tx.hash.slice(0, 10)}...)`);
  } catch (err) {
    console.error('Failed to post Pedersen root:', err instanceof Error ? err.message : err);
  }
}

// ============ API SERVER ============
const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// ============ HEALTH CHECK ============

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: 'ok' | 'error'; latencyMs?: number; error?: string };
    blockchain: { status: 'ok' | 'error' | 'not_configured'; latencyMs?: number; blockNumber?: number; error?: string };
    sync: { status: 'ok' | 'behind' | 'error'; lastBlock?: string; currentBlock?: number; blocksBehind?: number };
  };
  merkleRoot: string;
  totalDeposits: number;
  version: string;
}

const startTime = Date.now();
const VERSION = '1.0.0';

async function getHealthStatus(): Promise<HealthStatus> {
  const checks: HealthStatus['checks'] = {
    database: { status: 'ok' },
    blockchain: { status: 'not_configured' },
    sync: { status: 'ok' },
  };

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  let totalDeposits = 0;
  let merkleRoot = '';

  // Check database
  try {
    const dbStart = Date.now();
    const result = db.prepare('SELECT COUNT(*) as count FROM deposits').get() as { count: number };
    totalDeposits = result.count;
    merkleRoot = getCurrentRoot();
    checks.database = {
      status: 'ok',
      latencyMs: Date.now() - dbStart,
    };
  } catch (err) {
    checks.database = {
      status: 'error',
      error: err instanceof Error ? err.message : 'Unknown database error',
    };
    overallStatus = 'unhealthy';
  }

  // Check blockchain connection
  if (POOL_ADDRESS && provider) {
    try {
      const rpcStart = Date.now();
      const blockNumber = await provider.getBlockNumber();
      checks.blockchain = {
        status: 'ok',
        latencyMs: Date.now() - rpcStart,
        blockNumber,
      };

      // Check sync status
      const lastBlockRow = db.prepare("SELECT value FROM sync_state WHERE key = 'last_block'").get() as { value: string } | undefined;
      const lastSyncedBlock = lastBlockRow ? parseInt(lastBlockRow.value) : 0;
      const blocksBehind = blockNumber - lastSyncedBlock;

      if (blocksBehind > 100) {
        checks.sync = {
          status: 'behind',
          lastBlock: lastBlockRow?.value || '0',
          currentBlock: blockNumber,
          blocksBehind,
        };
        overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
      } else {
        checks.sync = {
          status: 'ok',
          lastBlock: lastBlockRow?.value || '0',
          currentBlock: blockNumber,
          blocksBehind,
        };
      }
    } catch (err) {
      checks.blockchain = {
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown RPC error',
      };
      checks.sync = {
        status: 'error',
      };
      overallStatus = 'degraded';
    }
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
    merkleRoot,
    totalDeposits,
    version: VERSION,
  };
}

// Simple health check (for load balancers)
app.get('/health', async (req, res) => {
  try {
    const health = await getHealthStatus();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// Liveness probe (is the service running?)
app.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
});

// Readiness probe (can the service handle requests?)
app.get('/health/ready', async (req, res) => {
  try {
    // Quick database check
    db.prepare('SELECT 1').get();
    res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'not_ready', error: err instanceof Error ? err.message : 'Database not available' });
  }
});

// Get current Merkle root (both keccak256 and Pedersen)
app.get('/api/root', (req, res) => {
  res.json({
    root: getCurrentRoot(),
    pedersenRoot: getCurrentPedersenRoot(),
  });
});

// Get Merkle proof for a commitment or leaf index
app.post('/api/merkle-proof', (req, res) => {
  const { commitment, leafIndex, network } = req.body;

  let resolvedLeafIndex: number;

  if (leafIndex !== undefined) {
    resolvedLeafIndex = Number(leafIndex);
  } else if (commitment) {
    const deposit = db.prepare('SELECT leaf_index FROM deposits WHERE commitment = ?').get(commitment) as { leaf_index: number } | undefined;
    if (!deposit) {
      return res.status(404).json({ error: 'Commitment not found in tree' });
    }
    resolvedLeafIndex = deposit.leaf_index;
  } else {
    return res.status(400).json({ error: 'Either commitment or leafIndex required' });
  }

  const proof = getMerkleProof(resolvedLeafIndex);

  // Check if client requests Pedersen proof (for ZK circuits)
  const usePedersen = req.body.pedersen === true;

  if (usePedersen) {
    const pedersenProof = getPedersenMerkleProof(resolvedLeafIndex);
    if (!pedersenProof) {
      return res.status(503).json({
        error: 'Pedersen tree not available. Install @aztec/bb.js and restart the indexer.',
      });
    }
    res.json({
      ...pedersenProof,
      leafIndex: resolvedLeafIndex,
      hashType: 'pedersen',
    });
  } else {
    res.json({
      ...proof,
      leafIndex: resolvedLeafIndex,
      hashType: 'keccak256',
    });
  }
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
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
  const offset = parseInt(req.query.offset as string) || 0;

  const deposits = db.prepare('SELECT * FROM deposits ORDER BY leaf_index DESC LIMIT ? OFFSET ?').all(limit, offset);
  const total = (db.prepare('SELECT COUNT(*) as count FROM deposits').get() as { count: number }).count;

  res.json({ deposits, total, limit, offset });
});

// Get stats
app.get('/api/stats', (req, res) => {
  const total = (db.prepare('SELECT COUNT(*) as count FROM deposits').get() as { count: number }).count;
  const root = getCurrentRoot();
  const lastBlockRow = db.prepare("SELECT value FROM sync_state WHERE key = 'last_block'").get() as { value: string } | undefined;

  res.json({
    totalDeposits: total,
    merkleRoot: root,
    lastSyncedBlock: lastBlockRow?.value || '0',
    treeDepth: TREE_DEPTH,
  });
});

// ============ STARTUP ============
async function start(): Promise<void> {
  console.log('Starting Laundry Cash Indexer...');

  // Initialize Barretenberg WASM for Pedersen hashing
  await initBarretenberg();
  await initPedersenZeroHashes();

  if (POOL_ADDRESS) {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);

    // Set up root poster signer if key is configured
    if (ROOT_POSTER_KEY) {
      const signer = new ethers.Wallet(ROOT_POSTER_KEY, provider);
      poolSigner = new ethers.Contract(POOL_ADDRESS, POOL_ABI, signer);
      console.log(`Root poster address: ${signer.address}`);
    } else {
      console.warn('ROOT_POSTER_KEY not configured. Pedersen roots will not be posted on-chain.');
    }

    // Initial sync
    await syncDeposits();

    // Periodic sync
    setInterval(syncDeposits, POLL_INTERVAL);
  }

  app.listen(PORT, () => {
    console.log(`Indexer API running on port ${PORT}`);
    console.log(`Chain: ${CHAIN_ID} (${NETWORK_NAME})`);
    console.log(`Pool address: ${POOL_ADDRESS || 'not configured'}`);
    console.log(`Keccak root: ${getCurrentRoot()}`);
    console.log(`Pedersen root: ${getCurrentPedersenRoot() || 'not available'}`);
  });
}

start().catch(console.error);
