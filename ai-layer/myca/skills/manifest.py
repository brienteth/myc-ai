"""
Myca Skill Manifest Model

Self-describing contract for every skill capability registered in Myca Execution OS.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class InputParam(BaseModel):
    name: str
    type: str = "string"  # string, password, number, boolean, select, textarea
    description: str = ""
    required: bool = True
    default: Optional[Any] = None
    options: Optional[List[str]] = None


class SkillManifest(BaseModel):
    skill: str  # Unique skill identifier, e.g., "telegram.send"
    version: str = "1.0"
    name: str = ""
    description: str = ""
    category: str = "General"
    
    required_credentials: List[str] = Field(default_factory=list)
    required_inputs: List[InputParam] = Field(default_factory=list)
    optional_inputs: List[InputParam] = Field(default_factory=list)
    outputs: List[str] = Field(default_factory=list)
    
    permissions: List[str] = Field(default_factory=list)
    runtime: str = "network"  # network, local, gpu, 0g
    examples: List[Dict[str, Any]] = Field(default_factory=list)

    def get_missing_credentials(self, available_secrets: Dict[str, Any]) -> List[str]:
        """Detects required credentials that are not bound in Secrets Vault."""
        return [cred for cred in self.required_credentials if cred not in available_secrets or not available_secrets[cred]]

    def get_missing_inputs(self, provided_inputs: Dict[str, Any]) -> List[str]:
        """Detects required input parameters missing from user input or prior node outputs."""
        missing = []
        for param in self.required_inputs:
            if param.name not in provided_inputs or provided_inputs[param.name] is None:
                missing.append(param.name)
        return missing
