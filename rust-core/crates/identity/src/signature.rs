use ed25519_dalek::{SigningKey, VerifyingKey, Signer, Verifier, Signature};
use rand_core::OsRng;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CryptoError {
    #[error("Signature verification failed")]
    InvalidSignature,
}

pub struct KeyPair {
    signing_key: SigningKey,
    verifying_key: VerifyingKey,
}

impl KeyPair {
    pub fn generate() -> Self {
        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        let verifying_key = signing_key.verifying_key();
        Self {
            signing_key,
            verifying_key,
        }
    }

    pub fn public_key_bytes(&self) -> [u8; 32] {
        self.verifying_key.to_bytes()
    }

    pub fn sign(&self, message: &[u8]) -> Vec<u8> {
        let signature: Signature = self.signing_key.sign(message);
        signature.to_bytes().to_vec()
    }

    pub fn verify(public_key: &[u8], message: &[u8], signature_bytes: &[u8]) -> Result<(), CryptoError> {
        let Ok(vk) = VerifyingKey::try_from(public_key) else {
            return Err(CryptoError::InvalidSignature);
        };
        let Ok(sig) = Signature::try_from(signature_bytes) else {
            return Err(CryptoError::InvalidSignature);
        };
        vk.verify(message, &sig).map_err(|_| CryptoError::InvalidSignature)
    }
}
