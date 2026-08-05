use crate::providers::InferenceProvider;
use std::collections::HashMap;

/// Routes inference requests to the appropriate provider (e.g. ollama, openai, mlx)
pub struct InferenceRouter {
    providers: HashMap<String, Box<dyn InferenceProvider>>,
}

impl InferenceRouter {
    pub fn new() -> Self {
        Self { providers: HashMap::new() }
    }
}
