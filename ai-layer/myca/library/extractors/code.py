"""
Code Extractor
Extracts code files, syntax-highlights meta, imports, functions, and class metrics.
"""
import re
import logging
from pathlib import Path
from typing import Dict, Any, List

logger = logging.getLogger("myca.library.extractors.code")

class CodeExtractor:
    # Extension to language map
    LANG_MAP = {
        ".py": "python",
        ".rs": "rust",
        ".go": "go",
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".cpp": "cpp",
        ".h": "cpp",
        ".hpp": "cpp",
        ".c": "c",
        ".cs": "csharp",
        ".java": "java",
        ".swift": "swift",
        ".kt": "kotlin",
        ".sh": "bash",
        ".json": "json",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".toml": "toml",
        ".css": "css",
        ".html": "html"
    }

    @staticmethod
    def extract(file_path: Path) -> Dict[str, Any]:
        """
        Reads code file as text and extracts structural metrics (classes, functions, imports).
        """
        meta = {
            "title": file_path.name,
            "language": "text",
            "line_count": 0,
            "classes": [],
            "functions": [],
            "imports": []
        }

        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
            meta["language"] = CodeExtractor.LANG_MAP.get(file_path.suffix.lower(), "text")
            
            lines = content.splitlines()
            meta["line_count"] = len(lines)

            # Heuristics for classes/functions/imports
            classes = []
            functions = []
            imports = []

            for line in lines:
                line_stripped = line.strip()
                if not line_stripped:
                    continue

                # 1. Imports detection
                if line_stripped.startswith(("import ", "from ", "require(", "using ")):
                    imports.append(line_stripped)

                # 2. Python / Javascript / TS / Rust / C++ definitions
                # Class detection
                class_match = re.match(r'^(?:class|struct)\s+(\w+)', line_stripped)
                if class_match:
                    classes.append(class_match.group(1))

                # Function detection
                fn_match = re.match(r'^(?:def|fn|function|async\s+def|async\s+fn|async\s+function)\s+(\w+)', line_stripped)
                if fn_match:
                    functions.append(fn_match.group(1))
                else:
                    # C / Java / C++ style function definitions: e.g. int my_func(arg) {
                    fn_cpp_match = re.match(r'^\w+\s+(\w+)\s*\(.*\)\s*\{', line_stripped)
                    if fn_cpp_match and fn_cpp_match.group(1) not in ("if", "for", "while", "switch", "catch"):
                        functions.append(fn_cpp_match.group(1))

            meta["classes"] = classes[:20]  # Limit lists to avoid DB inflation
            meta["functions"] = functions[:50]
            meta["imports"] = list(set(imports))[:20]

        except Exception as e:
            logger.error(f"Failed to extract code {file_path.name}: {e}")
            content = f"[Code Extraction Error: {str(e)}]"

        return {
            "content": content,
            "metadata": meta
        }
