use crate::provider::TransportProvider;
use async_trait::async_trait;
use common::Result;

pub struct QuicTransport;

#[async_trait]
impl TransportProvider for QuicTransport {
    fn name(&self) -> &'static str { "quic" }
    
    async fn connect(&self, _address: &str) -> Result<()> { Ok(()) }
    async fn listen(&self, _address: &str) -> Result<()> { Ok(()) }
    async fn send(&self, _data: &[u8]) -> Result<()> { Ok(()) }
    async fn receive(&self) -> Result<Vec<u8>> { Ok(vec![]) }
}
