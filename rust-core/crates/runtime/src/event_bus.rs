use common::SystemEvent;
use tokio::sync::broadcast;

/// Pub-sub event bus for the runtime
pub struct EventBus {
    sender: broadcast::Sender<SystemEvent>,
}

impl EventBus {
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(100);
        Self { sender }
    }
}
