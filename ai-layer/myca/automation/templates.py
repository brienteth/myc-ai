"""
Preset Workflow Templates (Phase 3.0)
Defines out-of-the-box automation templates for users.
"""
import uuid
import time
from typing import List

TEMPLATES = [
    {
        "id": "template-daily-backup",
        "name": "Daily File Organizer",
        "description": "Periodically checks specified downloads folder and lists recent indexed documents.",
        "enabled": False,
        "trigger": {
            "type": "interval",
            "interval": 86400  # 24 hours
        },
        "variables": {
            "target_folder": "~/Downloads"
        },
        "nodes": [
            {
                "id": "fetch_history",
                "skill": "library.history",
                "inputs": {},
                "depends_on": []
            },
            {
                "id": "organize_log",
                "skill": "core.chat",
                "inputs": {
                    "prompt": "Create a visual summary list of these files: {{nodes.fetch_history.history}}"
                },
                "depends_on": ["fetch_history"]
            }
        ],
        "edges": [
            {
                "from": "fetch_history",
                "to": "organize_log"
            }
        ],
        "permissions": ["library", "network"]
    },
    {
        "id": "template-clipboard-summary",
        "name": "Clipboard Auto-Summarizer",
        "description": "Fires whenever text is copied to clipboard, summarizing links or technical text automatically.",
        "enabled": False,
        "trigger": {
            "type": "clipboard",
            "regex": "^http.*"
        },
        "variables": {},
        "nodes": [
            {
                "id": "ai_summary",
                "skill": "core.chat",
                "inputs": {
                    "prompt": "Explain briefly what this copied URL is about: {{variables.clipboard}}"
                },
                "depends_on": []
            }
        ],
        "edges": [],
        "permissions": ["network"]
    },
    {
        "id": "template-watch-folder",
        "name": "Folder Watch Indexer",
        "description": "Automatically reads and indexes any document that appears in ~/Downloads into Myca's Library.",
        "enabled": False,
        "trigger": {
            "type": "folder_watch",
            "path": "~/Downloads"
        },
        "variables": {},
        "nodes": [
            {
                "id": "index_file",
                "skill": "library.index",
                "inputs": {
                    "path": "{{variables.file_path}}"
                },
                "depends_on": []
            }
        ],
        "edges": [],
        "permissions": ["library", "fs"]
    }
]

def get_templates() -> List[dict]:
    """Returns copy of templates with unique ids for installation."""
    installed = []
    for t in TEMPLATES:
        t_copy = dict(t)
        t_copy["created_at"] = time.time()
        t_copy["updated_at"] = time.time()
        installed.append(t_copy)
    return installed
