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
        Auto-detection order: MYCA_BACKEND env -> Ollama -> LlamaCpp -> MLX -> Mock.
        """
        import os
        backend_env = os.getenv("MYCA_BACKEND", name).lower()
        
        if backend_env == "mock":
            logger.info("Using MockBackend (MYCA_BACKEND=mock)")
            return cls._backends["mock"]()

        if backend_env in cls._backends and backend_env != "auto":
            try:
                logger.info(f"Using requested backend: {backend_env}")
                return cls._backends[backend_env]()
            except Exception as e:
                logger.warning(f"Requested backend '{backend_env}' failed: {e}")

        # Auto detection: 0. Check 0G Compute Network key (MYCA_MODEL_PATH=sk-... or ZG_COMPUTE_API_KEY)
        model_path_key = os.getenv("MYCA_MODEL_PATH", "")
        zg_key = os.getenv("ZG_COMPUTE_API_KEY", "")
        if "zgcompute" in cls._backends and (model_path_key.startswith("sk-") or zg_key or "0g" in backend_env):
            logger.info("Auto-detected 0G Compute Network API Key in MYCA_MODEL_PATH. Initializing ZeroGComputeBackend.")
            return cls._backends["zgcompute"]()

        # Auto detection: 1. Try Ollama if running
        if "ollama" in cls._backends:
            try:
                import urllib.request
                req = urllib.request.Request("http://localhost:11434/api/tags")
                with urllib.request.urlopen(req, timeout=1.0) as resp:
                    if resp.status == 200:
                        logger.info("Auto-detected local Ollama instance. Using OllamaBackend.")
                        return cls._backends["ollama"]()
            except Exception:
                pass

        # Auto detection: 2. Try LlamaCpp if installed
        if "llamacpp" in cls._backends:
            try:
                import llama_cpp
                logger.info("Using LlamaCppBackend (in-process local inference)")
                llamacpp_cls = cls._backends["llamacpp"]
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
            except ImportError:
                pass
            except Exception as e:
                logger.warning(f"LlamaCppBackend init failed: {e}")

        # Fallback
        logger.info("Using MockBackend (Fallback)")
        return cls._backends["mock"]()
