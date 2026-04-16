using Grpc.Core;

namespace SubjectServiceDotnet.Tests;

internal sealed class FakeUnaryCallInvoker : CallInvoker
{
    private readonly Dictionary<string, Func<object, object>> _handlers = new();

    public void AddUnaryHandler<TRequest, TResponse>(
        string fullMethodName,
        Func<TRequest, TResponse> handler)
        where TRequest : class
        where TResponse : class
    {
        _handlers[fullMethodName] = request => handler((TRequest)request);
    }

    public override AsyncUnaryCall<TResponse> AsyncUnaryCall<TRequest, TResponse>(
        Method<TRequest, TResponse> method,
        string? host,
        CallOptions options,
        TRequest request)
    {
        if (!_handlers.TryGetValue(method.FullName, out var handler))
        {
            return CreateAsyncUnaryCall(Task.FromException<TResponse>(
                new InvalidOperationException($"No unary handler registered for {method.FullName}")));
        }

        try
        {
            var response = (TResponse)handler(request!);
            return CreateAsyncUnaryCall(Task.FromResult(response));
        }
        catch (Exception ex)
        {
            return CreateAsyncUnaryCall(Task.FromException<TResponse>(ex));
        }
    }

    public override TResponse BlockingUnaryCall<TRequest, TResponse>(
        Method<TRequest, TResponse> method,
        string? host,
        CallOptions options,
        TRequest request)
    {
        throw new NotSupportedException();
    }

    public override AsyncServerStreamingCall<TResponse> AsyncServerStreamingCall<TRequest, TResponse>(
        Method<TRequest, TResponse> method,
        string? host,
        CallOptions options,
        TRequest request)
    {
        throw new NotSupportedException();
    }

    public override AsyncClientStreamingCall<TRequest, TResponse> AsyncClientStreamingCall<TRequest, TResponse>(
        Method<TRequest, TResponse> method,
        string? host,
        CallOptions options)
    {
        throw new NotSupportedException();
    }

    public override AsyncDuplexStreamingCall<TRequest, TResponse> AsyncDuplexStreamingCall<TRequest, TResponse>(
        Method<TRequest, TResponse> method,
        string? host,
        CallOptions options)
    {
        throw new NotSupportedException();
    }

    private static AsyncUnaryCall<TResponse> CreateAsyncUnaryCall<TResponse>(Task<TResponse> responseTask)
    {
        return new AsyncUnaryCall<TResponse>(
            responseTask,
            Task.FromResult(new Metadata()),
            () => Status.DefaultSuccess,
            () => new Metadata(),
            () => { });
    }
}
