# NestJS Successful Patterns

Patterns that have proven to work well in NestJS projects.
These are extracted from successful task completions.

---

## Service Patterns

### Pattern: Thin Service with Simple Returns

**Context**: Data access layer
**Example**:
```typescript
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async save(user: User): Promise<User> {
    return this.userRepository.save(user);
  }
}
```
**Why it works**: Controllers handle exceptions, services just return data or null

---

## Controller Patterns

### Pattern: Business Logic in Controller

**Context**: HTTP endpoint with validation
**Example**:
```typescript
@Post()
async create(@Body() dto: CreateUserDto): Promise<User> {
  const existing = await this.usersService.findByEmail(dto.email);
  if (existing) {
    throw new ConflictException('Email already registered');
  }

  const user = new User();
  Object.assign(user, dto);
  user.passwordHash = await bcrypt.hash(dto.password, 10);

  return this.usersService.save(user);
}
```
**Why it works**: All validation and business rules in one place, service stays thin

---

## Entity Patterns

### Pattern: Soft Delete with Timestamps

**Context**: Entities that need audit trail
**Example**:
```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
```
**Why it works**: Consistent audit trail, TypeORM handles timestamps automatically

---

## Module Patterns

_More patterns will be added as they are discovered._
