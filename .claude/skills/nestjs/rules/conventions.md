# NestJS Conventions

## Architecture Pattern (CRITICAL)

### Layer Responsibilities

| Layer | Responsibility |
|-------|----------------|
| **Controller** | HTTP handling + Business logic |
| **Service** | Database access ONLY |

### Service = Thin Data Access Layer

Services should ONLY contain database operations:

```typescript
// CORRECT - Service only does DB access
@Injectable()
export class EntityService {
  async findById(id: string): Promise<Entity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByField(field: string): Promise<Entity | null> {
    return this.repository.findOne({ where: { field } });
  }

  async save(entity: Entity): Promise<Entity> {
    return this.repository.save(entity);
  }

  async softRemove(entity: Entity): Promise<void> {
    await this.repository.softRemove(entity);
  }
}
```

### Controller = Business Logic

Controllers handle HTTP + all business logic:

```typescript
// CORRECT - Controller handles business logic
@Controller('api/v1/entities')
export class EntityController {
  async create(dto: CreateDto) {
    // Business logic: check duplicates
    const existing = await this.service.findByField(dto.field);
    if (existing) {
      throw new ConflictException('Already exists');
    }

    // Create and save
    const entity = new Entity();
    Object.assign(entity, dto);
    const saved = await this.service.save(entity);

    return { data: saved };
  }
}
```

### What Goes Where

| Logic Type | Location |
|------------|----------|
| HTTP routing | Controller |
| Request validation | Controller (via DTOs) |
| Duplicate checks | Controller |
| Business rules | Controller |
| Exception throwing | Controller |
| Response formatting | Controller |
| Database queries | Service |
| Repository methods | Service |

## Module Structure

- Each domain has its own module
- Modules are self-contained with entity, dto, service, controller
- Use barrel exports (index.ts) in entities/ and dto/ folders

## Naming Conventions

- **Files**: kebab-case (`catalog-base-dosage.entity.ts`)
- **Classes**: PascalCase (`CatalogBaseDosage`)
- **Properties**: camelCase (`standardDose`)
- **DB Columns**: snake_case (`standard_dose`)

## Controllers

- Use `@Controller('api/v1/resource')` for REST endpoints
- Use proper HTTP method decorators (@Get, @Post, @Put, @Delete, @Patch)
- Use @ParseUUIDPipe for UUID parameters
- Return `{ data: ... }` format
- Handle all business logic and validation
- Throw exceptions for business rule violations

## Services

- Inject repositories via @InjectRepository
- ONLY database operations (find, save, remove)
- NO business logic
- NO exception throwing (return null instead)
- Use query builder for complex queries

## DTOs

- All DTOs must have class-validator decorators
- Use @ApiProperty for Swagger documentation
- Create separate create/update/list DTOs
- Use PartialType for update DTOs

## Entities

- Use @PrimaryGeneratedColumn('uuid')
- Map column names: { name: 'snake_case' }
- Include timestamp columns (createdAt, updatedAt, deletedAt)
- Define relations explicitly
- Do NOT add @Index() unless explicitly requested

## Error Handling

- Use custom exceptions from common/exceptions
- Throw exceptions in CONTROLLERS, not services
- Don't expose internal errors to clients
