import { ethers } from 'ethers';
import type { Note, Network } from '@/types';

// ============ CONFIGURATION ============
const IS_PRODUCTION = process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';
const INDEXER_API = process.env.NEXT_PUBLIC_INDEXER_API || (IS_PRODUCTION ? '' : 'http://localhost:3001');
const CIRCUITS_BASE_URL = process.env.NEXT_PUBLIC_CIRCUITS_URL || '/circuits';
const TREE_DEPTH = 20; // Must match Noir circuit withdrawal/src/main.nr

// Validate production configuration at module load time
if (IS_PRODUCTION && (!INDEXER_API || INDEXER_API.includes('localhost') || INDEXER_API.includes('127.0.0.1'))) {
  console.error('FATAL: NEXT_PUBLIC_INDEXER_API must be set to a non-localhost URL in production');
}

// ============ FIELD MODULUS ============
// BN254 scalar field (also Grumpkin base field) — Barretenberg Fr operates in this field.
// All values passed to pedersenHash must be < this modulus.
const FIELD_MODULUS = BigInt('0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001');

// Reduce a bigint to be within the BN254 field
function toField(value: bigint): bigint {
  const reduced = ((value % FIELD_MODULUS) + FIELD_MODULUS) % FIELD_MODULUS;
  return reduced;
}

// Generate a random field element (guaranteed < FIELD_MODULUS)
function randomFieldElement(): string {
  const bytes = randomBytes(32);
  const value = BigInt(bytesToHex(bytes));
  const reduced = toField(value);
  return '0x' + reduced.toString(16).padStart(64, '0');
}

// ============ RANDOM BYTES ============
export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ============ BARRETENBERG PEDERSEN HASH ============
// Singleton Barretenberg instance for Pedersen hash (Grumpkin curve).
// In @aztec/bb.js@0.58.0, pedersenHash() is directly available on the instance.
// Matches Noir circuit's dep::std::hash::pedersen_hash exactly.

let bbInstance: any = null;
let bbFr: any = null;
let bbInitPromise: Promise<void> | null = null;

async function initBarretenberg(): Promise<void> {
  if (bbInstance) return;
  if (bbInitPromise) return bbInitPromise;

  bbInitPromise = (async () => {
    const { Barretenberg, Fr } = await import('@aztec/bb.js');
    bbFr = Fr;
    bbInstance = await Barretenberg.new();
    console.log('Barretenberg Pedersen hash initialized');
  })();

  return bbInitPromise;
}

// Helper: compute pedersen_hash([a, b], 0) — matches Noir's pedersen_hash
// All inputs are reduced mod FIELD_MODULUS to prevent "value >= field modulus" errors.
async function pedersenHash2(a: bigint, b: bigint): Promise<string> {
  await initBarretenberg();
  const frA = new bbFr(toField(a));
  const frB = new bbFr(toField(b));
  const result = await bbInstance.pedersenHash([frA, frB], 0);
  const hex = Array.from(new Uint8Array(result.toBuffer()))
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('');
  return '0x' + hex;
}

// ============ NOTE GENERATION ============
// Generate note with Pedersen-compatible commitment (async — requires WASM)
export async function generateNote(
  amount: string,
  network: Network
): Promise<Omit<Note, 'leafIndex' | 'timestamp' | 'status'>> {
  await initBarretenberg();

  // Secret for note ownership (must be valid field element)
  const secret = randomFieldElement();

  // Randomness for Pedersen commitment (must be valid field element)
  const commitmentRandomness = randomFieldElement();

  // Compute inner commitment = pedersen_hash([amount, randomness], 0)
  const amountWei = ethers.parseEther(amount);
  const innerCommitment = await pedersenHash2(amountWei, BigInt(commitmentRandomness));

  // Compute leaf = pedersen_hash([innerCommitment, secret], 0)
  // This is what gets stored in the on-chain Merkle tree via deposit().
  // The circuit recomputes leaf = H(H(amount, rand), secret) and verifies the Merkle path.
  const leaf = await pedersenHash2(BigInt(innerCommitment), BigInt(secret));

  // Compute nullifier = pedersen_hash([secret, leafIndex], 0)
  // leafIndex is 0 initially, updated after deposit
  const nullifier = await pedersenHash2(BigInt(secret), BigInt(0));

  const id = ethers.keccak256(
    ethers.toUtf8Bytes(`${Date.now()}-${Math.random()}`)
  ).slice(0, 18);

  return {
    id,
    currency: 'ETH',
    amount,
    commitment: leaf, // Store leaf as commitment — this is what goes into the Merkle tree
    nullifier,
    secret: `${secret}:${commitmentRandomness}`,
    network,
  };
}

// Compute leaf for Merkle tree: leaf = pedersen_hash([commitment, secret], 0)
export async function computeLeaf(commitment: string, secret: string): Promise<string> {
  const secretOnly = secret.split(':')[0];
  return pedersenHash2(BigInt(commitment), BigInt(secretOnly));
}

// ============ NETWORK SHORT CODES ============
const NETWORK_SHORT: Record<Network, string> = {
  ethereum: 'eth',
  arbitrum: 'arb',
  polygon: 'pol',
};

const SHORT_TO_NETWORK: Record<string, Network> = {
  eth: 'ethereum',
  arb: 'arbitrum',
  pol: 'polygon',
  // Backward compat: full names
  ethereum: 'ethereum',
  arbitrum: 'arbitrum',
  polygon: 'polygon',
};

// ============ NOTE ENCODING/DECODING ============
// Compact Tornado-style format: laundry-eth-1.0-0x{secret}{randomness}
// ~150 chars total vs ~400+ with old base64 JSON format

export function encodeNote(note: Note): string {
  // Extract secret and randomness
  const [secret, randomness] = note.secret.includes(':')
    ? note.secret.split(':')
    : [note.secret, note.secret];

  // Strip 0x prefix for compact encoding
  const secretHex = secret.startsWith('0x') ? secret.slice(2) : secret;
  const randomnessHex = randomness.startsWith('0x') ? randomness.slice(2) : randomness;

  // Encode leafIndex as 8-char hex (4 bytes, supports up to ~4 billion deposits)
  const leafIndexHex = (note.leafIndex >>> 0).toString(16).padStart(8, '0');

  const networkShort = NETWORK_SHORT[note.network] || note.network;

  // Format: laundry-{net}-{amount}-0x{secret}{randomness}{leafIndex}
  return `laundry-${networkShort}-${note.amount}-0x${secretHex}${randomnessHex}${leafIndexHex}`;
}

export function decodeNote(noteString: string): Partial<Note> | null {
  try {
    if (!noteString.startsWith('laundry-')) {
      throw new Error('Invalid note format');
    }

    // Try compact hex format first
    const compactResult = decodeCompactNote(noteString);
    if (compactResult) return compactResult;

    // Fall back to legacy base64 JSON format
    return decodeLegacyNote(noteString);
  } catch (error) {
    console.error('Failed to decode note:', error);
    return null;
  }
}

function decodeCompactNote(noteString: string): Partial<Note> | null {
  try {
    // Format: laundry-{net}-{amount}-0x{secret:64}{randomness:64}{leafIndex:8}
    const parts = noteString.split('-');
    if (parts.length < 4 || parts[0] !== 'laundry') return null;

    // Reconstruct network code (handles 'arb-sep' which splits into extra parts)
    let networkCode: string;
    let amount: string;
    let hexData: string;

    if (parts.length === 4) {
      // laundry-eth-1.0-0x...
      networkCode = parts[1];
      amount = parts[2];
      hexData = parts[3];
    } else if (parts.length === 5 && !parts[3].startsWith('0x')) {
      // laundry-arb-sep-1.0-0x...
      networkCode = `${parts[1]}-${parts[2]}`;
      amount = parts[3];
      hexData = parts[4];
    } else {
      return null; // Not compact format
    }

    // Must start with 0x and be correct length (64+64+8 = 136 hex chars)
    if (!hexData.startsWith('0x') || hexData.length !== 138) {
      return null; // Not compact format, try legacy
    }

    const hex = hexData.slice(2); // Remove 0x
    const secret = '0x' + hex.slice(0, 64);
    const randomness = '0x' + hex.slice(64, 128);
    const leafIndex = parseInt(hex.slice(128, 136), 16);

    const network = SHORT_TO_NETWORK[networkCode];
    if (!network) return null;

    // Note: commitment and nullifier will be recomputed asynchronously when needed.
    // For decoding, we store the raw data; the caller must use recomputeNoteHashes()
    // to get the correct Pedersen commitment/nullifier before using them.
    return {
      network,
      amount,
      commitment: '0x' + '0'.repeat(64), // placeholder — recomputed async
      nullifier: '0x' + '0'.repeat(64), // placeholder — recomputed async
      secret: `${secret}:${randomness}`,
      leafIndex,
      currency: 'ETH',
    };
  } catch {
    return null;
  }
}

// Recompute commitment (leaf) and nullifier from note data using Pedersen hash
export async function recomputeNoteHashes(note: Partial<Note>): Promise<Partial<Note>> {
  if (!note.amount || !note.secret) return note;

  await initBarretenberg();

  const [secret, randomness] = note.secret.includes(':')
    ? note.secret.split(':')
    : [note.secret, note.secret];

  const amountWei = ethers.parseEther(note.amount);
  const innerCommitment = await pedersenHash2(amountWei, BigInt(randomness));
  const leaf = await pedersenHash2(BigInt(innerCommitment), BigInt(secret));
  const nullifier = await pedersenHash2(BigInt(secret), BigInt(note.leafIndex ?? 0));

  return { ...note, commitment: leaf, nullifier };
}

function decodeLegacyNote(noteString: string): Partial<Note> | null {
  try {
    const parts = noteString.split('-');
    if (parts.length < 4 || parts[0] !== 'laundry') {
      throw new Error('Invalid note format');
    }

    const network = (SHORT_TO_NETWORK[parts[1]] || parts[1]) as Network;
    const amount = parts[2];
    const encoded = parts.slice(3).join('-');

    const jsonString = Buffer.from(encoded, 'base64').toString('utf-8');
    const data = JSON.parse(jsonString);

    return {
      network: data.n || network,
      amount: data.a || amount,
      commitment: data.c,
      nullifier: data.u,
      secret: data.s,
      leafIndex: data.i,
      currency: 'ETH',
    };
  } catch {
    return null;
  }
}

export function isValidNote(noteString: string): boolean {
  if (!noteString.startsWith('laundry-')) return false;

  const decoded = decodeNote(noteString);
  if (!decoded) return false;

  return Boolean(
    decoded.secret &&
    decoded.amount &&
    decoded.network
  );
}

// ============ MERKLE TREE ============
interface MerkleProof {
  root: string;
  pathElements: string[];
  pathIndices: number[];
  leafIndex: number;
}

export async function fetchMerkleProof(
  commitment: string,
  network: Network
): Promise<MerkleProof> {
  try {
    // Request Pedersen proof from indexer (ZK-compatible)
    const response = await fetch(`${INDEXER_API}/api/merkle-proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitment, network, pedersen: true }),
    });

    if (!response.ok) {
      throw new Error(`Indexer API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    // SECURITY: Never use mock proofs in production
    if (IS_PRODUCTION) {
      throw new Error(
        'Failed to fetch Merkle proof from indexer. ' +
        'Please try again later or contact support.'
      );
    }
    console.warn('DEV MODE: Using mock Merkle proof (NOT VALID FOR REAL TRANSACTIONS):', error);
    return generateMockMerkleProof(commitment);
  }
}

function generateMockMerkleProof(commitment: string): MerkleProof {
  const pathElements: string[] = [];
  const pathIndices: number[] = [];

  for (let i = 0; i < TREE_DEPTH; i++) {
    pathElements.push(ethers.keccak256(ethers.toUtf8Bytes(`mock-sibling-${i}`)));
    pathIndices.push(0);
  }

  let currentHash = commitment;
  for (let i = 0; i < TREE_DEPTH; i++) {
    const left = pathIndices[i] === 0 ? currentHash : pathElements[i];
    const right = pathIndices[i] === 0 ? pathElements[i] : currentHash;
    currentHash = ethers.keccak256(ethers.concat([left, right]));
  }

  return {
    root: currentHash,
    pathElements,
    pathIndices,
    leafIndex: 0,
  };
}

// ============ PROOF GENERATION ============
interface ProofResult {
  proof: string;
  publicInputs: string[];
}

// Noir circuit input structure (matches withdrawal/src/main.nr)
interface NoirCircuitInputs {
  merkle_root: string;
  nullifier: string;
  recipient: string;
  amount: string;
  secret: string;
  commitment_randomness: string;
  merkle_path: string[];
  merkle_indices: number[];
}

// Cache for loaded circuit
let circuitCache: {
  json?: object;
  backend?: unknown;
  noir?: unknown;
} = {};

async function loadNoirCircuit() {
  if (circuitCache.json && circuitCache.backend && circuitCache.noir) {
    return circuitCache;
  }

  // Load circuit JSON (nargo 0.36.0 artifact — matches UltraVerifier.sol)
  const circuitResponse = await fetch(`${CIRCUITS_BASE_URL}/withdrawal.json`);
  if (!circuitResponse.ok) {
    throw new Error('Failed to load circuit');
  }
  const circuitJson = await circuitResponse.json();

  // noir_js 0.36.0 + backend_barretenberg 0.36.0 (UltraPlonk)
  const { Noir } = await import('@noir-lang/noir_js');
  const { BarretenbergBackend } = await import('@noir-lang/backend_barretenberg');

  const backend = new BarretenbergBackend(circuitJson);
  const noir = new Noir(circuitJson);

  circuitCache = { json: circuitJson, backend, noir };
  return circuitCache;
}

export async function generateWithdrawalProof(
  note: Note,
  recipient: string,
  _relayer: string, // Reserved for relayer fee handling
  _fee: string // Reserved for fee calculation
): Promise<ProofResult> {
  // Fetch Pedersen Merkle proof from indexer
  const merkleProof = await fetchMerkleProof(note.commitment, note.network);

  // Parse secret (contains secret:randomness)
  const [secret, commitmentRandomness] = note.secret.includes(':')
    ? note.secret.split(':')
    : [note.secret, note.secret];

  // Prepare circuit inputs
  const amountWei = ethers.parseEther(note.amount);

  // Recompute nullifier with actual leaf index from the Merkle proof
  const nullifier = await pedersenHash2(BigInt(secret), BigInt(merkleProof.leafIndex));

  const circuitInputs: NoirCircuitInputs = {
    merkle_root: merkleProof.root,
    nullifier,
    recipient: ethers.zeroPadValue(recipient, 32),
    amount: ethers.zeroPadValue(ethers.toBeHex(amountWei), 32),
    secret,
    commitment_randomness: commitmentRandomness,
    merkle_path: merkleProof.pathElements.slice(0, TREE_DEPTH),
    merkle_indices: merkleProof.pathIndices.slice(0, TREE_DEPTH),
  };

  try {
    // Add timeout to prevent indefinite hanging
    const PROOF_TIMEOUT_MS = 60000; // 60 seconds
    const proofPromise = generateNoirProof(circuitInputs, merkleProof.root);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Proof generation timed out after 60 seconds')), PROOF_TIMEOUT_MS);
    });

    const proof = await Promise.race([proofPromise, timeoutPromise]);
    return proof;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Proof generation failed:', errorMessage);

    // SECURITY: Never use mock proofs in production
    if (IS_PRODUCTION) {
      throw new Error(
        `Proof generation failed: ${errorMessage}. ` +
        'Please try again or contact support if the issue persists.'
      );
    }

    // Development only: fall back to mock proof for testing
    console.warn('DEV MODE: Using mock proof (NOT VALID FOR REAL TRANSACTIONS)');
    return generateMockProof(
      merkleProof.root,
      nullifier,
      recipient,
      note.amount
    );
  }
}

// ============ RETRY UTILITIES ============

interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
): Promise<T> {
  const { maxAttempts, initialDelayMs, maxDelayMs, backoffMultiplier } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: Error = new Error('Unknown error');
  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        break;
      }

      // Notify about retry
      if (onRetry) {
        onRetry(attempt, lastError, delayMs);
      }

      // Wait before retrying
      await sleep(delayMs);

      // Exponential backoff with jitter
      const jitter = Math.random() * 0.3 + 0.85; // 0.85-1.15 multiplier
      delayMs = Math.min(delayMs * backoffMultiplier * jitter, maxDelayMs);
    }
  }

  throw lastError;
}

// ============ PROOF GENERATION WITH RETRY ============

async function generateNoirProof(inputs: NoirCircuitInputs, merkleRoot: string): Promise<ProofResult> {
  return withRetry(
    async () => {
      const { noir, backend } = await loadNoirCircuit();

      if (!noir || !backend) {
        throw new Error('Noir circuit not loaded');
      }

      // noir_js 0.36.0 API: execute circuit to get witness
      // @ts-expect-error - Noir types
      const { witness } = await noir.execute(inputs);

      // BarretenbergBackend 0.36.0 (UltraPlonk)
      // @ts-expect-error - Backend types
      const proofData = await backend.generateProof(witness);

      // proofData.proof is Uint8Array of the raw proof
      const rawProof = proofData.proof as Uint8Array;

      // Pool contract expects proof format: [merkle_root (32 bytes)] [proof_bytes]
      // _extractRootFromProof takes proof[:32] as root, proof[32:] goes to verifier
      const rootBytes = hexToBytes(merkleRoot);
      const fullProof = new Uint8Array(32 + rawProof.length);
      fullProof.set(rootBytes, 0);
      fullProof.set(rawProof, 32);

      const proofHex = '0x' + Array.from(fullProof)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Extract public inputs from proof
      const publicInputs = proofData.publicInputs as string[];

      return {
        proof: proofHex,
        publicInputs,
      };
    },
    {
      maxAttempts: 3,
      initialDelayMs: 500,
      maxDelayMs: 5000,
    },
    (attempt, error, delayMs) => {
      console.warn(`Proof generation attempt ${attempt} failed: ${error.message}. Retrying in ${delayMs}ms...`);
    }
  );
}

function generateMockProof(
  merkleRoot: string,
  nullifier: string,
  recipient: string,
  amount: string
): ProofResult {
  // Mock proof: [merkle_root (32 bytes)] [fake proof (256 bytes)]
  const mockProofElements: string[] = [];
  for (let i = 0; i < 8; i++) {
    mockProofElements.push(
      ethers.keccak256(ethers.toUtf8Bytes(`mock-proof-${i}-${Date.now()}`))
    );
  }

  const fakeProofBytes = ethers.AbiCoder.defaultAbiCoder().encode(
    ['uint256[8]'],
    [mockProofElements.map(e => BigInt(e))]
  );

  // Prepend merkle root
  const rootBytes = merkleRoot.startsWith('0x') ? merkleRoot : '0x' + merkleRoot;
  const proofHex = rootBytes + fakeProofBytes.slice(2); // concat without double 0x

  const amountWei = ethers.parseEther(amount);
  const publicInputs = [
    merkleRoot,
    nullifier,
    ethers.zeroPadValue(recipient, 32),
    ethers.zeroPadValue(ethers.toBeHex(amountWei), 32),
  ];

  return {
    proof: proofHex,
    publicInputs,
  };
}

// ============ CRYPTOGRAPHIC FUNCTIONS ============
// Compute nullifier hash using Pedersen (matches circuit: pedersen_hash([secret, leaf_index]))
export async function computeNullifierHash(secret: string, leafIndex: number): Promise<string> {
  const secretOnly = secret.split(':')[0];
  return pedersenHash2(BigInt(secretOnly), BigInt(leafIndex));
}

export async function computeCommitment(amount: string, randomness: string): Promise<string> {
  const amountWei = ethers.parseEther(amount);
  return pedersenHash2(amountWei, BigInt(randomness));
}

// ============ AMOUNT UTILITIES ============
export function parseAmount(amount: string): bigint | null {
  try {
    return ethers.parseEther(amount);
  } catch {
    return null;
  }
}

export function formatAmount(wei: bigint): string {
  return ethers.formatEther(wei);
}

// ============ VALIDATION ============
export function isValidAddress(address: string): boolean {
  return ethers.isAddress(address);
}

export function isValidAmount(amount: string, min = '0.1', max = '100'): boolean {
  const parsed = parseAmount(amount);
  if (!parsed) return false;

  const minWei = ethers.parseEther(min);
  const maxWei = ethers.parseEther(max);

  return parsed >= minWei && parsed <= maxWei;
}
