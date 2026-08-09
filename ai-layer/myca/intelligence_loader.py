import logging

logger = logging.getLogger("myca.intelligence_loader")

def load_intelligence_provider(node=None):
    """
    Attempt to import the private intelligence provider package.
    If it exists, return the loaded provider instance.
    If not, return None (triggering local fallback mode).
    """
    try:
        import myca_intelligence
        logger.info("Proprietary Myca Intelligence package successfully loaded.")
        return myca_intelligence.get_provider(node)
    except ImportError:
        logger.warning("Myca Intelligence package not found. Running in Open-Source Sovereign fallback mode.")
        return None
