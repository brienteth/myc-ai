mod identity;
mod discovery;
mod flow;

use identity::Identity;
use discovery::Discovery;
use flow::{ResourceBloom, Intent, FlowScheduler};
use log::{info, LevelFilter};
use std::time::Duration;

#[tokio::main]
async fn main() {
    env_logger::builder()
        .filter_level(LevelFilter::Info)
        .init();

    info!("Starting Myca Runtime (Rust)...");

    // 1. Identity
    let my_identity = Identity::generate_new();
    info!("Generated Device Identity: {}", my_identity.device_id);

    // 2. Discovery
    let discovery = Discovery::new();
    discovery.advertise(&my_identity.device_id, 8080);

    // 3. Flow
    let mut my_bloom = ResourceBloom::new(my_identity.device_id.clone());
    my_bloom.models.push("llama3.1:8b".to_string());
    
    let intent = Intent {
        action: "summarize".to_string(),
        required_skills: vec!["llama3.1:8b".to_string()],
    };

    let score = FlowScheduler::score_bloom_for_intent(&my_bloom, &intent);
    info!("Local node routing score for intent 'summarize': {}", score);

    // Keep daemon alive
    loop {
        tokio::time::sleep(Duration::from_secs(10)).await;
        info!("Heartbeat: Runtime is alive.");
    }
}
