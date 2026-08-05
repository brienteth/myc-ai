use async_trait::async_trait;
use common::Result;

/// Generic Transport Provider for establishing connections
#[async_trait]
pub trait TransportProvider: Send + Sync {
    fn name(&self) -> &'static str;
    
    async fn connect(&self, address: &str) -> Result<()>;
    async fn listen(&self, address: &str) -> Result<()>;
    async fn send(&self, data: &[u8]) -> Result<()>;
    async fn receive(&self) -> Result<Vec<u8>>;
}
