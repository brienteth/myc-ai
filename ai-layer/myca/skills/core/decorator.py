"""
The @skill decorator implementation updated for Skill ABI v2.
Transforms Python functions/classes into typed, schema-validated OS Skills.
"""
import inspect
from typing import Callable, List, Type, Union, Any
from pydantic import BaseModel, create_model
from .abi import SkillManifest

class SkillDefinition:
    def __init__(
        self,
        manifest: SkillManifest,
        func: Callable,
        inputs_schema: Type[BaseModel],
        outputs_schema: Type[BaseModel]
    ):
        self.manifest = manifest
        self.func = func
        self.inputs_schema = inputs_schema
        self.outputs_schema = outputs_schema

def _create_pydantic_model_from_fields(model_name: str, fields: List[str]) -> Type[BaseModel]:
    """Helper to dynamically generate Pydantic model from a list of field names."""
    field_definitions = {field: (Any, None) for field in fields}
    return create_model(model_name, **field_definitions)

def skill(
    id: str,
    version: str = "1.0.0",
    name: str = "",
    description: str = "",
    category: str = "general",
    permissions: List[str] = None,
    inputs: Union[List[str], Type[BaseModel]] = None,
    outputs: Union[List[str], Type[BaseModel]] = None,
    inputs_schema: Type[BaseModel] = None,
    streaming: bool = False,
    timeout: int = 30,
    retry: int = 0
):
    """
    The Myca OS Skill decorator.
    Supports both traditional parameter lists and robust typed Pydantic schemas.
    """
    def decorator(func: Callable):
        # Resolve Input Schema
        resolved_inputs_schema = inputs_schema  # prefer explicit inputs_schema kwarg
        if resolved_inputs_schema is None:
            if inputs is None:
                # Inspect function parameters to dynamically build schema
                sig = inspect.signature(func)
                field_definitions = {}
                for name_p, param in sig.parameters.items():
                    if name_p == "ctx": continue
                    p_type = param.annotation if param.annotation is not inspect.Parameter.empty else Any
                    default = param.default if param.default is not inspect.Parameter.empty else ...
                    field_definitions[name_p] = (p_type, default)
                resolved_inputs_schema = create_model(f"{id}_Inputs", **field_definitions)
            elif isinstance(inputs, list):
                resolved_inputs_schema = _create_pydantic_model_from_fields(f"{id}_Inputs", inputs)
            else:
                resolved_inputs_schema = inputs

        # Resolve Output Schema
        if outputs is None or isinstance(outputs, list):
            outputs_schema = _create_pydantic_model_from_fields(f"{id}_Outputs", outputs or ["result"])
        else:
            outputs_schema = outputs

        # Determine traits
        traits = []
        if streaming or inspect.isasyncgenfunction(func):
            traits.append("streaming")
            
        manifest = SkillManifest(
            id=id,
            version=version,
            description=description,
            category=category,
            permissions=permissions or [],
            traits=traits,
            timeout=timeout,
            retry=retry
        )
        
        definition = SkillDefinition(
            manifest=manifest,
            func=func,
            inputs_schema=resolved_inputs_schema,
            outputs_schema=outputs_schema
        )
        
        # Auto-register
        from .registry import SkillRegistry
        SkillRegistry.register(definition)
        
        return func
    return decorator
