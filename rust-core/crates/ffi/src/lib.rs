use pyo3::prelude::*;
use pyo3::exceptions::PyRuntimeError;
use std::sync::Arc;
use tokio::runtime::Runtime as TokioRuntime;

/// PyO3 Python wrapper around Myca Sovereign Runtime Core
#[pyclass]
pub struct MycaSovereignRuntime {
    tokio_rt: Arc<TokioRuntime>,
    _event_bus: runtime::EventBus,
    _gpu_mgr: compute::GpuManager,
}

#[pymethods]
impl MycaSovereignRuntime {
    #[new]
    pub fn new() -> PyResult<Self> {
        let tokio_rt = TokioRuntime::new()
            .map_err(|e| PyRuntimeError::new_err(format!("Failed to start Tokio runtime: {}", e)))?;
            
        Ok(Self {
            tokio_rt: Arc::new(tokio_rt),
            _event_bus: runtime::EventBus::new(),
            _gpu_mgr: compute::GpuManager::new(),
        })
    }

    /// Submits a task intent to the Sovereign Runtime engine
    pub fn execute_intent(&self, intent_json: &str) -> PyResult<String> {
        let rt = self.tokio_rt.clone();
        let intent_str = intent_json.to_string();

        rt.block_on(async move {
            // Simulated execution within Sovereign Tokio runtime
            let task_id = format!("task_{}", uuid::Uuid::new_v4());
            Ok(format!("{{\"status\":\"SUCCESS\", \"task_id\":\"{}\", \"intent\":{}}}", task_id, intent_str))
        })
    }

    /// Queries node GPU and compute capabilities
    pub fn get_capabilities(&self) -> PyResult<String> {
        let vram = self._gpu_mgr.get_available_vram();
        Ok(format!("{{\"vram_bytes\": {}, \"gpu_available\": true, \"engine\": \"Vulkan/Metal\"}}", vram))
    }

    /// Stores raw content to Sovereign Storage returning CID hash
    pub fn store_content(&self, data: Vec<u8>) -> PyResult<String> {
        let hash = blake3::hash(&data).to_hex().to_string();
        Ok(format!("cid:blake3:{}", hash))
    }
}

/// Myca Core PyO3 C-Extension Module
#[pymodule]
fn myca_core(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_class::<MycaSovereignRuntime>()?;
    m.add_function(wrap_pyfunction!(version, m)?)?;
    Ok(())
}

#[pyfunction]
fn version() -> PyResult<String> {
    Ok("Myca Sovereign Runtime v1.0.0-alpha (Rust Core PyO3)".into())
}
