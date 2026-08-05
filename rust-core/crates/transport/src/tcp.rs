use crate::provider::TransportProvider;
use async_trait::async_trait;
use common::Result;

pub struct TcpTransport;

#[async_trait]
impl TransportProvider for TcpTransport {
    fn name(&self) -> &'static str { "tcp" }
    
    async fn connect(&self, _address: &str) -> Result<()> { Ok(()) }
    async fn listen(&self, _address: &str) -> Result<()> { Ok(()) }
    async fn send(&self, _data: &[u8]) -> Result<()> { Ok(()) }
    async fn receive(&self) -> Result<Vec<u8>> { Ok(vec![]) }
}
