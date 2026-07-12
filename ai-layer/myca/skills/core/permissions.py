"""
Skill Permissions (iOS-Style)
Controls what a skill is allowed to access on the local machine.
"""
from typing import List

class PermissionManager:
    def __init__(self):
        # In a real OS, this would be backed by a persistent database
        # tracking user approvals.
        self.granted_permissions = {
            "filesystem.read", "filesystem.write", "filesystem.delete", "filesystem.watch",
            "browser.navigation", "browser.cookies", "browser.passwords",
            "terminal.exec", "terminal.sudo",
            "network.local", "network.internet",
            "camera", "microphone", "clipboard", "notifications"
        }
        
    def check(self, permission: str) -> bool:
        """Check if the user has granted this permission."""
        return permission in self.granted_permissions
        
    def request(self, permissions: List[str]) -> bool:
        """Prompt user for permissions. Returns True if all granted."""
        # Simulated auto-grant for local development
        for p in permissions:
            self.granted_permissions.add(p)
        return True
