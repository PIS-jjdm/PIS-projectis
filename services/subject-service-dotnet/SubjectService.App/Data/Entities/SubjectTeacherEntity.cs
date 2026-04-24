namespace SubjectServiceDotnet.Data.Entities;

public sealed class SubjectTeacherEntity
{
    public string SubjectId { get; set; } = string.Empty;

    public string TeacherUserId { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public SubjectEntity? Subject { get; set; }
}
