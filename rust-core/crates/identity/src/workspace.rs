use common::WorkspaceId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceIdentity {
    pub id: WorkspaceId,
    pub name: String,
}
