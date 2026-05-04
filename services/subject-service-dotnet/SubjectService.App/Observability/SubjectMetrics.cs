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
            "grpc_requests_total",
            description: "Total number of gRPC requests.");
        _grpcRequestDuration = _meter.CreateHistogram<double>(
            "grpc_request_duration_seconds",
            unit: "s",
            description: "Duration of gRPC requests.");
        _grpcActiveRequests = _meter.CreateUpDownCounter<long>(
            "grpc_active_requests",
            description: "Current number of in-flight gRPC requests.");
    }

    public async Task<T> RecordGrpcCallAsync<T>(string method, Func<Task<T>> action)
    {
        _grpcActiveRequests.Add(1, ActiveRequestTags(method));
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
            _grpcActiveRequests.Add(-1, ActiveRequestTags(method));
            _grpcRequests.Add(1, tags);
            _grpcRequestDuration.Record(Stopwatch.GetElapsedTime(startedAt).TotalSeconds, tags);
        }
    }

    private static KeyValuePair<string, object?>[] ActiveRequestTags(string method)
    {
        return
        [
            new("rpc.system", "grpc"),
            new("rpc.service", "subject-service"),
            new("rpc.method", method)
        ];
    }

    private static KeyValuePair<string, object?>[] Tags(string method, StatusCode statusCode)
    {
        return
        [
            new("rpc.system", "grpc"),
            new("rpc.service", "subject-service"),
            new("rpc.method", method),
            new("rpc.grpc.status_code", ((int)statusCode).ToString())
        ];
    }
}
