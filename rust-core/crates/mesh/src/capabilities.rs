use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct NodeCapabilities {
    pub has_gpu: bool,
    pub available_memory: u64,
    pub supported_models: Vec<String>,
}
