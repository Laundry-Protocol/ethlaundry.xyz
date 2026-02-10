//! Light Client for cross-chain block header synchronization
//!
//! Maintains block headers for Ethereum and Arbitrum chains,
//! enabling verification of cross-chain transactions.

use anyhow::Result;
use ethers::prelude::*;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{debug, info, warn};

/// Events emitted by the light client
#[derive(Debug, Clone)]
pub enum LightClientEvent {
    /// New block received and verified
    NewBlock {
        chain_id: u64,
        block_number: u64,
        block_hash: H256,
    },
    /// Chain reorganization detected
    Reorg { chain_id: u64, depth: u64 },
}

/// Stored block header
#[derive(Debug, Clone)]
pub struct StoredHeader {
    pub block_number: u64,
    pub block_hash: H256,
    pub parent_hash: H256,
    pub state_root: H256,
    pub transactions_root: H256,
    pub receipts_root: H256,
    pub timestamp: u64,
}

/// Light client for multiple chains
pub struct LightClient {
    /// Ethereum provider
    eth_provider: Arc<Provider<Http>>,
    /// Arbitrum provider
    arb_provider: Arc<Provider<Http>>,
    /// Stored headers by chain ID
    headers: HashMap<u64, Vec<StoredHeader>>,
    /// Latest finalized block by chain
    finalized: HashMap<u64, u64>,
    /// Event sender
    event_tx: mpsc::Sender<LightClientEvent>,
    /// Event receiver
    event_rx: mpsc::Receiver<LightClientEvent>,
    /// Finality depth
    finality_depth: u64,
}

impl LightClient {
    /// Create a new light client
    pub async fn new(eth_rpc: &str, arb_rpc: &str) -> Result<Self> {
        let eth_provider = Arc::new(Provider::<Http>::try_from(eth_rpc)?);
        let arb_provider = Arc::new(Provider::<Http>::try_from(arb_rpc)?);

        let (event_tx, event_rx) = mpsc::channel(1000);

        let mut client = Self {
            eth_provider,
            arb_provider,
            headers: HashMap::new(),
            finalized: HashMap::new(),
            event_tx,
            event_rx,
            finality_depth: 15,
        };

        // Initialize with current block
        client.sync_initial().await?;

        Ok(client)
    }

    /// Perform initial synchronization
    async fn sync_initial(&mut self) -> Result<()> {
        // Get current Ethereum block
        let eth_block = self.eth_provider.get_block_number().await?;
        info!(block = eth_block.as_u64(), "Ethereum sync starting");

        // Get current Arbitrum block
        let arb_block = self.arb_provider.get_block_number().await?;
        info!(block = arb_block.as_u64(), "Arbitrum sync starting");

        // Fetch recent headers
        let eth_chain_id = self.eth_provider.get_chainid().await?.as_u64();
        let arb_chain_id = self.arb_provider.get_chainid().await?.as_u64();

        self.sync_headers(&self.eth_provider.clone(), eth_chain_id, eth_block.as_u64())
            .await?;
        self.sync_headers(&self.arb_provider.clone(), arb_chain_id, arb_block.as_u64())
            .await?;

        Ok(())
    }

    /// Sync headers from a starting block
    async fn sync_headers(
        &mut self,
        provider: &Provider<Http>,
        chain_id: u64,
        current_block: u64,
    ) -> Result<()> {
        let start_block = current_block.saturating_sub(self.finality_depth * 2);
        let mut headers = Vec::new();

        for block_num in start_block..=current_block {
            if let Some(block) = provider
                .get_block(BlockId::Number(block_num.into()))
                .await?
            {
                headers.push(StoredHeader {
                    block_number: block.number.unwrap().as_u64(),
                    block_hash: block.hash.unwrap(),
                    parent_hash: block.parent_hash,
                    state_root: block.state_root,
                    transactions_root: block.transactions_root,
                    receipts_root: block.receipts_root,
                    timestamp: block.timestamp.as_u64(),
                });
            }
        }

        self.headers.insert(chain_id, headers);
        self.finalized
            .insert(chain_id, current_block.saturating_sub(self.finality_depth));

        info!(
            chain_id = chain_id,
            headers = self.headers.get(&chain_id).map_or(0, |h| h.len()),
            "Headers synchronized"
        );

        Ok(())
    }

    /// Get the next event from the light client
    pub async fn next_event(&mut self) -> Option<LightClientEvent> {
        // Poll for new blocks
        self.poll_new_blocks().await.ok();
        self.event_rx.recv().await
    }

    /// Poll for new blocks on all chains
    async fn poll_new_blocks(&mut self) -> Result<()> {
        // Check Ethereum
        let eth_chain_id = self.eth_provider.get_chainid().await?.as_u64();
        let eth_current = self.eth_provider.get_block_number().await?.as_u64();

        if let Some(headers) = self.headers.get(&eth_chain_id) {
            if let Some(latest) = headers.last() {
                if eth_current > latest.block_number {
                    self.process_new_block(&self.eth_provider.clone(), eth_chain_id, eth_current)
                        .await?;
                }
            }
        }

        // Check Arbitrum
        let arb_chain_id = self.arb_provider.get_chainid().await?.as_u64();
        let arb_current = self.arb_provider.get_block_number().await?.as_u64();

        if let Some(headers) = self.headers.get(&arb_chain_id) {
            if let Some(latest) = headers.last() {
                if arb_current > latest.block_number {
                    self.process_new_block(&self.arb_provider.clone(), arb_chain_id, arb_current)
                        .await?;
                }
            }
        }

        Ok(())
    }

    /// Process a new block
    async fn process_new_block(
        &mut self,
        provider: &Provider<Http>,
        chain_id: u64,
        block_number: u64,
    ) -> Result<()> {
        if let Some(block) = provider
            .get_block(BlockId::Number(block_number.into()))
            .await?
        {
            let header = StoredHeader {
                block_number: block.number.unwrap().as_u64(),
                block_hash: block.hash.unwrap(),
                parent_hash: block.parent_hash,
                state_root: block.state_root,
                transactions_root: block.transactions_root,
                receipts_root: block.receipts_root,
                timestamp: block.timestamp.as_u64(),
            };

            // Check for reorg
            if let Some(headers) = self.headers.get_mut(&chain_id) {
                if let Some(last) = headers.last() {
                    if header.parent_hash != last.block_hash {
                        // Reorg detected
                        let depth = self.handle_reorg(chain_id, &header).await?;
                        let _ = self.event_tx.send(LightClientEvent::Reorg { chain_id, depth }).await;
                    }
                }

                headers.push(header.clone());

                // Prune old headers
                while headers.len() > 1000 {
                    headers.remove(0);
                }
            }

            // Update finalized
            if block_number > self.finality_depth {
                self.finalized
                    .insert(chain_id, block_number - self.finality_depth);
            }

            // Emit event
            let _ = self
                .event_tx
                .send(LightClientEvent::NewBlock {
                    chain_id,
                    block_number: header.block_number,
                    block_hash: header.block_hash,
                })
                .await;
        }

        Ok(())
    }

    /// Handle chain reorganization
    async fn handle_reorg(&mut self, chain_id: u64, new_header: &StoredHeader) -> Result<u64> {
        let headers = self.headers.get_mut(&chain_id).unwrap();

        // Find common ancestor
        let mut depth = 0u64;
        while let Some(header) = headers.pop() {
            depth += 1;
            if header.block_hash == new_header.parent_hash {
                break;
            }
        }

        warn!(chain_id = chain_id, depth = depth, "Reorg handled");
        Ok(depth)
    }

    /// Get block header by hash
    pub fn get_header(&self, chain_id: u64, block_hash: H256) -> Option<&StoredHeader> {
        self.headers
            .get(&chain_id)?
            .iter()
            .find(|h| h.block_hash == block_hash)
    }

    /// Get latest finalized block number
    pub fn get_finalized(&self, chain_id: u64) -> Option<u64> {
        self.finalized.get(&chain_id).copied()
    }

    /// Verify a transaction inclusion proof
    pub fn verify_inclusion(
        &self,
        chain_id: u64,
        block_hash: H256,
        tx_hash: H256,
        proof: &[H256],
    ) -> bool {
        if let Some(header) = self.get_header(chain_id, block_hash) {
            // Verify Merkle proof against transactions_root
            verify_merkle_proof(tx_hash, proof, header.transactions_root)
        } else {
            false
        }
    }

    /// Shutdown the light client
    pub async fn shutdown(&mut self) -> Result<()> {
        info!("Shutting down light client");
        Ok(())
    }
}

/// Verify a Merkle proof
fn verify_merkle_proof(leaf: H256, proof: &[H256], root: H256) -> bool {
    let mut current = leaf;
    for sibling in proof {
        // Combine hashes (simplified - actual implementation depends on tree structure)
        current = H256::from_slice(
            &ethers::utils::keccak256([current.as_bytes(), sibling.as_bytes()].concat()),
        );
    }
    current == root
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_header_storage() {
        let header = StoredHeader {
            block_number: 1,
            block_hash: H256::zero(),
            parent_hash: H256::zero(),
            state_root: H256::zero(),
            transactions_root: H256::zero(),
            receipts_root: H256::zero(),
            timestamp: 0,
        };

        assert_eq!(header.block_number, 1);
    }
}
