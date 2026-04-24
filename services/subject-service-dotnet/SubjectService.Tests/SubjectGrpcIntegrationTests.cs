using System.Net;
using Grpc.Core;
using Grpc.Net.Client;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SubjectServiceDotnet.Application;
using SubjectServiceDotnet.Data;
using SubjectServiceDotnet.Data.Entities;
using SubjectServiceDotnet.Grpc;
using Xunit;
using AuthProto = Auth;
using CommonProto = Common;
using ProjectProto = Project;
using SubjectProto = Subject;

namespace SubjectServiceDotnet.Tests;

public sealed class SubjectGrpcIntegrationTests
{
    [Fact]
    public async Task CreateSubject_ThenGetSubject_PersistsThroughGrpcBoundary()
    {
        await using var host = await SubjectGrpcTestHost.StartAsync();
        var client = host.CreateClient();

        var created = await client.CreateSubjectAsync(new SubjectProto.CreateSubjectRequest
        {
            Name = "  API Design  ",
            Description = "  gRPC integration boundary  ",
            Abbreviation = "  api  ",
        });

        Assert.Equal("API Design", created.Name);
        Assert.Equal("gRPC integration boundary", created.Description);
        Assert.Equal("API", created.Abbreviation);

        var loaded = await client.GetSubjectAsync(new SubjectProto.GetSubjectRequest
        {
            SubjectId = created.Id,
        });

        Assert.Equal(created.Id, loaded.Id);
        Assert.Equal("API Design", loaded.Name);
        Assert.Equal("API", loaded.Abbreviation);
        Assert.Empty(loaded.UserIds);
        Assert.Empty(loaded.TeacherIds);
    }

    [Fact]
    public async Task UpdateSubject_PersistsNormalizedValuesThroughGrpcBoundary()
    {
        await using var host = await SubjectGrpcTestHost.StartAsync();
        await host.SeedSubjectAsync("subject-1", "Distributed Applications", "DIA");
        var client = host.CreateClient();

        var updated = await client.UpdateSubjectAsync(new SubjectProto.UpdateSubjectRequest
        {
            SubjectId = "subject-1",
            Name = "  Service Architecture  ",
            Description = "  Updated through gRPC  ",
            Abbreviation = "  sar  ",
        });

        Assert.Equal("subject-1", updated.Id);
        Assert.Equal("Service Architecture", updated.Name);
        Assert.Equal("Updated through gRPC", updated.Description);
        Assert.Equal("SAR", updated.Abbreviation);

        var loaded = await client.GetSubjectAsync(new SubjectProto.GetSubjectRequest
        {
            SubjectId = "subject-1",
        });

        Assert.Equal("Service Architecture", loaded.Name);
        Assert.Equal("Updated through gRPC", loaded.Description);
        Assert.Equal("SAR", loaded.Abbreviation);
    }

    [Fact]
    public async Task UpdateSubject_ReturnsAlreadyExists_WhenAbbreviationConflicts()
    {
        await using var host = await SubjectGrpcTestHost.StartAsync();
        await host.SeedSubjectAsync("subject-1", "Distributed Applications", "DIA");
        await host.SeedSubjectAsync("subject-2", "API Design", "API");
        var client = host.CreateClient();

        var exception = await Assert.ThrowsAsync<RpcException>(() => client.UpdateSubjectAsync(
            new SubjectProto.UpdateSubjectRequest
            {
                SubjectId = "subject-1",
                Name = "Distributed Applications",
                Description = "Existing subject",
                Abbreviation = " api ",
            }).ResponseAsync);

        Assert.Equal(StatusCode.AlreadyExists, exception.StatusCode);
        Assert.Equal("subject abbreviation already exists", exception.Status.Detail);
    }

    [Fact]
    public async Task AssignTeacherToSubject_ReturnsInvalidArgument_ForNonTeacherRole()
    {
        await using var host = await SubjectGrpcTestHost.StartAsync(authInvoker =>
        {
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
        });

        await host.SeedSubjectAsync("subject-1", "Distributed Applications", "DIA");
        var client = host.CreateClient();

        var exception = await Assert.ThrowsAsync<RpcException>(() => client.AssignTeacherToSubjectAsync(
            new SubjectProto.TeacherSubjectRequest
            {
                SubjectId = "subject-1",
                TeacherUserId = "student-1",
            }).ResponseAsync);

        Assert.Equal(StatusCode.InvalidArgument, exception.StatusCode);
        Assert.Equal("teacher user must have teacher or admin role", exception.Status.Detail);
    }

    [Fact]
    public async Task DeleteSubject_ReturnsFailedPrecondition_WhenProjectExists()
    {
        await using var host = await SubjectGrpcTestHost.StartAsync(
            configureProjectInvoker: projectInvoker =>
            {
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
            });

        await host.SeedSubjectAsync("subject-1", "Distributed Applications", "DIA");
        var client = host.CreateClient();

        var exception = await Assert.ThrowsAsync<RpcException>(() => client.DeleteSubjectAsync(
            new SubjectProto.DeleteSubjectRequest
            {
                SubjectId = "subject-1",
            }).ResponseAsync);

        Assert.Equal(StatusCode.FailedPrecondition, exception.StatusCode);
        Assert.Equal("cannot delete subject with linked projects", exception.Status.Detail);
    }
}

internal sealed class SubjectGrpcTestHost : IAsyncDisposable
{
    private readonly Action<FakeUnaryCallInvoker> _configureAuthInvoker;
    private readonly Action<FakeUnaryCallInvoker> _configureProjectInvoker;
    private readonly InMemoryDatabaseRoot _databaseRoot = new();
    private readonly string _databaseName = Guid.NewGuid().ToString("N");
    private WebApplication? _app;
    private GrpcChannel? _channel;
    private Uri? _baseAddress;

    private SubjectGrpcTestHost(
        Action<FakeUnaryCallInvoker>? configureAuthInvoker,
        Action<FakeUnaryCallInvoker>? configureProjectInvoker)
    {
        _configureAuthInvoker = configureAuthInvoker ?? (_ => { });
        _configureProjectInvoker = configureProjectInvoker ?? (_ => { });
    }

    public static async Task<SubjectGrpcTestHost> StartAsync(
        Action<FakeUnaryCallInvoker>? configureAuthInvoker = null,
        Action<FakeUnaryCallInvoker>? configureProjectInvoker = null)
    {
        var host = new SubjectGrpcTestHost(configureAuthInvoker, configureProjectInvoker);
        await host.StartAsync();
        return host;
    }

    public SubjectProto.SubjectService.SubjectServiceClient CreateClient()
    {
        return new SubjectProto.SubjectService.SubjectServiceClient(_channel
            ?? throw new InvalidOperationException("test host not started"));
    }

    public async Task SeedSubjectAsync(string subjectId, string name, string abbreviation)
    {
        await using var scope = _app!.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SubjectDbContext>();
        db.Subjects.Add(new SubjectEntity
        {
            Id = subjectId,
            Name = name,
            Description = "Seeded subject",
            Abbreviation = abbreviation,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
    }

    public async ValueTask DisposeAsync()
    {
        if (_channel is not null)
        {
            _channel.Dispose();
        }

        if (_app is not null)
        {
            await _app.StopAsync();
            await _app.DisposeAsync();
        }
    }

    private async Task StartAsync()
    {
        var authInvoker = new FakeUnaryCallInvoker();
        var projectInvoker = new FakeUnaryCallInvoker();

        projectInvoker.AddUnaryHandler<ProjectProto.ListProjectsRequest, ProjectProto.ListProjectsResponse>(
            "/project.ProjectService/ListProjects",
            _ => new ProjectProto.ListProjectsResponse());

        _configureAuthInvoker(authInvoker);
        _configureProjectInvoker(projectInvoker);

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = Environments.Development,
        });

        builder.WebHost.ConfigureKestrel(options =>
        {
            options.Listen(IPAddress.Loopback, 0, listenOptions =>
            {
                listenOptions.Protocols = HttpProtocols.Http2;
            });
        });

        builder.Logging.ClearProviders();
        builder.Services.AddGrpc();
        builder.Services.AddDbContext<SubjectDbContext>(options =>
        {
            options.UseInMemoryDatabase(_databaseName, _databaseRoot);
        });
        builder.Services.AddSingleton(_ => new AuthProto.AuthService.AuthServiceClient(authInvoker));
        builder.Services.AddSingleton(_ => new ProjectProto.ProjectService.ProjectServiceClient(projectInvoker));
        builder.Services.AddScoped<SubjectManager>();

        _app = builder.Build();
        _app.MapGrpcService<SubjectGrpcService>();

        await _app.StartAsync();

        var server = _app.Services.GetRequiredService<IServer>();
        var address = server.Features
            .Get<IServerAddressesFeature>()?
            .Addresses
            .Single(uri => uri.StartsWith("http://127.0.0.1:", StringComparison.Ordinal));

        _baseAddress = new Uri(address ?? throw new InvalidOperationException("test host address not available"));
        _channel = GrpcChannel.ForAddress(_baseAddress);
    }
}
