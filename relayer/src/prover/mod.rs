//! ZK Prover Service
//!
//! Generates ZK proofs for withdrawal and transfer operations.
//! Can offload proving to specialized hardware or external services.

use anyhow::Result;
use std::sync::Arc;
use tokio::sync::{mpsc, Semaphore};
use tracing::{debug, info};

use crate::ProverConfig;

/// Proof request types
#[derive(Debug, Clone)]
pub enum ProofRequest {
    /// Withdrawal proof
    Withdrawal {
        merkle_root: [u8; 32],
        nullifier: [u8; 32],
        recipient: [u8; 20],
        amount: u64,
        secret: [u8; 32],
        randomness: [u8; 32],
        merkle_path: Vec<[u8; 32]>,
        merkle_indices: Vec<u8>,
    },
    /// Transfer proof
    Transfer {
        merkle_root: [u8; 32],
        nullifier: [u8; 32],
        new_commitment_a: [u8; 32],
        new_commitment_b: [u8; 32],
        secret: [u8; 32],
        randomness: [u8; 32],
        merkle_path: Vec<[u8; 32]>,
        merkle_indices: Vec<u8>,
    },
    /// Consistency proof (Pedersen ↔ Paillier)
    Consistency {
        pedersen_commitment: [u8; 32],
        paillier_ciphertext: Vec<u8>,
        value: u64,
        pedersen_randomness: [u8; 32],
        paillier_randomness: Vec<u8>,
    },
    /// Range proof
    Range {
        commitment: [u8; 32],
        min_value: u64,
        value: u64,
        randomness: [u8; 32],
    },
}

/// Generated proof
#[derive(Debug, Clone)]
pub struct GeneratedProof {
    pub proof_type: String,
    pub proof_data: Vec<u8>,
    pub public_inputs: Vec<[u8; 32]>,
    pub generation_time_ms: u64,
}

/// Prover service for generating ZK proofs
pub struct ProverService {
    /// Configuration
    config: ProverConfig,
    /// Semaphore for concurrency control
    semaphore: Arc<Semaphore>,
    /// Request channel
    request_tx: mpsc::Sender<(ProofRequest, mpsc::Sender<Result<GeneratedProof>>)>,
}

impl ProverService {
    /// Create a new prover service
    pub fn new(config: &ProverConfig) -> Result<Self> {
        let semaphore = Arc::new(Semaphore::new(config.max_concurrent));
        let (request_tx, mut request_rx) = mpsc::channel::<(
            ProofRequest,
            mpsc::Sender<Result<GeneratedProof>>,
        )>(100);

        // Spawn worker task
        let worker_semaphore = semaphore.clone();
        let timeout_secs = config.timeout_secs;

        tokio::spawn(async move {
            while let Some((request, response_tx)) = request_rx.recv().await {
                let permit = worker_semaphore.clone().acquire_owned().await;
                if permit.is_err() {
                    continue;
                }

                tokio::spawn(async move {
                    let result = tokio::time::timeout(
                        std::time::Duration::from_secs(timeout_secs),
                        generate_proof(request),
                    )
                    .await
                    .map_err(|_| anyhow::anyhow!("Proof generation timeout"))
                    .and_then(|r| r);

                    let _ = response_tx.send(result).await;
                    drop(permit);
                });
            }
        });

        Ok(Self {
            config: config.clone(),
            semaphore,
            request_tx,
        })
    }

    /// Generate a proof asynchronously
    pub async fn generate(&self, request: ProofRequest) -> Result<GeneratedProof> {
        if !self.config.enabled {
            return Err(anyhow::anyhow!("Prover service is disabled"));
        }

        let (response_tx, mut response_rx) = mpsc::channel(1);
        self.request_tx.send((request, response_tx)).await?;

        response_rx
            .recv()
            .await
            .ok_or_else(|| anyhow::anyhow!("Prover channel closed"))?
    }

    /// Check if prover is available
    pub fn is_available(&self) -> bool {
        self.config.enabled && self.semaphore.available_permits() > 0
    }

    /// Get current queue depth
    pub fn queue_depth(&self) -> usize {
        self.config.max_concurrent - self.semaphore.available_permits()
    }
}

/// Generate a proof (actual implementation would use Noir prover)
async fn generate_proof(request: ProofRequest) -> Result<GeneratedProof> {
    let start = std::time::Instant::now();

    let (proof_type, proof_data, public_inputs) = match request {
        ProofRequest::Withdrawal {
            merkle_root,
            nullifier,
            recipient,
            amount,
            secret,
            randomness,
            merkle_path,
            merkle_indices,
        } => {
            info!("Generating withdrawal proof");

            // In production, this would:
            // 1. Load the compiled Noir circuit
            // 2. Create witness from private inputs
            // 3. Generate Groth16 proof using barretenberg
            // 4. Serialize proof for on-chain verification

            // Placeholder proof
            let proof = generate_dummy_proof(&secret, &randomness, &merkle_path);

            let mut inputs = Vec::new();
            inputs.push(merkle_root);
            inputs.push(nullifier);

            let mut recipient_padded = [0u8; 32];
            recipient_padded[12..].copy_from_slice(&recipient);
            inputs.push(recipient_padded);

            let mut amount_bytes = [0u8; 32];
            amount_bytes[24..].copy_from_slice(&amount.to_be_bytes());
            inputs.push(amount_bytes);

            ("withdrawal".to_string(), proof, inputs)
        }

        ProofRequest::Transfer {
            merkle_root,
            nullifier,
            new_commitment_a,
            new_commitment_b,
            secret,
            randomness,
            merkle_path,
            merkle_indices,
        } => {
            info!("Generating transfer proof");

            let proof = generate_dummy_proof(&secret, &randomness, &merkle_path);

            let inputs = vec![merkle_root, nullifier, new_commitment_a, new_commitment_b];

            ("transfer".to_string(), proof, inputs)
        }

        ProofRequest::Consistency {
            pedersen_commitment,
            paillier_ciphertext,
            value,
            pedersen_randomness,
            paillier_randomness,
        } => {
            info!("Generating consistency proof");

            let proof = generate_dummy_proof(&pedersen_randomness, &[0u8; 32], &[]);

            let inputs = vec![pedersen_commitment];

            ("consistency".to_string(), proof, inputs)
        }

        ProofRequest::Range {
            commitment,
            min_value,
            value,
            randomness,
        } => {
            info!("Generating range proof");

            let proof = generate_dummy_proof(&randomness, &[0u8; 32], &[]);

            let mut min_bytes = [0u8; 32];
            min_bytes[24..].copy_from_slice(&min_value.to_be_bytes());

            let inputs = vec![commitment, min_bytes];

            ("range".to_string(), proof, inputs)
        }
    };

    let elapsed = start.elapsed();
    debug!(
        proof_type = %proof_type,
        time_ms = elapsed.as_millis(),
        "Proof generated"
    );

    Ok(GeneratedProof {
        proof_type,
        proof_data,
        public_inputs,
        generation_time_ms: elapsed.as_millis() as u64,
    })
}

/// Generate dummy proof for testing
fn generate_dummy_proof(
    _secret: &[u8; 32],
    _randomness: &[u8; 32],
    _merkle_path: &[[u8; 32]],
) -> Vec<u8> {
    // In production, this would be a real Groth16 proof
    // Groth16 proofs are 192 bytes (2 * 32 + 2 * 32 + 2 * 32)
    vec![0u8; 192]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_prover_disabled() {
        let config = ProverConfig {
            enabled: false,
            max_concurrent: 1,
            timeout_secs: 60,
        };

        let prover = ProverService::new(&config).unwrap();

        let request = ProofRequest::Range {
            commitment: [0u8; 32],
            min_value: 100,
            value: 200,
            randomness: [0u8; 32],
        };

        let result = prover.generate(request).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_prover_enabled() {
        let config = ProverConfig {
            enabled: true,
            max_concurrent: 2,
            timeout_secs: 60,
        };

        let prover = ProverService::new(&config).unwrap();
        assert!(prover.is_available());
        assert_eq!(prover.queue_depth(), 0);
    }
}
