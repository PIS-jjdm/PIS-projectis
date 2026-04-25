using Grpc.Core;
using SubjectServiceDotnet.Application;
using SubjectServiceDotnet.Observability;
using CommonProto = Common;
using SubjectProto = Subject;

namespace SubjectServiceDotnet.Grpc;

public sealed class SubjectGrpcService(
    SubjectManager subjectManager,
    SubjectMetrics metrics)
    : SubjectProto.SubjectService.SubjectServiceBase
{
    private readonly SubjectManager _subjectManager = subjectManager;
    private readonly SubjectMetrics _metrics = metrics;

    public override async Task<SubjectProto.ListSubjectsResponse> ListSubjects(
        SubjectProto.ListSubjectsRequest request,
        ServerCallContext context)
    {
        return await _metrics.RecordGrpcCallAsync(nameof(ListSubjects), async () =>
        {
            var response = new SubjectProto.ListSubjectsResponse();
            response.Subjects.AddRange(
                await _subjectManager.ListSubjectsAsync(context.CancellationToken));
            return response;
        });
    }

    public override Task<SubjectProto.Subject> GetSubject(
        SubjectProto.GetSubjectRequest request,
        ServerCallContext context)
    {
        return _metrics.RecordGrpcCallAsync(
            nameof(GetSubject),
            () => _subjectManager.GetSubjectAsync(request.SubjectId, context.CancellationToken));
    }

    public override Task<SubjectProto.Subject> CreateSubject(
        SubjectProto.CreateSubjectRequest request,
        ServerCallContext context)
    {
        return _metrics.RecordGrpcCallAsync(
            nameof(CreateSubject),
            () => _subjectManager.CreateSubjectAsync(request, context.CancellationToken));
    }

    public override Task<SubjectProto.Subject> UpdateSubject(
        SubjectProto.UpdateSubjectRequest request,
        ServerCallContext context)
    {
        return _metrics.RecordGrpcCallAsync(
            nameof(UpdateSubject),
            () => _subjectManager.UpdateSubjectAsync(request, context.CancellationToken));
    }

    public override Task<CommonProto.Ack> DeleteSubject(
        SubjectProto.DeleteSubjectRequest request,
        ServerCallContext context)
    {
        return _metrics.RecordGrpcCallAsync(
            nameof(DeleteSubject),
            () => _subjectManager.DeleteSubjectAsync(request, context.CancellationToken));
    }

    public override Task<CommonProto.Ack> RegisterUserToSubject(
        SubjectProto.UserSubjectRequest request,
        ServerCallContext context)
    {
        return _metrics.RecordGrpcCallAsync(
            nameof(RegisterUserToSubject),
            () => _subjectManager.RegisterUserToSubjectAsync(request, context.CancellationToken));
    }

    public override Task<CommonProto.Ack> RemoveUserFromSubject(
        SubjectProto.UserSubjectRequest request,
        ServerCallContext context)
    {
        return _metrics.RecordGrpcCallAsync(
            nameof(RemoveUserFromSubject),
            () => _subjectManager.RemoveUserFromSubjectAsync(request, context.CancellationToken));
    }

    public override Task<SubjectProto.Subject> AssignTeacherToSubject(
        SubjectProto.TeacherSubjectRequest request,
        ServerCallContext context)
    {
        return _metrics.RecordGrpcCallAsync(
            nameof(AssignTeacherToSubject),
            () => _subjectManager.AssignTeacherToSubjectAsync(request, context.CancellationToken));
    }

    public override Task<SubjectProto.Subject> RemoveTeacherFromSubject(
        SubjectProto.TeacherSubjectRequest request,
        ServerCallContext context)
    {
        return _metrics.RecordGrpcCallAsync(
            nameof(RemoveTeacherFromSubject),
            () => _subjectManager.RemoveTeacherFromSubjectAsync(request, context.CancellationToken));
    }
}
