"""
Automation Scheduler (Phase 3.0)
Coordinates workflow triggers, registers active timers, and runs executors when fired.
"""
import asyncio
import logging
from typing import Dict, List
from .history import AutomationDB
from .executor import WorkflowExecutor
from .trigger import IntervalTriggerWatcher, ClipboardTriggerWatcher, FolderTriggerWatcher

logger = logging.getLogger("myca.automation.scheduler")

class AutomationScheduler:
    def __init__(self, runtime):
        self.runtime = runtime
        self.executor = WorkflowExecutor(runtime)
        self.active_watchers: Dict[str, List] = {}  # workflow_id -> list of watchers
        self.sync_task = None
        self.is_running = False

    def start(self):
        """Start scheduler daemon loops."""
        if self.is_running:
            return
        self.is_running = True
        AutomationDB.init_db()
        self.sync_task = asyncio.create_task(self._sync_loop())
        logger.info("[SCHEDULER] Daemon scheduler started.")

    def stop(self):
        self.is_running = False
        if self.sync_task:
            self.sync_task.cancel()
            self.sync_task = None
        
        # Stop all watchers
        for w_id, watchers in self.active_watchers.items():
            for w in watchers:
                w.stop()
        self.active_watchers.clear()
        logger.info("[SCHEDULER] Daemon scheduler stopped.")

    async def _sync_loop(self):
        """Periodically sync active workflows with database definitions."""
        # Wait for model to finish loading before starting triggers
        await asyncio.sleep(15)
        logger.info("[SCHEDULER] Initial delay complete, beginning workflow sync.")
        while self.is_running:
            try:
                workflows = AutomationDB.get_workflows()
                active_ids = {w["id"] for w in workflows if w.get("enabled", True)}

                # 1. Stop watchers for workflows that were disabled or deleted
                for w_id in list(self.active_watchers.keys()):
                    if w_id not in active_ids:
                        logger.info(f"[SCHEDULER] Stopping triggers for disabled/deleted workflow: {w_id}")
                        for watcher in self.active_watchers[w_id]:
                            watcher.stop()
                        del self.active_watchers[w_id]

                # 2. Start watchers for newly enabled or updated workflows
                for w in workflows:
                    w_id = w["id"]
                    if not w.get("enabled", True):
                        continue

                    # If already running, skip (unless updated - for simplicity, we just check existence here)
                    if w_id in self.active_watchers:
                        continue

                    trigger_cfg = w.get("trigger", {})
                    t_type = trigger_cfg.get("type")
                    if not t_type:
                        continue

                    logger.info(f"[SCHEDULER] Registering trigger {t_type} for workflow: {w['name']}")
                    
                    # Create callback closures
                    async def trigger_fired(event_data, workflow_def=w):
                        logger.info(f"[SCHEDULER] Trigger fired for workflow: {workflow_def['name']}")
                        asyncio.create_task(self.executor.execute(workflow_def, input_variables=event_data))

                    watchers = []
                    if t_type == "interval":
                        watcher = IntervalTriggerWatcher(trigger_cfg, trigger_fired)
                        watcher.start()
                        watchers.append(watcher)
                    elif t_type == "clipboard":
                        watcher = ClipboardTriggerWatcher(trigger_cfg, trigger_fired)
                        watcher.start()
                        watchers.append(watcher)
                    elif t_type == "folder_watch":
                        watcher = FolderTriggerWatcher(trigger_cfg, trigger_fired)
                        watcher.start()
                        watchers.append(watcher)
                    
                    if watchers:
                        self.active_watchers[w_id] = watchers

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[SCHEDULER] Sync loop error: {e}")

            # Sync check every 10 seconds
            await asyncio.sleep(10)
