//! P2P Networking for Relayer Nodes
//!
//! Implements a gossip-based network for relayer communication:
//! - Relay request distribution
//! - Block header propagation
//! - Reputation sharing

use anyhow::Result;
use libp2p::{
    gossipsub::{self, IdentTopic, MessageAuthenticity},
    identify,
    kad::{self, store::MemoryStore},
    noise,
    swarm::{NetworkBehaviour, SwarmEvent},
    tcp, yamux, Multiaddr, PeerId, Swarm,
};
use std::time::Duration;
use tokio::sync::mpsc;
use tracing::{debug, info, warn};

use crate::P2PConfig;

/// Events from the P2P network
#[derive(Debug, Clone)]
pub enum P2PEvent {
    /// Relay request received from network
    RelayRequest { request_id: String, data: Vec<u8> },
    /// Peer connected
    PeerConnected { peer_id: String },
    /// Peer disconnected
    PeerDisconnected { peer_id: String },
}

/// Topics for gossip protocol
const TOPIC_RELAY_REQUESTS: &str = "laundry/relay/1.0.0";
const TOPIC_BLOCK_HEADERS: &str = "laundry/headers/1.0.0";
const TOPIC_REPUTATION: &str = "laundry/reputation/1.0.0";

/// Combined network behaviour
#[derive(NetworkBehaviour)]
struct RelayerBehaviour {
    gossipsub: gossipsub::Behaviour,
    kademlia: kad::Behaviour<MemoryStore>,
    identify: identify::Behaviour,
}

/// P2P Network Node
pub struct P2PNode {
    swarm: Swarm<RelayerBehaviour>,
    event_tx: mpsc::Sender<P2PEvent>,
    event_rx: mpsc::Receiver<P2PEvent>,
    topics: Vec<IdentTopic>,
}

impl P2PNode {
    /// Create a new P2P node
    pub async fn new(config: &P2PConfig) -> Result<Self> {
        let (event_tx, event_rx) = mpsc::channel(1000);

        // Generate identity
        let local_key = libp2p::identity::Keypair::generate_ed25519();
        let local_peer_id = PeerId::from(local_key.public());
        info!(peer_id = %local_peer_id, "Local peer ID");

        // Configure gossipsub
        let gossipsub_config = gossipsub::ConfigBuilder::default()
            .heartbeat_interval(Duration::from_secs(10))
            .validation_mode(gossipsub::ValidationMode::Strict)
            .message_id_fn(|msg: &gossipsub::Message| {
                let mut hasher = blake3::Hasher::new();
                hasher.update(&msg.data);
                gossipsub::MessageId::from(hasher.finalize().as_bytes().to_vec())
            })
            .build()
            .map_err(|e| anyhow::anyhow!("Gossipsub config error: {}", e))?;

        let gossipsub = gossipsub::Behaviour::new(
            MessageAuthenticity::Signed(local_key.clone()),
            gossipsub_config,
        )
        .map_err(|e| anyhow::anyhow!("Gossipsub error: {}", e))?;

        // Configure Kademlia
        let kademlia = kad::Behaviour::new(local_peer_id, MemoryStore::new(local_peer_id));

        // Configure Identify
        let identify = identify::Behaviour::new(identify::Config::new(
            "/laundry/1.0.0".to_string(),
            local_key.public(),
        ));

        // Create behaviour
        let behaviour = RelayerBehaviour {
            gossipsub,
            kademlia,
            identify,
        };

        // Build swarm
        let swarm = libp2p::SwarmBuilder::with_existing_identity(local_key)
            .with_tokio()
            .with_tcp(
                tcp::Config::default(),
                noise::Config::new,
                yamux::Config::default,
            )?
            .with_behaviour(|_| behaviour)?
            .with_swarm_config(|cfg| cfg.with_idle_connection_timeout(Duration::from_secs(60)))
            .build();

        // Create topics
        let topics = vec![
            IdentTopic::new(TOPIC_RELAY_REQUESTS),
            IdentTopic::new(TOPIC_BLOCK_HEADERS),
            IdentTopic::new(TOPIC_REPUTATION),
        ];

        let mut node = Self {
            swarm,
            event_tx,
            event_rx,
            topics,
        };

        // Subscribe to topics
        node.subscribe_topics()?;

        // Start listening
        node.start_listening(&config.listen_addr)?;

        // Connect to bootstrap peers
        node.connect_bootstrap(&config.bootstrap_peers).await?;

        Ok(node)
    }

    /// Subscribe to all gossip topics
    fn subscribe_topics(&mut self) -> Result<()> {
        for topic in &self.topics {
            self.swarm
                .behaviour_mut()
                .gossipsub
                .subscribe(topic)
                .map_err(|e| anyhow::anyhow!("Subscribe error: {:?}", e))?;
            info!(topic = %topic, "Subscribed to topic");
        }
        Ok(())
    }

    /// Start listening on an address
    fn start_listening(&mut self, addr: &str) -> Result<()> {
        let listen_addr: Multiaddr = addr.parse()?;
        self.swarm.listen_on(listen_addr)?;
        info!(addr = addr, "Listening");
        Ok(())
    }

    /// Connect to bootstrap peers
    async fn connect_bootstrap(&mut self, peers: &[String]) -> Result<()> {
        for peer in peers {
            if let Ok(addr) = peer.parse::<Multiaddr>() {
                match self.swarm.dial(addr.clone()) {
                    Ok(_) => info!(peer = %addr, "Dialing bootstrap peer"),
                    Err(e) => warn!(peer = %addr, error = %e, "Failed to dial bootstrap peer"),
                }
            }
        }
        Ok(())
    }

    /// Get the next event from the P2P network
    pub async fn next_event(&mut self) -> Option<P2PEvent> {
        // Process swarm events
        while let Some(event) = self.poll_swarm().await {
            self.handle_swarm_event(event).await;
        }
        self.event_rx.recv().await
    }

    /// Poll the swarm for events
    async fn poll_swarm(&mut self) -> Option<SwarmEvent<RelayerBehaviourEvent>> {
        tokio::select! {
            event = self.swarm.select_next_some() => Some(event),
            _ = tokio::time::sleep(Duration::from_millis(100)) => None,
        }
    }

    /// Handle swarm events
    async fn handle_swarm_event(&mut self, event: SwarmEvent<RelayerBehaviourEvent>) {
        match event {
            SwarmEvent::Behaviour(RelayerBehaviourEvent::Gossipsub(
                gossipsub::Event::Message { message, .. },
            )) => {
                let topic = message.topic.to_string();
                debug!(topic = %topic, "Received gossip message");

                if topic.contains("relay") {
                    let _ = self
                        .event_tx
                        .send(P2PEvent::RelayRequest {
                            request_id: hex::encode(&message.data[..32.min(message.data.len())]),
                            data: message.data,
                        })
                        .await;
                }
            }
            SwarmEvent::ConnectionEstablished { peer_id, .. } => {
                info!(peer_id = %peer_id, "Connection established");
                let _ = self
                    .event_tx
                    .send(P2PEvent::PeerConnected {
                        peer_id: peer_id.to_string(),
                    })
                    .await;
            }
            SwarmEvent::ConnectionClosed { peer_id, .. } => {
                info!(peer_id = %peer_id, "Connection closed");
                let _ = self
                    .event_tx
                    .send(P2PEvent::PeerDisconnected {
                        peer_id: peer_id.to_string(),
                    })
                    .await;
            }
            _ => {}
        }
    }

    /// Publish a relay request to the network
    pub fn publish_relay_request(&mut self, data: Vec<u8>) -> Result<()> {
        let topic = IdentTopic::new(TOPIC_RELAY_REQUESTS);
        self.swarm
            .behaviour_mut()
            .gossipsub
            .publish(topic, data)
            .map_err(|e| anyhow::anyhow!("Publish error: {:?}", e))?;
        Ok(())
    }

    /// Publish block headers
    pub fn publish_headers(&mut self, data: Vec<u8>) -> Result<()> {
        let topic = IdentTopic::new(TOPIC_BLOCK_HEADERS);
        self.swarm
            .behaviour_mut()
            .gossipsub
            .publish(topic, data)
            .map_err(|e| anyhow::anyhow!("Publish error: {:?}", e))?;
        Ok(())
    }

    /// Get connected peer count
    pub fn peer_count(&self) -> usize {
        self.swarm.connected_peers().count()
    }

    /// Shutdown the P2P node
    pub async fn shutdown(&mut self) -> Result<()> {
        info!("Shutting down P2P node");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_topics() {
        assert!(TOPIC_RELAY_REQUESTS.contains("relay"));
        assert!(TOPIC_BLOCK_HEADERS.contains("headers"));
    }
}
