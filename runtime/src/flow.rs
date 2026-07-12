use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ResourceBloom {
    pub node_id: String,
    pub battery: f32,
    pub latency: f32,
    pub gpu_available: bool,
    pub models: Vec<String>,
    pub knowledge_topics: Vec<String>,
    pub trust_score: f32,
}

impl ResourceBloom {
    pub fn new(node_id: String) -> Self {
        ResourceBloom {
            node_id,
            battery: 1.0,
            latency: 0.0,
            gpu_available: false,
            models: vec![],
            knowledge_topics: vec![],
            trust_score: 1.0,
        }
    }
}

pub struct Intent {
    pub action: String,
    pub required_skills: Vec<String>,
}

pub struct FlowScheduler;

impl FlowScheduler {
    pub fn score_bloom_for_intent(bloom: &ResourceBloom, intent: &Intent) -> f32 {
        if bloom.battery < 0.2 {
            return -1.0;
        }

        let mut score = bloom.battery * 10.0;
        score -= bloom.latency * 100.0;

        let overlap = intent.required_skills.iter()
            .filter(|&skill| bloom.knowledge_topics.contains(skill) || bloom.models.contains(skill))
            .count() as f32;
            
        score += overlap * 20.0;
        score *= bloom.trust_score;

        score
    }
}
