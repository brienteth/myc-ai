use common::PeerId;
use identity::PeerIdentity;
use std::collections::HashMap;

/// In-memory storage for active peers in the mesh
pub struct PeerStore {
    peers: HashMap<PeerId, PeerIdentity>,
}

impl PeerStore {
    pub fn new() -> Self {
        Self {
            peers: HashMap::new(),
        }
    }

    pub fn add(&mut self, peer: PeerIdentity) {
        self.peers.insert(peer.peer_id.clone(), peer);
    }

    pub fn remove(&mut self, peer_id: &PeerId) {
        self.peers.remove(peer_id);
    }
}
