using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using SubjectServiceDotnet.Application;
using SubjectServiceDotnet.Data;
using SubjectServiceDotnet.Data.Entities;
using SubjectServiceDotnet.Grpc;
using SubjectServiceDotnet.Observability;
using AuthProto = Auth;
using ProjectProto = Project;

var builder = WebApplication.CreateBuilder(args);

var port = builder.Configuration.GetValue("SUBJECT_SERVICE_PORT", 50053);
var healthPort = builder.Configuration.GetValue("SUBJECT_HEALTH_PORT", 50080);
var subjectDbConnectionString =
    builder.Configuration.GetConnectionString("SubjectDb")
    ?? "Host=127.0.0.1;Port=5432;Database=subject;Username=subject;Password=subject";
var authGrpcEndpoint =
    builder.Configuration["AUTH_GRPC_ENDPOINT"] ?? "http://127.0.0.1:50051";
var projectGrpcEndpoint =
    builder.Configuration["PROJECT_GRPC_ENDPOINT"] ?? "http://127.0.0.1:50054";
var otelServiceName =
    builder.Configuration["OTEL_SERVICE_NAME"] ?? "subject-service";

builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenAnyIP(port, listenOptions =>
    {
        listenOptions.Protocols = HttpProtocols.Http2;
    });
    options.ListenAnyIP(healthPort, listenOptions =>
    {
        listenOptions.Protocols = HttpProtocols.Http1;
    });
});

builder.Services.AddGrpc();
builder.Services.AddDbContext<SubjectDbContext>(options =>
{
    options.UseNpgsql(subjectDbConnectionString);
});
builder.Services.AddGrpcClient<AuthProto.AuthService.AuthServiceClient>(options =>
{
    options.Address = new Uri(authGrpcEndpoint);
});
builder.Services.AddGrpcClient<ProjectProto.ProjectService.ProjectServiceClient>(options =>
{
    options.Address = new Uri(projectGrpcEndpoint);
});
builder.Services.AddScoped<SubjectManager>();
builder.Services.AddSingleton<SubjectMetrics>();
builder.Services
    .AddHealthChecks()
    .AddCheck<SubjectDbHealthCheck>("subject-db");
builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService(otelServiceName))
    .WithMetrics(metrics =>
    {
        metrics
            .AddAspNetCoreInstrumentation()
            .AddRuntimeInstrumentation()
            .AddMeter(SubjectMetrics.MeterName)
            .AddOtlpExporter();
    })
    .WithTracing(tracing =>
    {
        tracing.AddAspNetCoreInstrumentation();
        tracing.AddOtlpExporter();
    });

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<SubjectDbContext>();
    await db.Database.MigrateAsync();
    await SeedDemoSubjectsAsync(db, builder.Configuration);
}

app.MapGrpcService<SubjectGrpcService>();
app.MapGet("/health/live", () => Results.Ok("Healthy"));
app.MapHealthChecks("/health");
app.MapHealthChecks("/health/ready");
app.MapGet("/", () => "Use a gRPC client to communicate with this service.");
await app.RunAsync();

static async Task SeedDemoSubjectsAsync(SubjectDbContext db, IConfiguration configuration)
{
    if (!configuration.GetValue("SEED_DEMO_SUBJECTS", true))
    {
        return;
    }

    if (await db.Subjects.AnyAsync())
    {
        return;
    }

    var now = DateTimeOffset.UtcNow;
    db.Subjects.AddRange(
        new SubjectEntity
        {
            Id = "subject-1",
            Name = "Secure Software Systems",
            Description = "Focuses on secure coding, threat modeling, and software assurance.",
            Abbreviation = "SSS",
            CreatedAt = now,
            UpdatedAt = now,
        },
        new SubjectEntity
        {
            Id = "subject-2",
            Name = "Distributed Applications",
            Description = "Covers service design, microservices, messaging, and observability.",
            Abbreviation = "DIA",
            CreatedAt = now,
            UpdatedAt = now,
        },
        new SubjectEntity
        {
            Id = "subject-3",
            Name = "Applied Cryptography",
            Description = "Practical symmetric and asymmetric cryptography used in real systems.",
            Abbreviation = "ACR",
            CreatedAt = now,
            UpdatedAt = now,
        },
        new SubjectEntity
        {
            Id = "subject-4",
            Name = "Human Computer Interaction",
            Description = "Explores interaction design, interface evaluation, and collaborative prototyping.",
            Abbreviation = "HCI",
            CreatedAt = now,
            UpdatedAt = now,
        });

    await db.SaveChangesAsync();
}
