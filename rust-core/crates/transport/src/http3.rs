use crate::provider::TransportProvider;
use async_trait::async_trait;
use common::Result;

pub struct Http3Transport;

#[async_trait]
impl TransportProvider for Http3Transport {
    fn name(&self) -> &'static str { "http3" }
    
    async fn connect(&self, _address: &str) -> Result<()> { Ok(()) }
    async fn listen(&self, _address: &str) -> Result<()> { Ok(()) }
    async fn send(&self, _data: &[u8]) -> Result<()> { Ok(()) }
    async fn receive(&self) -> Result<Vec<u8>> { Ok(vec![]) }
}
