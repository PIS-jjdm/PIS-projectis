using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace SubjectServiceDotnet.Data;

public sealed class SubjectDbContextFactory : IDesignTimeDbContextFactory<SubjectDbContext>
{
    public SubjectDbContext CreateDbContext(string[] args)
    {
        var connectionString =
            Environment.GetEnvironmentVariable("ConnectionStrings__SubjectDb")
            ?? "Host=127.0.0.1;Port=5432;Database=subject;Username=subject;Password=subject";

        var options = new DbContextOptionsBuilder<SubjectDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new SubjectDbContext(options);
    }
}
