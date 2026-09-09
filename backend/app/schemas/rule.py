from pydantic import BaseModel
from typing import Optional


class RuleOut(BaseModel):
    id: str
    name: str
    description: str
    category: str
    enabled: bool
    weight: float


class RuleUpdate(BaseModel):
    enabled: Optional[bool] = None
    weight: Optional[float] = None
