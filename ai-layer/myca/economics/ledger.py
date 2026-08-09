from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

class EconomicEventType(str, Enum):
    EXECUTION_STARTED = "ExecutionStarted"
    EXECUTION_COMPLETED = "ExecutionCompleted"
    COMPUTE_CONSUMED = "ComputeConsumed"
    DRIVER_INVOKED = "DriverInvoked"
    ARTIFACT_PRODUCED = "ArtifactProduced"
    VERIFICATION_COMPLETED = "VerificationCompleted"
    APPROVAL_REQUIRED = "ApprovalRequired"
    EXECUTION_FAILED = "ExecutionFailed"

class EconomicEvent(BaseModel):
    id: str = Field(default_factory=lambda: f"evt_{uuid.uuid4().hex[:12]}")
    execution_id: str
    customer_id: str = "default_enterprise"
    type: EconomicEventType
    provider: Optional[str] = None
    runtime: Optional[str] = None
    units: float = 0.0
    unit_cost: float = 0.0
    platform_fee: float = 0.0
    compute_cost: float = 0.0
    driver_cost: float = 0.0
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    @property
    def total_cost(self) -> float:
        return self.compute_cost + self.driver_cost + self.platform_fee

class EconomicLedgerDB:
    """Mock database for Economic Ledger to decouple from execution DB."""
    
    _events = []
    
    @classmethod
    def record_event(cls, event: EconomicEvent):
        cls._events.append(event)
        # In a real system, this would insert into SQLite/Postgres
        
    @classmethod
    def get_events_by_execution(cls, execution_id: str):
        return [e for e in cls._events if e.execution_id == execution_id]
        
    @classmethod
    def get_total_spend(cls) -> float:
        return sum(e.total_cost for e in cls._events)
