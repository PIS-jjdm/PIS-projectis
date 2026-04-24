# Subject Service (.NET)

gRPC subject service implemented in `.NET` with PostgreSQL storage.

Project layout:

- `SubjectService.slnx`: solution containing both projects
- `Directory.Packages.props`: central NuGet package version management for both projects
- `.config/dotnet-tools.json`: local `dotnet-ef` tool manifest
- `SubjectService.App/`: gRPC application
- `SubjectService.Tests/`: unit tests for the application layer

Responsibilities:

- manage subject metadata
- manage student registrations per subject
- manage teacher assignments per subject
- validate teacher assignment through `auth-service`
- block subject deletion while projects still reference the subject

## Local Commands

From `services/subject-service-dotnet/`:

```bash
dotnet tool restore
dotnet test SubjectService.slnx
```

## EF Core Migrations

Restore the local EF tool first:

```bash
cd services/subject-service-dotnet
dotnet tool restore
```

Add a new migration:

```bash
dotnet ef migrations add <MigrationName> \
  --project SubjectService.App/SubjectService.App.csproj \
  --startup-project SubjectService.App/SubjectService.App.csproj \
  --output-dir Migrations
```

Apply migrations to the configured database:

```bash
ConnectionStrings__SubjectDb="Host=127.0.0.1;Port=5432;Database=subject;Username=subject;Password=subject" \
dotnet ef database update \
  --project SubjectService.App/SubjectService.App.csproj \
  --startup-project SubjectService.App/SubjectService.App.csproj
```

The application also applies pending migrations automatically on startup via `MigrateAsync()`.
