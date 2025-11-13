from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    create_engine,
)
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker
from sqlalchemy.sql.expression import func
from fastapi.middleware.cors import CORSMiddleware


# SQLAlchemy setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./norm.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class StatusEnum(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"


class NodeTypeEnum(str, Enum):
    SUB_CHECK = "SUB_CHECK"
    CHECK = "CHECK"
    ROOT = "ROOT"


class Node(Base):
    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    type = Column(String, index=True)
    name = Column(String)
    status = Column(String, nullable=True)
    reason = Column(String, nullable=True)
    parent_id = Column(Integer, ForeignKey("nodes.id"), nullable=True)
    children = relationship(
        "Node", back_populates="parent", cascade="all, delete-orphan"
    )
    parent = relationship("Node", back_populates="children", remote_side=[id])

    __table_args__ = (
        CheckConstraint(status.in_([status.value for status in StatusEnum])),
        CheckConstraint(type.in_([type.value for type in NodeTypeEnum])),
    )


# Create the database tables
Base.metadata.create_all(bind=engine)


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class NodeResponse(BaseModel):
    id: int = Field(..., description="The id of the node")
    type: NodeTypeEnum = Field(..., description="The type of the node")
    name: str = Field(..., description="The name of the node")
    status: Optional[StatusEnum] = Field(None, description="The status of the node")
    reason: Optional[str] = Field(None, description="The reason of the node")
    children: list[NodeResponse] = Field(
        default_factory=list, description="The children of the node"
    )

    class Config:
        extra = "forbid"

    @classmethod
    def from_orm(cls, node: Node) -> NodeResponse:
        return cls(
            id=node.id,
            type=node.type,
            name=node.name,
            status=node.status,
            reason=node.reason,
            children=[cls.from_orm(child) for child in node.children],
        )

# This is needed due to recursive self-referencing model defined in children/parent relationships
NodeResponse.model_rebuild()

class NodePatchRequest(BaseModel):
    status: StatusEnum = Field(..., description="New status for the node")
    reason: Optional[str] = Field(None, description="Optional reason for the status update")

    class Config:
        extra = "forbid"


def format_tree(node: Node, depth: int = 0) -> str:
    """Return a formatted string representing the node hierarchy."""
    indent = "  " * depth
    line = f"{indent}- {node.name} (id={node.id}, type={node.type}, status={node.status}, reason={node.reason})\n"
    for child in node.children:
        line += format_tree(child, depth + 1)
    return line

@app.get(
    "/debug/trees",
    response_class=PlainTextResponse,
    summary="Print all root nodes and their hierarchies",
    description="Lists all ROOT nodes and their child trees in plain text.",
)
def debug_trees(db: Session = Depends(get_db)) -> str:
    """Return all trees (starting from ROOT nodes) in a readable text format."""
    roots = db.query(Node).filter(Node.type == NodeTypeEnum.ROOT).all()
    if not roots:
        return "No ROOT nodes found in database.\n"

    output = ""
    for i, root in enumerate(roots, start=1):
        output += f"🌳 Tree {i}: {root.name} (id={root.id})\n"
        output += format_tree(root)
        output += "\n"
    return output

@app.get(
    "/",
    response_model=NodeResponse,
    summary="Norm Ai Interview Endpoint",
    description="Get a random root node and its children.",
    operation_id="getRandomNode",
)
def get_random_tree(db: Session = Depends(get_db)) -> NodeResponse:
    root_node = (
        db.query(Node)
        .filter(Node.type == NodeTypeEnum.ROOT)
        .order_by(func.random())
        .first()
    )

    if not root_node:
        raise HTTPException(
            status_code=404,
            detail="No root node found - perhaps the database isn't seeded?",
        )

    return NodeResponse.from_orm(root_node)

@app.patch(
    "/nodes/{node_id}",
    response_model=NodeResponse,
    summary="Replace a node's status and optionally its reason",
    description="Update the node status (required) and reason (optional), then propagate status upwards.",
)
def patch_node(
    node_id: int,
    payload: NodePatchRequest,
    db: Session = Depends(get_db),
) -> NodeResponse:
    # STATUS should really be a enum of set [None, PASS, FAIL]. Enforce that here. 
    if payload.status not in ["PASS", "FAIL"]:
        raise HTTPException(status_code=404, detail=f"Payload status must be PASS | FAIL")

    # 1. Find the node  
    node = db.query(Node).filter(Node.id == node_id).first()
    if node.type == "ROOT":
        raise HTTPException(status_code=404, detail=f"Cannot modify root nodes")
    if not node:
        raise HTTPException(status_code=404, detail=f"Node with id={node_id} not found")

    # 2. Update the node & flag whether we need to check parent
    status_changed = True if node.status != payload.status else False
    node.status = payload.status
    node.reason = payload.reason if payload.reason is not None else None
    db.add(node)
    db.flush()  # flush to make the new status visible in ORM relationships

    # 3. Upward propagation loop
    while status_changed:
        parent = node.parent
        # ROOT nodes have no statuses
        if parent.type == "ROOT":
            break
        # Gather all sibling statuses
        sibling_statuses = [c.status for c in parent.children]

        # If all children share the same PASS status, parent should also PASS.
        if sibling_statuses[0] == "PASS" and all(x == sibling_statuses[0] for x in sibling_statuses):
            if parent.status != "PASS":
                parent.status = "PASS"
                db.add(parent)
            else:
                status_changed = False
        else:
            if parent.status == "PASS":
                parent.status = "FAIL"
                db.add(parent)
            else:
                status_changed = False
    db.commit()
    db.refresh(node)

    return NodeResponse.from_orm(node)


# The port number here is only used if running via `python app.py`; running via uvicorn
#  app:app --reload defaults to 8000. Reverting to 8000 to consolidate path variables. 
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

    