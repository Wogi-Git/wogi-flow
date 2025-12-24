Run database migrations.

Usage: `/nestjs-db migrate`

## Actions

1. Check if Docker/database is running
2. Run pending migrations: `npm run migration:run`
3. Show migration status

## Commands Available

```bash
# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Show migration status
npm run migration:show

# Generate new migration from entity changes
npm run migration:generate -- -n MigrationName
```

## Output

```
🗄️ Running Migrations

Checking database connection... ✓
Running pending migrations...

  ✓ 1704067200000-CreateUsersTable
  ✓ 1704067300000-AddEmailIndex

Migrations complete. 2 migrations applied.
```

## Troubleshooting

If migration fails:
1. Check database is running: `docker compose ps`
2. Check connection: verify .env DATABASE_* variables
3. Check TypeORM config in `src/config/`
