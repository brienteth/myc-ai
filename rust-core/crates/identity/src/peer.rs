use common::PeerId;
use serde::{Deserialize, Serialize};

/// Represents a peer on the mesh network
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerIdentity {
    pub peer_id: PeerId,
    pub is_trusted: bool,
}

impl PeerIdentity {
    pub fn new(peer_id: String) -> Self {
        Self {
            peer_id: PeerId(peer_id),
            is_trusted: false, // Default to untrusted until handshaked
        }
    }
}
