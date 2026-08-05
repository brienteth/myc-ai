use common::Cid;
use serde::{Deserialize, Serialize};

/// Represents a node in the Merkle DAG
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerkleNode {
    pub links: Vec<Cid>,
    pub data: Vec<u8>,
    pub size: u64,
}

impl MerkleNode {
    pub fn new(data: Vec<u8>, links: Vec<Cid>) -> Self {
        let size = data.len() as u64; // In reality this should include child sizes recursively
        Self { links, data, size }
    }

    pub fn serialize(&self) -> Vec<u8> {
        bincode::serialize(self).unwrap_or_default()
    }

    pub fn deserialize(bytes: &[u8]) -> Option<Self> {
        bincode::deserialize(bytes).ok()
    }
}
