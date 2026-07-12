"""
Trigger Watchers (Phase 3.0)
Monitors system events, timers, folder modifications, and clipboard copies.
"""
import os
import time
import logging
import asyncio
from pathlib import Path
from typing import Callable, Awaitable

logger = logging.getLogger("myca.automation.trigger")

class TriggerWatcher:
    """Base class for trigger event watchers."""
    def __init__(self, trigger_config: dict, callback: Callable[[dict], Awaitable[None]]):
        self.config = trigger_config
        self.callback = callback
        self.task = None

    def start(self):
        if not self.task:
            self.task = asyncio.create_task(self._loop())

    def stop(self):
        if self.task:
            self.task.cancel()
            self.task = None

    async def _loop(self):
        raise NotImplementedError("Trigger watchers must implement _loop()")

class IntervalTriggerWatcher(TriggerWatcher):
    """Fires every X seconds."""
    async def _loop(self):
        interval = int(self.config.get("interval", 60))
        logger.info(f"[TRIGGER] Interval watch started: every {interval}s")
        while True:
            try:
                await asyncio.sleep(interval)
                logger.info(f"[TRIGGER] Interval trigger fired ({interval}s)")
                await self.callback({"triggered_by": "interval", "timestamp": time.time()})
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[TRIGGER] Error in interval loop: {e}")

class ClipboardTriggerWatcher(TriggerWatcher):
    """Fires when clipboard text matches regex."""
    async def _loop(self):
        import subprocess
        import re
        
        regex = self.config.get("regex", ".*")
        logger.info(f"[TRIGGER] Clipboard watch started with regex '{regex}'")
        last_clip = ""

        # Cross-platform clipboard fetch
        def get_clipboard():
            try:
                if os.name == "posix":  # macOS
                    return subprocess.check_output("pbpaste", env={'LANG': 'en_US.UTF-8'}).decode("utf-8")
                else:
                    # Linux fallback if xclip exists
                    return subprocess.check_output(["xclip", "-selection", "clipboard", "-o"]).decode("utf-8")
            except Exception:
                return ""

        while True:
            try:
                await asyncio.sleep(2)  # Poll clipboard every 2 seconds
                clip = get_clipboard().strip()
                if clip and clip != last_clip:
                    last_clip = clip
                    if re.match(regex, clip):
                        logger.info(f"[TRIGGER] Clipboard content match found: {clip[:30]}...")
                        await self.callback({
                            "triggered_by": "clipboard",
                            "clipboard": clip,
                            "timestamp": time.time()
                        })
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[TRIGGER] Clipboard watcher loop error: {e}")

class FolderTriggerWatcher(TriggerWatcher):
    """Fires when a new file appears inside folder."""
    async def _loop(self):
        folder_path = Path(self.config.get("path", "~/Downloads")).expanduser()
        logger.info(f"[TRIGGER] Watch Folder loop started for: {folder_path}")
        
        if not folder_path.exists():
            folder_path.mkdir(parents=True, exist_ok=True)

        # Initial snapshot
        known_files = set(folder_path.iterdir())

        while True:
            try:
                await asyncio.sleep(5)  # Scan every 5 seconds
                current_files = set(folder_path.iterdir())
                new_files = current_files - known_files
                
                # Filter out hidden or temp files
                new_files = {f for f in new_files if f.is_file() and not f.name.startswith(".")}
                
                if new_files:
                    for f in new_files:
                        logger.info(f"[TRIGGER] New file detected inside folder: {f.name}")
                        await self.callback({
                            "triggered_by": "folder_watch",
                            "file_path": str(f),
                            "filename": f.name,
                            "timestamp": time.time()
                        })
                known_files = current_files
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[TRIGGER] Folder watcher loop error: {e}")
