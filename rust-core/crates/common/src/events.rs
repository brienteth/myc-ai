use serde::{Deserialize, Serialize};
use crate::ids::{PeerId, TaskId};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SystemEvent {
    PeerConnected(PeerId),
    PeerDisconnected(PeerId),
    TaskStarted(TaskId),
    TaskCompleted(TaskId),
    TaskFailed(TaskId, String),
    NodeHealthUpdate(PeerId, bool),
}
