use crate::providers::InferenceProvider;
use async_trait::async_trait;
use common::Result;

pub struct OllamaProvider;

#[async_trait]
impl InferenceProvider for OllamaProvider {
    fn name(&self) -> &'static str { "ollama" }
    
    async fn chat(&self, _prompt: &str) -> Result<String> { Ok("".into()) }
    async fn completion(&self, _prompt: &str) -> Result<String> { Ok("".into()) }
    async fn embedding(&self, _text: &str) -> Result<Vec<f32>> { Ok(vec![]) }
}
