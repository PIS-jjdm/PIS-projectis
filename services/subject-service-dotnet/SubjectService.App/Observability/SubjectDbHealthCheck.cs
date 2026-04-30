using Microsoft.Extensions.Diagnostics.HealthChecks;
using SubjectServiceDotnet.Data;

namespace SubjectServiceDotnet.Observability;

public sealed class SubjectDbHealthCheck(SubjectDbContext db) : IHealthCheck
{
    private readonly SubjectDbContext _db = db;

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (await _db.Database.CanConnectAsync(cancellationToken))
            {
                return HealthCheckResult.Healthy("subject database is reachable");
            }

            return HealthCheckResult.Unhealthy("subject database is not reachable");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("subject database health check failed", ex);
        }
    }
}
