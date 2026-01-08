# NestJS Anti-Patterns

Things that DON'T work in NestJS projects. Learn from past mistakes.
This file is automatically updated when errors occur.

---

## Service Anti-Patterns

### Anti-Pattern: Business Logic in Service

**What happened**: Put validation and exception throwing in services
**Why it's wrong**: Makes services hard to reuse, controller can't customize errors
**What to do instead**: Keep services thin, move logic to controllers

```typescript
// BAD - Don't do this
@Injectable()
export class UsersService {
  async createUser(dto: CreateUserDto): Promise<User> {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email taken'); // NO!
    }
    // ...
  }
}

// GOOD - Do this instead
@Injectable()
export class UsersService {
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async save(user: User): Promise<User> {
    return this.userRepository.save(user);
  }
}

// Controller handles the logic
@Controller('users')
export class UsersController {
  @Post()
  async create(@Body() dto: CreateUserDto): Promise<User> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email taken'); // OK here
    }
    // ...
  }
}
```

---

## Entity Anti-Patterns

### Anti-Pattern: Missing Index on Foreign Keys

**What happened**: Slow queries on large tables
**Why it's wrong**: TypeORM doesn't auto-create indexes on ManyToOne relations
**What to do instead**: Always add @Index() on foreign key columns

```typescript
// BAD
@ManyToOne(() => Organization)
organization: Organization;

// GOOD
@Index()
@ManyToOne(() => Organization)
organization: Organization;
```

---

## Controller Anti-Patterns

### Anti-Pattern: Missing Validation Pipe

**What happened**: DTO validation not running
**Why it's wrong**: @Body() doesn't auto-validate without pipe
**What to do instead**: Enable ValidationPipe globally or per-route

```typescript
// In main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  transform: true,
}));
```

---

## More Anti-Patterns

_Additional anti-patterns will be added as they are discovered._
