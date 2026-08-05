/// Fixed-size or content-defined chunking logic.
pub struct Chunker {
    pub min_size: usize,
    pub max_size: usize,
}

impl Chunker {
    pub fn new(min_size: usize, max_size: usize) -> Self {
        Self { min_size, max_size }
    }

    /// Basic fixed size chunking implementation for now.
    pub fn chunk(&self, data: &[u8]) -> Vec<Vec<u8>> {
        data.chunks(self.max_size).map(|c| c.to_vec()).collect()
    }
}
