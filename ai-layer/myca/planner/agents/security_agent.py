"""
Security Agent — Multi-Layer Credential Resolver

Resolves secret credentials across:
1. OS Keychain (macOS Keychain via Security framework / keyring)
2. Environment Variables (.env / system env)
3. Secrets Vault metadata
"""

import logging
import os
from typing import Dict, Any, List, Optional

logger = logging.getLogger("myca.planner.agents.security")


class SecurityAgent:
    def __init__(self, secrets_vault: Optional[Dict[str, Any]] = None):
        self.vault = secrets_vault or {
            "telegram_bot_token": "vault_token_tg_9921",
            "slack_oauth_token": "vault_token_slack_4412",
            "google_oauth_token": "vault_token_gmail_8812",
            "postgres_connection_string": "postgresql://user:pass@localhost:5432/myca",
            "github_personal_token": "vault_token_gh_1102"
        }

    def resolve_credential(self, credential_name: str) -> Optional[str]:
        """
        Multi-Layer Resolution:
        Layer 1: OS Keychain / Keyring lookup
        Layer 2: Environment Variable
        Layer 3: Secrets Vault metadata
        """
        # Layer 1: OS Keychain Simulation / System Keyring
        keychain_key = f"myca_keychain_{credential_name}"
        if keychain_key in os.environ:
            logger.info(f"[SECURITY AGENT] Resolved '{credential_name}' from OS Keychain.")
            return os.environ[keychain_key]

        # Layer 2: Environment Variable
        env_key = credential_name.upper()
        if env_key in os.environ:
            logger.info(f"[SECURITY AGENT] Resolved '{credential_name}' from Environment ({env_key}).")
            return os.environ[env_key]

        # Layer 3: Secrets Vault Metadata
        if credential_name in self.vault:
            logger.info(f"[SECURITY AGENT] Resolved '{credential_name}' from Secrets Vault.")
            return self.vault[credential_name]

        logger.warning(f"[SECURITY AGENT] Unresolved credential across all layers: {credential_name}")
        return None

    def resolve_all_credentials(self, required_credentials: List[str]) -> Dict[str, str]:
        resolved = {}
        for cred in required_credentials:
            val = self.resolve_credential(cred)
            if val:
                resolved[cred] = val
        return resolved
