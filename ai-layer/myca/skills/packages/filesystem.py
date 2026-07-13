import os
import logging
from pydantic import BaseModel, Field
from myca.skills.core.decorator import skill
from myca.skills.core.result import SkillResult

logger = logging.getLogger("myca.skills.filesystem")

class FileReadInputs(BaseModel):
    path: str = Field(description="Absolute path of the file to read")

class FileWriteInputs(BaseModel):
    path: str = Field(description="Absolute path where to write the file")
    content: str = Field(description="String content to write to the file")

class FileListInputs(BaseModel):
    path: str = Field(description="Absolute path of the directory to list")

@skill(
    id="fs.read",
    name="Read File",
    description="Reads the text contents of a file from the local filesystem.",
    version="1.0",
    category="Filesystem",
    permissions=["fs.read"],
    inputs_schema=FileReadInputs
)
async def read_file(ctx, path: str) -> SkillResult:
    expanded_path = os.path.expanduser(path)
    logger.info(f"[FILESYSTEM] Reading file: {expanded_path}")
    try:
        if not os.path.exists(expanded_path):
            return SkillResult(success=False, logs=[f"Error: File not found at {expanded_path}"])
        
        with open(expanded_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        return SkillResult(
            success=True,
            outputs={"content": content},
            logs=[f"Successfully read file from {expanded_path} ({len(content)} bytes)"]
        )
    except Exception as e:
        logger.error(f"[FILESYSTEM] Read failed: {e}")
        return SkillResult(success=False, logs=[f"Error reading file: {str(e)}"])


@skill(
    id="fs.write",
    name="Write File",
    description="Writes text content to a file on the local filesystem.",
    version="1.0",
    category="Filesystem",
    permissions=["fs.write"],
    inputs_schema=FileWriteInputs
)
async def write_file(ctx, path: str, content: str) -> SkillResult:
    expanded_path = os.path.expanduser(path)
    logger.info(f"[FILESYSTEM] Writing file: {expanded_path}")
    try:
        # Create directory structure if needed
        dir_name = os.path.dirname(expanded_path)
        if dir_name and not os.path.exists(dir_name):
            os.makedirs(dir_name, exist_ok=True)
            
        with open(expanded_path, 'w', encoding='utf-8') as f:
            f.write(content)
            
        return SkillResult(
            success=True,
            outputs={"success": True},
            logs=[f"Successfully wrote file to {expanded_path} ({len(content)} bytes)"]
        )
    except Exception as e:
        logger.error(f"[FILESYSTEM] Write failed: {e}")
        return SkillResult(success=False, logs=[f"Error writing file: {str(e)}"])


@skill(
    id="fs.list",
    name="List Directory",
    description="Lists files in a given directory path.",
    version="1.0",
    category="Filesystem",
    permissions=["fs.read"],
    inputs_schema=FileListInputs
)
async def list_dir(ctx, path: str) -> SkillResult:
    expanded_path = os.path.expanduser(path)
    logger.info(f"[FILESYSTEM] Listing directory: {expanded_path}")
    try:
        if not os.path.exists(expanded_path):
            return SkillResult(success=False, logs=[f"Error: Directory not found at {expanded_path}"])
            
        files = os.listdir(expanded_path)
        # Filter out hidden files
        visible_files = [f for f in files if not f.startswith('.')]
        
        return SkillResult(
            success=True,
            outputs={"files": visible_files},
            logs=[f"Found {len(visible_files)} visible files in {expanded_path}"]
        )
    except Exception as e:
        logger.error(f"[FILESYSTEM] List failed: {e}")
        return SkillResult(success=False, logs=[f"Error listing directory: {str(e)}"])
