# Python/FastAPI Successful Patterns

Patterns that have proven to work well in Python/FastAPI projects.
These are extracted from successful task completions.

---

## FastAPI Endpoint Patterns

### Pattern: Typed Response Models

**Context**: API endpoints
**Example**:
```python
from pydantic import BaseModel
from fastapi import APIRouter

class UserResponse(BaseModel):
    id: str
    email: str
    name: str

    class Config:
        from_attributes = True

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, db: Session = Depends(get_db)) -> UserResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```
**Why it works**: Automatic validation, OpenAPI documentation, clear contract

---

### Pattern: Dependency Injection for Database

**Context**: Database session management
**Example**:
```python
from fastapi import Depends
from sqlalchemy.orm import Session

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/")
async def create_item(
    item: ItemCreate,
    db: Session = Depends(get_db)
):
    db_item = Item(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item
```
**Why it works**: Automatic cleanup, testable, reusable

---

## Pydantic Patterns

### Pattern: Request/Response Models

**Context**: API data validation
**Example**:
```python
from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=1, max_length=100)

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = Field(None, min_length=1, max_length=100)

class UserInDB(UserCreate):
    id: str
    hashed_password: str

    class Config:
        from_attributes = True
```
**Why it works**: Separate models for create/update/response, built-in validation

---

### Pattern: Settings with Environment Variables

**Context**: Configuration
**Example**:
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    secret_key: str
    debug: bool = False

    class Config:
        env_file = ".env"

settings = Settings()
```
**Why it works**: Type-safe configuration, automatic .env loading

---

## SQLAlchemy Patterns

### Pattern: Base Model with Timestamps

**Context**: Database models
**Example**:
```python
from sqlalchemy import Column, DateTime, func
from sqlalchemy.ext.declarative import declared_attr

class TimestampMixin:
    @declared_attr
    def created_at(cls):
        return Column(DateTime, default=func.now(), nullable=False)

    @declared_attr
    def updated_at(cls):
        return Column(DateTime, default=func.now(), onupdate=func.now())

class User(Base, TimestampMixin):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, index=True)
```
**Why it works**: Consistent timestamps, DRY principle

---

## Testing Patterns

### Pattern: Pytest Fixtures for Dependencies

**Context**: API testing
**Example**:
```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)
```
**Why it works**: Isolated tests, clean database per test

---

_More patterns will be added as they are discovered._
