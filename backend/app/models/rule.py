from sqlalchemy import Column, String, Boolean, Integer, Float

from app.database.session import Base


class Rule(Base):
    """Configurable correlation rule. Each rule contributes `weight` points
    to a candidate correlation score when its condition is satisfied.
    Disabling a rule removes its contribution entirely (see services/correlation.py).
    """
    __tablename__ = "rules"

    id = Column(String, primary_key=True)  # stable slug, e.g. "same_user"
    name = Column(String, nullable=False)
    description = Column(String, nullable=False)
    category = Column(String, nullable=False, default="correlation")
    enabled = Column(Boolean, nullable=False, default=True)
    weight = Column(Float, nullable=False, default=10.0)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "enabled": self.enabled,
            "weight": self.weight,
        }
