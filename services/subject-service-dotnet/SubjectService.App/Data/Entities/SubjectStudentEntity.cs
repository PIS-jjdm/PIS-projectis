namespace SubjectServiceDotnet.Data.Entities;

public sealed class SubjectStudentEntity
{
    public string SubjectId { get; set; } = string.Empty;

    public string UserId { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public SubjectEntity? Subject { get; set; }
}
