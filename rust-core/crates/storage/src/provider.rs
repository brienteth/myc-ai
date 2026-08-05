use async_trait::async_trait;
use common::{Cid, Result};
use std::path::PathBuf;

/// The core Storage Provider trait
/// All storage backends (Filesystem, SQLite, IPFS, 0G, S3) must implement this.
#[async_trait]
pub trait StorageProvider: Send + Sync {
    /// Name of the provider for debugging/logging (e.g. "sqlite", "ipfs")
    fn name(&self) -> &'static str;

    /// Put data and return its content identifier (CID)
    async fn put(&self, data: Vec<u8>) -> Result<Cid>;

    /// Retrieve data by its CID
    async fn get(&self, cid: &Cid) -> Result<Vec<u8>>;

    /// Delete data associated with the CID
    async fn delete(&self, cid: &Cid) -> Result<()>;

    /// Check if the CID exists in this storage provider
    async fn exists(&self, cid: &Cid) -> Result<bool>;

    /// Pin the CID to prevent garbage collection
    async fn pin(&self, cid: &Cid) -> Result<()>;

    /// Unpin the CID
    async fn unpin(&self, cid: &Cid) -> Result<()>;

    /// List all pinned CIDs
    async fn list_pinned(&self) -> Result<Vec<Cid>>;

    /// Fetch from remote peers/network if applicable
    async fn fetch(&self, cid: &Cid, timeout_secs: u64) -> Result<Vec<u8>>;
}
