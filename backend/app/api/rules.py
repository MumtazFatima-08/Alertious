from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.rule import Rule
from app.schemas.rule import RuleUpdate

router = APIRouter(prefix="/api/rules", tags=["rules"])


@router.get("")
def list_rules(db: Session = Depends(get_db)):
    rules = db.query(Rule).all()
    return [r.to_dict() for r in rules]


@router.patch("/{rule_id}")
def update_rule(rule_id: str, payload: RuleUpdate, db: Session = Depends(get_db)):
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Rule not found")
    if payload.enabled is not None:
        rule.enabled = payload.enabled
    if payload.weight is not None:
        if payload.weight < 0 or payload.weight > 100:
            raise HTTPException(422, "weight must be between 0 and 100")
        rule.weight = payload.weight
    db.commit()
    db.refresh(rule)
    return rule.to_dict()
