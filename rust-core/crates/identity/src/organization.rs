use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct OrganizationIdentity {
    pub id: String,
    pub name: String,
}
