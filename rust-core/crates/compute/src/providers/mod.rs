use async_trait::async_trait;
use common::Result;

pub mod ollama;
pub mod mlx;
pub mod llamacpp;
pub mod vllm;
pub mod openai;

#[async_trait]
pub trait InferenceProvider: Send + Sync {
    fn name(&self) -> &'static str;
    
    async fn chat(&self, prompt: &str) -> Result<String>;
    async fn completion(&self, prompt: &str) -> Result<String>;
    async fn embedding(&self, text: &str) -> Result<Vec<f32>>;
}
