# Subject Service (.NET)

gRPC subject service implemented in `.NET` with PostgreSQL storage.

Project layout:

- `SubjectService.slnx`: solution containing both projects
- `Directory.Packages.props`: central NuGet package version management for both projects
- `SubjectService.App/`: gRPC application
- `SubjectService.Tests/`: unit tests for the application layer

Responsibilities:

- manage subject metadata
- manage student registrations per subject
- manage teacher assignments per subject
- validate teacher assignment through `auth-service`
- block subject deletion while projects still reference the subject
