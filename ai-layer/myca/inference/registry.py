"""
Inference Backend Registry
Loads the correct engine instance dynamically (e.g., MLX on Mac, Llama.cpp otherwise).
"""
import logging
from .engine import InferenceEngine

logger = logging.getLogger("myca.inference.registry")

class BackendRegistry:
    _backends = {}

    @classmethod
    def register(cls, name: str, backend_cls):
        cls._backends[name] = backend_cls

    @classmethod
    def create_backend(cls, name: str = "auto") -> InferenceEngine:
        """
        Factory to instantiate the correct Inference Engine.
        """
        import os
        backend_env = os.getenv("MYCA_BACKEND", "llamacpp").lower()
        
        # If user explicitly requested mock or if registry defaults
        if name == "mock" or backend_env == "mock":
            backend_cls = cls._backends.get("mock")
            logger.info("Using MockBackend (MYCA_BACKEND=mock)")
            return backend_cls()
            
        # Default: Real inference via LlamaCpp
        if "llamacpp" in cls._backends:
            logger.info("Using LlamaCppBackend (in-process local inference)")
            llamacpp_cls = cls._backends["llamacpp"]
            
            # Extract configuration from environment variables
            model_path = os.getenv("MYCA_MODEL_PATH", None)
            gpu_layers = int(os.getenv("MYCA_GPU_LAYERS", "-1"))
            ctx_size = int(os.getenv("MYCA_CTX", "4096"))
            verbose = os.getenv("MYCA_VERBOSE", "").lower() == "true"
            
            return llamacpp_cls(
                model_path=model_path,
                n_gpu_layers=gpu_layers,
                n_ctx=ctx_size,
                verbose=verbose
            )
            
        # Fallback
        fallback_name = "mock"
        logger.warning(f"Backend '{backend_env}' not available. Falling back to {fallback_name}.")
        return cls._backends[fallback_name]()
