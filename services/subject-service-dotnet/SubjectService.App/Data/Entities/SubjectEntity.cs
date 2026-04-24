namespace SubjectServiceDotnet.Data.Entities;

public sealed class SubjectEntity
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string Abbreviation { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public List<SubjectStudentEntity> Students { get; set; } = [];

    public List<SubjectTeacherEntity> Teachers { get; set; } = [];
}
