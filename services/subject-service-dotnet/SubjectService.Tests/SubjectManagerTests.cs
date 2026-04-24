using Grpc.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using SubjectServiceDotnet.Application;
using SubjectServiceDotnet.Data;
using SubjectServiceDotnet.Data.Entities;
using Xunit;
using AuthProto = Auth;
using CommonProto = Common;
using ProjectProto = Project;
using SubjectProto = Subject;

namespace SubjectServiceDotnet.Tests;

public sealed class SubjectManagerTests
{
    [Fact]
    public async Task CreateSubjectAsync_NormalizesAndPersistsSubject()
    {
        await using var db = CreateDbContext();
        var manager = CreateSubjectManager(db);

        var subject = await manager.CreateSubjectAsync(
            new SubjectProto.CreateSubjectRequest
            {
                Name = "  Service Design  ",
                Description = "  Covers contracts and boundaries.  ",
                Abbreviation = "  sdn  ",
            },
            CancellationToken.None);

        Assert.StartsWith("subject-", subject.Id);
        Assert.Equal("Service Design", subject.Name);
        Assert.Equal("Covers contracts and boundaries.", subject.Description);
        Assert.Equal("SDN", subject.Abbreviation);

        var persisted = await db.Subjects.SingleAsync();
        Assert.Equal(subject.Id, persisted.Id);
        Assert.Equal("SDN", persisted.Abbreviation);
    }

    [Fact]
    public async Task CreateSubjectAsync_RejectsDuplicateAbbreviation()
    {
        await using var db = CreateDbContext();
        db.Subjects.Add(new SubjectEntity
        {
            Id = "subject-1",
            Name = "Distributed Applications",
            Description = "Existing subject",
            Abbreviation = "DIA",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var manager = CreateSubjectManager(db);

        var exception = await Assert.ThrowsAsync<RpcException>(() => manager.CreateSubjectAsync(
            new SubjectProto.CreateSubjectRequest
            {
                Name = "Duplicate",
                Description = "Should fail",
                Abbreviation = " dia ",
            },
            CancellationToken.None));

        Assert.Equal(StatusCode.AlreadyExists, exception.StatusCode);
        Assert.Equal("subject abbreviation already exists", exception.Status.Detail);
    }

    [Fact]
    public async Task UpdateSubjectAsync_NormalizesAndPersistsUpdatedValues()
    {
        await using var db = CreateDbContext();
        await SeedSubjectAsync(db, "subject-1");
        var manager = CreateSubjectManager(db);

        var updated = await manager.UpdateSubjectAsync(
            new SubjectProto.UpdateSubjectRequest
            {
                SubjectId = "subject-1",
                Name = "  Service Architecture  ",
                Description = "  Updated contract boundaries.  ",
                Abbreviation = "  sar  ",
            },
            CancellationToken.None);

        Assert.Equal("subject-1", updated.Id);
        Assert.Equal("Service Architecture", updated.Name);
        Assert.Equal("Updated contract boundaries.", updated.Description);
        Assert.Equal("SAR", updated.Abbreviation);

        var persisted = await db.Subjects.SingleAsync(subject => subject.Id == "subject-1");
        Assert.Equal("Service Architecture", persisted.Name);
        Assert.Equal("Updated contract boundaries.", persisted.Description);
        Assert.Equal("SAR", persisted.Abbreviation);
    }

    [Fact]
    public async Task UpdateSubjectAsync_RejectsDuplicateAbbreviation()
    {
        await using var db = CreateDbContext();
        await SeedSubjectAsync(db, "subject-1");
        db.Subjects.Add(new SubjectEntity
        {
            Id = "subject-2",
            Name = "API Design",
            Description = "Second subject",
            Abbreviation = "API",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var manager = CreateSubjectManager(db);

        var exception = await Assert.ThrowsAsync<RpcException>(() => manager.UpdateSubjectAsync(
            new SubjectProto.UpdateSubjectRequest
            {
                SubjectId = "subject-1",
                Name = "Distributed Applications",
                Description = "Existing subject",
                Abbreviation = " api ",
            },
            CancellationToken.None));

        Assert.Equal(StatusCode.AlreadyExists, exception.StatusCode);
        Assert.Equal("subject abbreviation already exists", exception.Status.Detail);

        var persisted = await db.Subjects.SingleAsync(subject => subject.Id == "subject-1");
        Assert.Equal("DIA", persisted.Abbreviation);
    }

    [Fact]
    public async Task RegisterUserToSubjectAsync_IsIdempotent()
    {
        await using var db = CreateDbContext();
        await SeedSubjectAsync(db, "subject-1");
        var manager = CreateSubjectManager(db);

        await manager.RegisterUserToSubjectAsync(
            new SubjectProto.UserSubjectRequest
            {
                SubjectId = "subject-1",
                UserId = "student-1",
            },
            CancellationToken.None);

        await manager.RegisterUserToSubjectAsync(
            new SubjectProto.UserSubjectRequest
            {
                SubjectId = "subject-1",
                UserId = "student-1",
            },
            CancellationToken.None);

        Assert.Equal(1, await db.SubjectStudents.CountAsync());
        var membership = await db.SubjectStudents.SingleAsync();
        Assert.Equal("subject-1", membership.SubjectId);
        Assert.Equal("student-1", membership.UserId);
    }

    [Fact]
    public async Task RemoveUserFromSubjectAsync_RemovesExistingMembershipAndReturnsAck()
    {
        await using var db = CreateDbContext();
        await SeedSubjectAsync(db, "subject-1");
        db.SubjectStudents.AddRange(
            new SubjectStudentEntity
            {
                SubjectId = "subject-1",
                UserId = "student-1",
                CreatedAt = DateTimeOffset.UtcNow,
            },
            new SubjectStudentEntity
            {
                SubjectId = "subject-1",
                UserId = "student-2",
                CreatedAt = DateTimeOffset.UtcNow,
            });
        await db.SaveChangesAsync();

        var manager = CreateSubjectManager(db);

        var ack = await manager.RemoveUserFromSubjectAsync(
            new SubjectProto.UserSubjectRequest
            {
                SubjectId = "subject-1",
                UserId = "student-1",
            },
            CancellationToken.None);

        Assert.True(ack.Success);
        Assert.Equal("user removed from subject", ack.Message);
        Assert.Equal(1, await db.SubjectStudents.CountAsync());
        var remainingMembership = await db.SubjectStudents.SingleAsync();
        Assert.Equal("student-2", remainingMembership.UserId);
    }

    [Fact]
    public async Task RemoveUserFromSubjectAsync_IsIdempotentWhenMembershipDoesNotExist()
    {
        await using var db = CreateDbContext();
        await SeedSubjectAsync(db, "subject-1");
        var manager = CreateSubjectManager(db);

        var firstAck = await manager.RemoveUserFromSubjectAsync(
            new SubjectProto.UserSubjectRequest
            {
                SubjectId = "subject-1",
                UserId = "student-1",
            },
            CancellationToken.None);

        var secondAck = await manager.RemoveUserFromSubjectAsync(
            new SubjectProto.UserSubjectRequest
            {
                SubjectId = "subject-1",
                UserId = "student-1",
            },
            CancellationToken.None);

        Assert.True(firstAck.Success);
        Assert.True(secondAck.Success);
        Assert.Equal("user removed from subject", firstAck.Message);
        Assert.Equal("user removed from subject", secondAck.Message);
        Assert.Equal(0, await db.SubjectStudents.CountAsync());
    }

    [Fact]
    public async Task AssignTeacherToSubjectAsync_AddsTeacherAndReturnsUpdatedSubject()
    {
        await using var db = CreateDbContext();
        await SeedSubjectAsync(db, "subject-1");

        var authInvoker = new FakeUnaryCallInvoker();
        authInvoker.AddUnaryHandler<AuthProto.GetUserRequest, AuthProto.User>(
            "/auth.AuthService/GetUser",
            request => new AuthProto.User
            {
                Id = request.UserId,
                Firstname = "Demo",
                Lastname = "Teacher",
                Email = "teacher@example.com",
                Role = CommonProto.UserRole.Teacher,
            });

        var manager = CreateSubjectManager(
            db,
            authClient: new AuthProto.AuthService.AuthServiceClient(authInvoker));

        var subject = await manager.AssignTeacherToSubjectAsync(
            new SubjectProto.TeacherSubjectRequest
            {
                SubjectId = "subject-1",
                TeacherUserId = "teacher-1",
            },
            CancellationToken.None);

        Assert.Equal(new[] { "teacher-1" }, subject.TeacherIds);
        Assert.Equal(1, await db.SubjectTeachers.CountAsync());

        await manager.AssignTeacherToSubjectAsync(
            new SubjectProto.TeacherSubjectRequest
            {
                SubjectId = "subject-1",
                TeacherUserId = "teacher-1",
            },
            CancellationToken.None);

        Assert.Equal(1, await db.SubjectTeachers.CountAsync());
    }

    [Fact]
    public async Task AssignTeacherToSubjectAsync_RejectsNonTeacherRole()
    {
        await using var db = CreateDbContext();
        await SeedSubjectAsync(db, "subject-1");

        var authInvoker = new FakeUnaryCallInvoker();
        authInvoker.AddUnaryHandler<AuthProto.GetUserRequest, AuthProto.User>(
            "/auth.AuthService/GetUser",
            request => new AuthProto.User
            {
                Id = request.UserId,
                Firstname = "Demo",
                Lastname = "Student",
                Email = "student@example.com",
                Role = CommonProto.UserRole.Student,
            });

        var manager = CreateSubjectManager(
            db,
            authClient: new AuthProto.AuthService.AuthServiceClient(authInvoker));

        var exception = await Assert.ThrowsAsync<RpcException>(() => manager.AssignTeacherToSubjectAsync(
            new SubjectProto.TeacherSubjectRequest
            {
                SubjectId = "subject-1",
                TeacherUserId = "student-1",
            },
            CancellationToken.None));

        Assert.Equal(StatusCode.InvalidArgument, exception.StatusCode);
        Assert.Equal("teacher user must have teacher or admin role", exception.Status.Detail);
        Assert.Equal(0, await db.SubjectTeachers.CountAsync());
    }

    [Fact]
    public async Task RemoveTeacherFromSubjectAsync_RemovesExistingTeacherAndUpdatesTimestamp()
    {
        await using var db = CreateDbContext();
        var originalUpdatedAt = new DateTimeOffset(2026, 1, 10, 8, 30, 0, TimeSpan.Zero);
        db.Subjects.Add(new SubjectEntity
        {
            Id = "subject-1",
            Name = "Distributed Applications",
            Description = "Existing subject",
            Abbreviation = "DIA",
            CreatedAt = originalUpdatedAt.AddDays(-7),
            UpdatedAt = originalUpdatedAt,
            Teachers =
            [
                new SubjectTeacherEntity
                {
                    SubjectId = "subject-1",
                    TeacherUserId = "teacher-1",
                    CreatedAt = originalUpdatedAt.AddDays(-1),
                },
                new SubjectTeacherEntity
                {
                    SubjectId = "subject-1",
                    TeacherUserId = "teacher-2",
                    CreatedAt = originalUpdatedAt.AddHours(-12),
                },
            ],
        });
        await db.SaveChangesAsync();

        var manager = CreateSubjectManager(db);

        var updated = await manager.RemoveTeacherFromSubjectAsync(
            new SubjectProto.TeacherSubjectRequest
            {
                SubjectId = "subject-1",
                TeacherUserId = "teacher-1",
            },
            CancellationToken.None);

        Assert.Equal(new[] { "teacher-2" }, updated.TeacherIds);
        Assert.Equal(1, await db.SubjectTeachers.CountAsync());
        Assert.DoesNotContain(await db.SubjectTeachers.Select(entity => entity.TeacherUserId).ToListAsync(), id => id == "teacher-1");

        var persisted = await db.Subjects.SingleAsync(subject => subject.Id == "subject-1");
        Assert.True(persisted.UpdatedAt > originalUpdatedAt);
    }

    [Fact]
    public async Task RemoveTeacherFromSubjectAsync_IsIdempotentWhenTeacherIsMissing()
    {
        await using var db = CreateDbContext();
        var originalUpdatedAt = new DateTimeOffset(2026, 1, 10, 8, 30, 0, TimeSpan.Zero);
        db.Subjects.Add(new SubjectEntity
        {
            Id = "subject-1",
            Name = "Distributed Applications",
            Description = "Existing subject",
            Abbreviation = "DIA",
            CreatedAt = originalUpdatedAt.AddDays(-7),
            UpdatedAt = originalUpdatedAt,
            Teachers =
            [
                new SubjectTeacherEntity
                {
                    SubjectId = "subject-1",
                    TeacherUserId = "teacher-2",
                    CreatedAt = originalUpdatedAt.AddDays(-1),
                },
            ],
        });
        await db.SaveChangesAsync();

        var manager = CreateSubjectManager(db);

        var firstResult = await manager.RemoveTeacherFromSubjectAsync(
            new SubjectProto.TeacherSubjectRequest
            {
                SubjectId = "subject-1",
                TeacherUserId = "teacher-1",
            },
            CancellationToken.None);

        var secondResult = await manager.RemoveTeacherFromSubjectAsync(
            new SubjectProto.TeacherSubjectRequest
            {
                SubjectId = "subject-1",
                TeacherUserId = "teacher-1",
            },
            CancellationToken.None);

        Assert.Equal(new[] { "teacher-2" }, firstResult.TeacherIds);
        Assert.Equal(new[] { "teacher-2" }, secondResult.TeacherIds);
        Assert.Equal(1, await db.SubjectTeachers.CountAsync());

        var persisted = await db.Subjects.SingleAsync(subject => subject.Id == "subject-1");
        Assert.Equal(originalUpdatedAt, persisted.UpdatedAt);
    }

    [Fact]
    public async Task DeleteSubjectAsync_RejectsWhenProjectReferencesSubject()
    {
        await using var db = CreateDbContext();
        await SeedSubjectAsync(db, "subject-1");

        var projectInvoker = new FakeUnaryCallInvoker();
        projectInvoker.AddUnaryHandler<ProjectProto.ListProjectsRequest, ProjectProto.ListProjectsResponse>(
            "/project.ProjectService/ListProjects",
            _ =>
            {
                var response = new ProjectProto.ListProjectsResponse();
                response.Projects.Add(new ProjectProto.Project
                {
                    ProjectId = "project-1",
                    Title = "Router",
                    Description = "Uses the subject",
                    SubjectId = "subject-1",
                });
                return response;
            });

        var manager = CreateSubjectManager(
            db,
            projectClient: new ProjectProto.ProjectService.ProjectServiceClient(projectInvoker));

        var exception = await Assert.ThrowsAsync<RpcException>(() => manager.DeleteSubjectAsync(
            new SubjectProto.DeleteSubjectRequest { SubjectId = "subject-1" },
            CancellationToken.None));

        Assert.Equal(StatusCode.FailedPrecondition, exception.StatusCode);
        Assert.Equal(1, await db.Subjects.CountAsync());
    }

    [Fact]
    public async Task DeleteSubjectAsync_RemovesSubjectWhenNoProjectReferencesIt()
    {
        await using var db = CreateDbContext();
        await SeedSubjectAsync(db, "subject-1");

        var manager = CreateSubjectManager(db);

        var ack = await manager.DeleteSubjectAsync(
            new SubjectProto.DeleteSubjectRequest { SubjectId = "subject-1" },
            CancellationToken.None);

        Assert.True(ack.Success);
        Assert.Equal("subject deleted", ack.Message);
        Assert.Equal(0, await db.Subjects.CountAsync());
    }

    [Fact]
    public async Task ListSubjectsAsync_ReturnsMembershipsOrderedBySubjectName()
    {
        await using var db = CreateDbContext();
        var now = DateTimeOffset.UtcNow;
        db.Subjects.AddRange(
            new SubjectEntity
            {
                Id = "subject-b",
                Name = "Beta",
                Description = "Second",
                Abbreviation = "BET",
                CreatedAt = now,
                UpdatedAt = now,
                Students =
                [
                    new SubjectStudentEntity { SubjectId = "subject-b", UserId = "student-2", CreatedAt = now },
                ],
            },
            new SubjectEntity
            {
                Id = "subject-a",
                Name = "Alpha",
                Description = "First",
                Abbreviation = "ALP",
                CreatedAt = now,
                UpdatedAt = now,
                Teachers =
                [
                    new SubjectTeacherEntity { SubjectId = "subject-a", TeacherUserId = "teacher-1", CreatedAt = now },
                ],
            });
        await db.SaveChangesAsync();

        var manager = CreateSubjectManager(db);

        var subjects = await manager.ListSubjectsAsync(CancellationToken.None);

        Assert.Equal(new[] { "Alpha", "Beta" }, subjects.Select(subject => subject.Name));
        Assert.Equal(new[] { "teacher-1" }, subjects[0].TeacherIds);
        Assert.Equal(new[] { "student-2" }, subjects[1].UserIds);
    }

    private static SubjectDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<SubjectDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;

        return new SubjectDbContext(options);
    }

    private static SubjectManager CreateSubjectManager(
        SubjectDbContext db,
        AuthProto.AuthService.AuthServiceClient? authClient = null,
        ProjectProto.ProjectService.ProjectServiceClient? projectClient = null)
    {
        authClient ??= new AuthProto.AuthService.AuthServiceClient(new FakeUnaryCallInvoker());

        if (projectClient is null)
        {
            var projectInvoker = new FakeUnaryCallInvoker();
            projectInvoker.AddUnaryHandler<ProjectProto.ListProjectsRequest, ProjectProto.ListProjectsResponse>(
                "/project.ProjectService/ListProjects",
                _ => new ProjectProto.ListProjectsResponse());
            projectClient = new ProjectProto.ProjectService.ProjectServiceClient(projectInvoker);
        }

        return new SubjectManager(
            db,
            authClient,
            projectClient,
            NullLogger<SubjectManager>.Instance);
    }

    private static async Task SeedSubjectAsync(SubjectDbContext db, string subjectId)
    {
        db.Subjects.Add(new SubjectEntity
        {
            Id = subjectId,
            Name = "Distributed Applications",
            Description = "Existing subject",
            Abbreviation = "DIA",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
    }
}
