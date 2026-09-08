"""
Myca OS Intelligence Provider Package (Proprietary)
"""

def get_provider(node=None):
    """Return the proprietary intelligence adapter / assistant."""
    from myca_intelligence.inference.assistant import MycaAssistant
    return MycaAssistant(node) if node else MycaAssistant
