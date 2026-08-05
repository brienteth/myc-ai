use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Cid(pub String);

impl Cid {
    pub fn from_bytes(data: &[u8]) -> Self {
        // Simplified CID generation using blake3
        let hash = blake3::hash(data);
        Self(format!("b3-{}", hash.to_hex()))
    }
}

pub fn compute_hash(data: &[u8]) -> String {
    blake3::hash(data).to_hex().to_string()
}
