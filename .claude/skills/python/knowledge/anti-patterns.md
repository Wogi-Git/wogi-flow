# Python/FastAPI Anti-Patterns

Patterns to avoid in Python/FastAPI projects.
These cause bugs, performance issues, or maintenance problems.

---

## FastAPI Anti-Patterns

### Anti-Pattern: Sync Operations in Async Endpoints

**Bad**:
```python
@router.get("/users")
async def get_users(db: Session = Depends(get_db)):
    # This blocks the event loop!
    time.sleep(5)
    return db.query(User).all()
```

**Good**:
```python
import asyncio

@router.get("/users")
async def get_users(db: Session = Depends(get_db)):
    await asyncio.sleep(5)  # Non-blocking
    # Or use run_in_executor for sync DB operations
    return await asyncio.get_event_loop().run_in_executor(
        None, lambda: db.query(User).all()
    )
```

**Why it's bad**: Blocks entire event loop, kills async performance

---

### Anti-Pattern: Missing Response Model

**Bad**:
```python
@router.get("/user/{user_id}")
async def get_user(user_id: str, db: Session = Depends(get_db)):
    return db.query(User).filter(User.id == user_id).first()
    # Returns entire User object including password_hash!
```

**Good**:
```python
@router.get("/user/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, db: Session = Depends(get_db)):
    return db.query(User).filter(User.id == user_id).first()
    # Only returns fields defined in UserResponse
```

**Why it's bad**: Leaks sensitive fields, no API documentation

---

## Pydantic Anti-Patterns

### Anti-Pattern: Mutable Default Arguments

**Bad**:
```python
class Config(BaseModel):
    tags: list = []  # Shared between all instances!
```

**Good**:
```python
class Config(BaseModel):
    tags: list = Field(default_factory=list)
```

**Why it's bad**: All instances share the same list object

---

### Anti-Pattern: Too Many Optional Fields

**Bad**:
```python
class UserUpdate(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    age: Optional[int] = None
    # ... 20 more optional fields
```

**Good**:
```python
class UserUpdate(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None

    class Config:
        extra = "forbid"  # Reject unknown fields
```

**Why it's bad**: Hard to validate, allows arbitrary data

---

## SQLAlchemy Anti-Patterns

### Anti-Pattern: N+1 Query Problem

**Bad**:
```python
users = db.query(User).all()
for user in users:
    # Makes a query for each user!
    print(user.posts)
```

**Good**:
```python
from sqlalchemy.orm import joinedload

users = db.query(User).options(joinedload(User.posts)).all()
for user in users:
    print(user.posts)  # Already loaded
```

**Why it's bad**: Causes database performance issues, O(n) queries

---

### Anti-Pattern: Manual Transaction Management

**Bad**:
```python
def create_user(db: Session, user_data: dict):
    try:
        user = User(**user_data)
        db.add(user)
        db.commit()  # Commits inside function
        return user
    except:
        db.rollback()
        raise
```

**Good**:
```python
def create_user(db: Session, user_data: dict):
    user = User(**user_data)
    db.add(user)
    return user
    # Let caller commit via context manager or Depends

# In endpoint
@router.post("/users")
async def create(data: UserCreate, db: Session = Depends(get_db)):
    user = create_user(db, data.dict())
    db.commit()
    return user
```

**Why it's bad**: Hard to compose operations, can't batch writes

---

## General Python Anti-Patterns

### Anti-Pattern: Bare Except

**Bad**:
```python
try:
    do_something()
except:  # Catches everything including KeyboardInterrupt!
    pass
```

**Good**:
```python
try:
    do_something()
except Exception as e:
    logger.error(f"Failed: {e}")
    raise
```

**Why it's bad**: Hides errors, catches system exceptions

---

_More anti-patterns will be added as they are discovered._
