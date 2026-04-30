using System.Diagnostics;
using System.Diagnostics.Metrics;
using Grpc.Core;

namespace SubjectServiceDotnet.Observability;

public sealed class SubjectMetrics
{
    public const string MeterName = "SubjectService";

    private readonly Meter _meter;
    private readonly Counter<long> _grpcRequests;
    private readonly Histogram<double> _grpcRequestDuration;
    private readonly UpDownCounter<long> _grpcActiveRequests;

    public SubjectMetrics()
    {
        _meter = new Meter(MeterName);

        _grpcRequests = _meter.CreateCounter<long>(
            "subject_grpc_requests_total",
            description: "Total number of subject-service gRPC requests.");
        _grpcRequestDuration = _meter.CreateHistogram<double>(
            "subject_grpc_request_duration_seconds",
            unit: "s",
            description: "Duration of subject-service gRPC requests.");
        _grpcActiveRequests = _meter.CreateUpDownCounter<long>(
            "subject_grpc_active_requests",
            description: "Current number of in-flight subject-service gRPC requests.");
    }

    public async Task<T> RecordGrpcCallAsync<T>(string method, Func<Task<T>> action)
    {
        _grpcActiveRequests.Add(1, MethodTag(method));
        var startedAt = Stopwatch.GetTimestamp();
        var statusCode = StatusCode.OK;

        try
        {
            return await action();
        }
        catch (RpcException ex)
        {
            statusCode = ex.StatusCode;
            throw;
        }
        catch
        {
            statusCode = StatusCode.Unknown;
            throw;
        }
        finally
        {
            var tags = Tags(method, statusCode);
            _grpcActiveRequests.Add(-1, MethodTag(method));
            _grpcRequests.Add(1, tags);
            _grpcRequestDuration.Record(Stopwatch.GetElapsedTime(startedAt).TotalSeconds, tags);
        }
    }

    private static KeyValuePair<string, object?> MethodTag(string method)
    {
        return new("rpc.method", method);
    }

    private static KeyValuePair<string, object?>[] Tags(string method, StatusCode statusCode)
    {
        return
        [
            new("rpc.system", "grpc"),
            new("rpc.service", "Subject.SubjectService"),
            new("rpc.method", method),
            new("rpc.grpc.status_code", statusCode.ToString())
        ];
    }
}
