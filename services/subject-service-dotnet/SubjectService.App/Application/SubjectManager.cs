using Grpc.Core;
using Microsoft.EntityFrameworkCore;
using SubjectServiceDotnet.Data;
using SubjectServiceDotnet.Data.Entities;
using AuthProto = Auth;
using CommonProto = Common;
using ProjectProto = Project;
using SubjectProto = Subject;

namespace SubjectServiceDotnet.Application;

public sealed class SubjectManager(
    SubjectDbContext db,
    AuthProto.AuthService.AuthServiceClient authClient,
    ProjectProto.ProjectService.ProjectServiceClient projectClient,
    ILogger<SubjectManager> logger)
{
    private readonly SubjectDbContext _db = db;
    private readonly AuthProto.AuthService.AuthServiceClient _authClient = authClient;
    private readonly ProjectProto.ProjectService.ProjectServiceClient _projectClient = projectClient;
    private readonly ILogger<SubjectManager> _logger = logger;

    public async Task<IReadOnlyList<SubjectProto.Subject>> ListSubjectsAsync(
        CancellationToken cancellationToken)
    {
        var subjects = await SubjectQuery()
            .OrderBy(subject => subject.Name)
            .ToListAsync(cancellationToken);

        return subjects.Select(ToProto).ToList();
    }

    public async Task<SubjectProto.Subject> GetSubjectAsync(
        string subjectId,
        CancellationToken cancellationToken)
    {
        var subject = await LoadSubjectAggregateAsync(subjectId, cancellationToken);
        return ToProto(subject);
    }

    public async Task<SubjectProto.Subject> CreateSubjectAsync(
        SubjectProto.CreateSubjectRequest request,
        CancellationToken cancellationToken)
    {
        var name = NormalizeRequired(request.Name, "subject name");
        var abbreviation = NormalizeAbbreviation(request.Abbreviation);
        var description = NormalizeOptional(request.Description);

        await EnsureAbbreviationIsUniqueAsync(abbreviation, null, cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var subject = new SubjectEntity
        {
            Id = $"subject-{Guid.NewGuid():N}",
            Name = name,
            Description = description,
            Abbreviation = abbreviation,
            CreatedAt = now,
            UpdatedAt = now,
        };

        _db.Subjects.Add(subject);
        await _db.SaveChangesAsync(cancellationToken);
        return ToProto(subject);
    }

    public async Task<SubjectProto.Subject> UpdateSubjectAsync(
        SubjectProto.UpdateSubjectRequest request,
        CancellationToken cancellationToken)
    {
        var subject = await LoadSubjectAggregateAsync(request.SubjectId, cancellationToken);
        var name = NormalizeRequired(request.Name, "subject name");
        var abbreviation = NormalizeAbbreviation(request.Abbreviation);
        var description = NormalizeOptional(request.Description);

        await EnsureAbbreviationIsUniqueAsync(abbreviation, subject.Id, cancellationToken);

        subject.Name = name;
        subject.Description = description;
        subject.Abbreviation = abbreviation;
        subject.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);
        return ToProto(subject);
    }

    public async Task<CommonProto.Ack> DeleteSubjectAsync(
        SubjectProto.DeleteSubjectRequest request,
        CancellationToken cancellationToken)
    {
        var subjectId = NormalizeRequired(request.SubjectId, "subject id");
        var subject = await _db.Subjects.SingleOrDefaultAsync(
            entity => entity.Id == subjectId,
            cancellationToken);

        if (subject is null)
        {
            throw NotFound("subject not found");
        }

        await EnsureSubjectHasNoLinkedProjectsAsync(subjectId, cancellationToken);

        _db.Subjects.Remove(subject);
        await _db.SaveChangesAsync(cancellationToken);

        return Ack("subject deleted");
    }

    public async Task<CommonProto.Ack> RegisterUserToSubjectAsync(
        SubjectProto.UserSubjectRequest request,
        CancellationToken cancellationToken)
    {
        var subjectId = NormalizeRequired(request.SubjectId, "subject id");
        var userId = NormalizeRequired(request.UserId, "user id");

        await EnsureSubjectExistsAsync(subjectId, cancellationToken);

        var existing = await _db.SubjectStudents.AnyAsync(
            entity => entity.SubjectId == subjectId && entity.UserId == userId,
            cancellationToken);

        if (!existing)
        {
            _db.SubjectStudents.Add(new SubjectStudentEntity
            {
                SubjectId = subjectId,
                UserId = userId,
                CreatedAt = DateTimeOffset.UtcNow,
            });
            await _db.SaveChangesAsync(cancellationToken);
        }

        return Ack("user registered to subject");
    }

    public async Task<CommonProto.Ack> RemoveUserFromSubjectAsync(
        SubjectProto.UserSubjectRequest request,
        CancellationToken cancellationToken)
    {
        var subjectId = NormalizeRequired(request.SubjectId, "subject id");
        var userId = NormalizeRequired(request.UserId, "user id");

        await EnsureSubjectExistsAsync(subjectId, cancellationToken);

        var membership = await _db.SubjectStudents.SingleOrDefaultAsync(
            entity => entity.SubjectId == subjectId && entity.UserId == userId,
            cancellationToken);

        if (membership is not null)
        {
            _db.SubjectStudents.Remove(membership);
            await _db.SaveChangesAsync(cancellationToken);
        }

        return Ack("user removed from subject");
    }

    public async Task<SubjectProto.Subject> AssignTeacherToSubjectAsync(
        SubjectProto.TeacherSubjectRequest request,
        CancellationToken cancellationToken)
    {
        var subject = await LoadSubjectAggregateAsync(request.SubjectId, cancellationToken);
        var teacherUserId = NormalizeRequired(request.TeacherUserId, "teacher user id");
        var user = await FetchUserAsync(teacherUserId, cancellationToken);

        var userRole = (int)user.Role;
        if (userRole is not 2 and not 3)
        {
            throw InvalidArgument("teacher user must have teacher or admin role");
        }

        var existing = subject.Teachers.Any(teacher => teacher.TeacherUserId == teacherUserId);
        if (!existing)
        {
            subject.Teachers.Add(new SubjectTeacherEntity
            {
                SubjectId = subject.Id,
                TeacherUserId = teacherUserId,
                CreatedAt = DateTimeOffset.UtcNow,
            });
            subject.UpdatedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
        }

        return ToProto(subject);
    }

    public async Task<SubjectProto.Subject> RemoveTeacherFromSubjectAsync(
        SubjectProto.TeacherSubjectRequest request,
        CancellationToken cancellationToken)
    {
        var subject = await LoadSubjectAggregateAsync(request.SubjectId, cancellationToken);
        var teacherUserId = NormalizeRequired(request.TeacherUserId, "teacher user id");

        var teacher = subject.Teachers.SingleOrDefault(entity => entity.TeacherUserId == teacherUserId);
        if (teacher is not null)
        {
            subject.Teachers.Remove(teacher);
            subject.UpdatedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
        }

        return ToProto(subject);
    }

    private IQueryable<SubjectEntity> SubjectQuery()
    {
        return _db.Subjects
            .AsNoTracking()
            .Include(subject => subject.Students)
            .Include(subject => subject.Teachers);
    }

    private async Task<SubjectEntity> LoadSubjectAggregateAsync(
        string subjectId,
        CancellationToken cancellationToken)
    {
        var normalizedSubjectId = NormalizeRequired(subjectId, "subject id");
        var subject = await _db.Subjects
            .Include(entity => entity.Students)
            .Include(entity => entity.Teachers)
            .SingleOrDefaultAsync(entity => entity.Id == normalizedSubjectId, cancellationToken);

        if (subject is null)
        {
            throw NotFound("subject not found");
        }

        return subject;
    }

    private async Task EnsureSubjectExistsAsync(string subjectId, CancellationToken cancellationToken)
    {
        var exists = await _db.Subjects.AnyAsync(entity => entity.Id == subjectId, cancellationToken);
        if (!exists)
        {
            throw NotFound("subject not found");
        }
    }

    private async Task EnsureAbbreviationIsUniqueAsync(
        string abbreviation,
        string? subjectIdToIgnore,
        CancellationToken cancellationToken)
    {
        var query = _db.Subjects.Where(entity => entity.Abbreviation == abbreviation);
        if (!string.IsNullOrWhiteSpace(subjectIdToIgnore))
        {
            query = query.Where(entity => entity.Id != subjectIdToIgnore);
        }

        var exists = await query.AnyAsync(cancellationToken);

        if (exists)
        {
            throw AlreadyExists("subject abbreviation already exists");
        }
    }

    private async Task<AuthProto.User> FetchUserAsync(
        string userId,
        CancellationToken cancellationToken)
    {
        try
        {
            return await _authClient.GetUserAsync(
                new AuthProto.GetUserRequest { UserId = userId },
                cancellationToken: cancellationToken);
        }
        catch (RpcException ex) when (ex.StatusCode == StatusCode.NotFound)
        {
            throw NotFound("teacher user not found");
        }
        catch (RpcException ex)
        {
            _logger.LogWarning(ex, "Failed to load user {UserId} from auth-service", userId);
            throw new RpcException(
                new Status(StatusCode.Unavailable, "failed to validate teacher user"));
        }
    }

    private async Task EnsureSubjectHasNoLinkedProjectsAsync(
        string subjectId,
        CancellationToken cancellationToken)
    {
        ProjectProto.ListProjectsResponse response;
        try
        {
            response = await _projectClient.ListProjectsAsync(
                new ProjectProto.ListProjectsRequest(),
                cancellationToken: cancellationToken);
        }
        catch (RpcException ex)
        {
            _logger.LogWarning(
                ex,
                "Failed to verify linked projects for subject {SubjectId}",
                subjectId);
            throw new RpcException(
                new Status(StatusCode.Unavailable, "failed to verify linked projects"));
        }

        var isReferenced = response.Projects.Any(project =>
            string.Equals(project.SubjectId?.Trim(), subjectId, StringComparison.Ordinal));

        if (isReferenced)
        {
            throw new RpcException(
                new Status(StatusCode.FailedPrecondition, "cannot delete subject with linked projects"));
        }
    }

    private static SubjectProto.Subject ToProto(SubjectEntity entity)
    {
        var subject = new SubjectProto.Subject
        {
            Id = entity.Id,
            Name = entity.Name,
            Description = entity.Description,
            Abbreviation = entity.Abbreviation,
        };

        subject.UserIds.AddRange(entity.Students
            .OrderBy(student => student.UserId)
            .Select(student => student.UserId));
        subject.TeacherIds.AddRange(entity.Teachers
            .OrderBy(teacher => teacher.TeacherUserId)
            .Select(teacher => teacher.TeacherUserId));

        return subject;
    }

    private static string NormalizeRequired(string value, string fieldName)
    {
        var normalized = value.Trim();
        if (normalized.Length == 0)
        {
            throw InvalidArgument($"missing {fieldName}");
        }

        return normalized;
    }

    private static string NormalizeOptional(string value)
    {
        return value.Trim();
    }

    private static string NormalizeAbbreviation(string value)
    {
        return NormalizeRequired(value, "subject abbreviation").ToUpperInvariant();
    }

    private static CommonProto.Ack Ack(string message)
    {
        return new CommonProto.Ack
        {
            Success = true,
            Message = message,
        };
    }

    private static RpcException InvalidArgument(string message)
    {
        return new RpcException(new Status(StatusCode.InvalidArgument, message));
    }

    private static RpcException NotFound(string message)
    {
        return new RpcException(new Status(StatusCode.NotFound, message));
    }

    private static RpcException AlreadyExists(string message)
    {
        return new RpcException(new Status(StatusCode.AlreadyExists, message));
    }
}
