Create a complete NestJS module with all files.

Usage: `/nestjs-scaffold [module-name]`

## Module Structure to Create

```
src/[module-name]/
├── dto/
│   ├── create-[module].dto.ts
│   ├── update-[module].dto.ts
│   └── index.ts
├── entities/
│   ├── [module].entity.ts
│   └── index.ts
├── [module].controller.ts
├── [module].service.ts
└── [module].module.ts
```

## Steps

1. **Read skill rules**: `skills/nestjs/rules/conventions.md`
2. **Read templates**: `skills/nestjs/templates/`
3. **Create entity** with TypeORM decorators
4. **Create DTOs** with class-validator
5. **Create service** with CRUD operations (data access only)
6. **Create controller** with Swagger docs (business logic here)
7. **Create module** and register
8. **Create barrel exports** (index.ts files)
9. **Register in AppModule**

## Output Format

For each file created:
```
✓ Created: src/[module]/entities/[module].entity.ts
✓ Created: src/[module]/dto/create-[module].dto.ts
...
```

Then show:
- Summary of files created
- Next steps (run migrations if needed)
- Any manual steps required

## Follow

- Rules from `skills/nestjs/rules/`
- Templates from `skills/nestjs/templates/`
- Existing module patterns in project
