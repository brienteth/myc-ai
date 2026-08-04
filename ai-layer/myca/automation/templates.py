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
    },
    {
        "id": "template-software-factory",
        "name": "Software Factory Autonomous Loop",
        "description": "Finn-loop inspired 3-phase development cycle: Spec → Build → Review. Creates specs, implements changes, and reviews code autonomously.",
        "enabled": False,
        "trigger": {
            "type": "interval",
            "interval": 300  # 5 minutes
        },
        "variables": {
            "repo_path": "~/projects/my-app"
        },
        "nodes": [
            {
                "id": "factory_loop",
                "skill": "factory.loop",
                "inputs": {
                    "repo_path": "{{variables.repo_path}}"
                },
                "depends_on": []
            }
        ],
        "edges": [],
        "permissions": ["fs", "ai.local"]
    },
    {
        "id": "template-web-scraper-vault",
        "name": "Web Scraper & Markdown Vault Ingestion",
        "description": "Scrapes a URL, converts to clean Markdown, and ingests into the knowledge vault automatically.",
        "enabled": False,
        "trigger": {
            "type": "clipboard",
            "regex": "^https?://.*"
        },
        "variables": {},
        "nodes": [
            {
                "id": "scrape_url",
                "skill": "crawler.scrape",
                "inputs": {
                    "url": "{{variables.clipboard}}"
                },
                "depends_on": []
            },
            {
                "id": "ingest_vault",
                "skill": "brain.ingest",
                "inputs": {
                    "scrape_result": "{{nodes.scrape_url.result}}"
                },
                "depends_on": ["scrape_url"]
            }
        ],
        "edges": [
            {"from": "scrape_url", "to": "ingest_vault"}
        ],
        "permissions": ["network", "fs"]
    },
    {
        "id": "template-daily-handover",
        "name": "Daily Session Handover & Memory Builder",
        "description": "Summarizes the day's work, saves decisions and next steps, and indexes all vault notes for auto-linking.",
        "enabled": False,
        "trigger": {
            "type": "interval",
            "interval": 86400  # 24 hours
        },
        "variables": {},
        "nodes": [
            {
                "id": "create_handover",
                "skill": "brain.handover",
                "inputs": {
                    "summary": "End of day summary — auto-generated"
                },
                "depends_on": []
            },
            {
                "id": "index_vault",
                "skill": "brain.index",
                "inputs": {},
                "depends_on": ["create_handover"]
            },
            {
                "id": "auto_link",
                "skill": "brain.autolink",
                "inputs": {},
                "depends_on": ["index_vault"]
            }
        ],
        "edges": [
            {"from": "create_handover", "to": "index_vault"},
            {"from": "index_vault", "to": "auto_link"}
        ],
        "permissions": ["fs", "ai.local"]
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
