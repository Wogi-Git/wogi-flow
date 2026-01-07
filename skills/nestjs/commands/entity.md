Create a TypeORM entity with proper decorators.

Usage: `/nestjs-entity [EntityName]`

## Steps

1. Read template: `skills/nestjs/templates/entity.template.ts`
2. Ask for entity details:
   - Table name (snake_case)
   - Columns needed (name, type, nullable, default)
   - Relations (ManyToOne, OneToMany, etc.)
3. Generate entity file at `src/[module]/entities/[entity-name].entity.ts`
4. Create/update barrel export `src/[module]/entities/index.ts`

## Output

```typescript
// src/[module]/entities/[entity-name].entity.ts
@Entity('table_name')
export class EntityName {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  // ... generated columns
  
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
  
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
  
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
```

## Rules

- Use @PrimaryGeneratedColumn('uuid')
- Map column names with `{ name: 'snake_case' }`
- Always include timestamp columns
- Do NOT add @Index() unless explicitly requested
- Define relations explicitly with @JoinColumn
