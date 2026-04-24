using Microsoft.EntityFrameworkCore;
using SubjectServiceDotnet.Data.Entities;

namespace SubjectServiceDotnet.Data;

public sealed class SubjectDbContext(DbContextOptions<SubjectDbContext> options) : DbContext(options)
{
    public DbSet<SubjectEntity> Subjects => Set<SubjectEntity>();

    public DbSet<SubjectStudentEntity> SubjectStudents => Set<SubjectStudentEntity>();

    public DbSet<SubjectTeacherEntity> SubjectTeachers => Set<SubjectTeacherEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SubjectEntity>(entity =>
        {
            entity.ToTable("subjects");
            entity.HasKey(subject => subject.Id);

            entity.Property(subject => subject.Id).HasColumnName("id");
            entity.Property(subject => subject.Name).HasColumnName("name").IsRequired();
            entity.Property(subject => subject.Description).HasColumnName("description").IsRequired();
            entity.Property(subject => subject.Abbreviation).HasColumnName("abbreviation").IsRequired();
            entity.Property(subject => subject.CreatedAt).HasColumnName("created_at");
            entity.Property(subject => subject.UpdatedAt).HasColumnName("updated_at");

            entity.HasIndex(subject => subject.Abbreviation).IsUnique();
            entity.HasIndex(subject => subject.Name);

            entity.HasMany(subject => subject.Students)
                .WithOne(student => student.Subject)
                .HasForeignKey(student => student.SubjectId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(subject => subject.Teachers)
                .WithOne(teacher => teacher.Subject)
                .HasForeignKey(teacher => teacher.SubjectId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SubjectStudentEntity>(entity =>
        {
            entity.ToTable("subject_students");
            entity.HasKey(student => new { student.SubjectId, student.UserId });

            entity.Property(student => student.SubjectId).HasColumnName("subject_id");
            entity.Property(student => student.UserId).HasColumnName("user_id");
            entity.Property(student => student.CreatedAt).HasColumnName("created_at");

            entity.HasIndex(student => student.UserId);
        });

        modelBuilder.Entity<SubjectTeacherEntity>(entity =>
        {
            entity.ToTable("subject_teachers");
            entity.HasKey(teacher => new { teacher.SubjectId, teacher.TeacherUserId });

            entity.Property(teacher => teacher.SubjectId).HasColumnName("subject_id");
            entity.Property(teacher => teacher.TeacherUserId).HasColumnName("teacher_user_id");
            entity.Property(teacher => teacher.CreatedAt).HasColumnName("created_at");

            entity.HasIndex(teacher => teacher.TeacherUserId);
        });
    }
}
