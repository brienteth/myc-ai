use ed25519_dalek::SigningKey;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Identity {
    pub device_id: String,
    #[serde(skip)]
    pub signing_key: Option<SigningKey>,
}

impl Identity {
    pub fn generate_new() -> Self {
        let mut csprng = rand::rng();
        let signing_key = SigningKey::generate(&mut csprng);
        let verifying_key = signing_key.verifying_key();
        
        let device_id = hex::encode(verifying_key.as_bytes());
        
        Identity {
            device_id,
            signing_key: Some(signing_key),
        }
    }
}
