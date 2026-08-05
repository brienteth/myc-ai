use common::DeviceId;
use serde::{Deserialize, Serialize};
use crate::signature::KeyPair;

/// Represents a physical or virtual node running Myca
#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceIdentity {
    pub id: DeviceId,
    /// Ed25519 Public Key representation (base64 or bytes)
    pub public_key: String, 
}

impl DeviceIdentity {
    pub fn new(keypair: &KeyPair) -> Self {
        let pub_key_str = hex::encode(keypair.public_key_bytes());
        let device_id = DeviceId(format!("dev_{}", pub_key_str[..16].to_string()));
        Self {
            id: device_id,
            public_key: pub_key_str,
        }
    }
}
