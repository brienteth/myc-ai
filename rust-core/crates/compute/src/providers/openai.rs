use crate::providers::InferenceProvider;
use async_trait::async_trait;
use common::Result;

pub struct OpenAiProvider;

#[async_trait]
impl InferenceProvider for OpenAiProvider {
    fn name(&self) -> &'static str { "openai" }
    
    async fn chat(&self, _prompt: &str) -> Result<String> { Ok("".into()) }
    async fn completion(&self, _prompt: &str) -> Result<String> { Ok("".into()) }
    async fn embedding(&self, _text: &str) -> Result<Vec<f32>> { Ok(vec![]) }
}
