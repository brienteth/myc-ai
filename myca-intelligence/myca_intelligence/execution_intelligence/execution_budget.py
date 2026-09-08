import logging
import time
from typing import Dict, Any
from myca_intelligence.execution_intelligence.models import ExecutionBudget

logger = logging.getLogger("myca_intelligence.execution_intelligence.execution_budget")

class BudgetExceededError(Exception):
    pass

class BudgetManager:
    """
    Enforces maximum cost, tokens, and time.
    """
    
    def __init__(self, budget: ExecutionBudget):
        self.budget = budget
        
    def check_limits(self):
        """Throws an exception if limits are exceeded."""
        elapsed = time.time() - self.budget.start_time
        
        if elapsed > self.budget.max_runtime_seconds:
            logger.error(f"[BUDGET MANAGER] Runtime exceeded: {elapsed}s > {self.budget.max_runtime_seconds}s")
            raise BudgetExceededError("MAX_RUNTIME_EXCEEDED")
            
        if self.budget.current_cost_usd > self.budget.max_cost_usd:
            logger.error(f"[BUDGET MANAGER] Cost exceeded: ${self.budget.current_cost_usd} > ${self.budget.max_cost_usd}")
            raise BudgetExceededError("MAX_COST_EXCEEDED")
            
        if self.budget.current_tokens > self.budget.max_tokens:
            logger.error(f"[BUDGET MANAGER] Token limit exceeded: {self.budget.current_tokens} > {self.budget.max_tokens}")
            raise BudgetExceededError("MAX_TOKENS_EXCEEDED")
            
    def record_usage(self, tokens: int, cost: float):
        """Updates the current usage."""
        self.budget.current_tokens += tokens
        self.budget.current_cost_usd += cost
        logger.debug(f"[BUDGET MANAGER] Updated usage: {self.budget.current_tokens} tokens, ${self.budget.current_cost_usd:.4f}")
        self.check_limits()
