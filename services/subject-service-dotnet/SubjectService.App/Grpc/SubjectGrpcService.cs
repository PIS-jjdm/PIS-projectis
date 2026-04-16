using Grpc.Core;
using SubjectServiceDotnet.Application;
using CommonProto = Common;
using SubjectProto = Subject;

namespace SubjectServiceDotnet.Grpc;

public sealed class SubjectGrpcService(SubjectManager subjectManager)
    : SubjectProto.SubjectService.SubjectServiceBase
{
    private readonly SubjectManager _subjectManager = subjectManager;

    public override async Task<SubjectProto.ListSubjectsResponse> ListSubjects(
        SubjectProto.ListSubjectsRequest request,
        ServerCallContext context)
    {
        var response = new SubjectProto.ListSubjectsResponse();
        response.Subjects.AddRange(
            await _subjectManager.ListSubjectsAsync(context.CancellationToken));
        return response;
    }

    public override Task<SubjectProto.Subject> GetSubject(
        SubjectProto.GetSubjectRequest request,
        ServerCallContext context)
    {
        return _subjectManager.GetSubjectAsync(request.SubjectId, context.CancellationToken);
    }

    public override Task<SubjectProto.Subject> CreateSubject(
        SubjectProto.CreateSubjectRequest request,
        ServerCallContext context)
    {
        return _subjectManager.CreateSubjectAsync(request, context.CancellationToken);
    }

    public override Task<SubjectProto.Subject> UpdateSubject(
        SubjectProto.UpdateSubjectRequest request,
        ServerCallContext context)
    {
        return _subjectManager.UpdateSubjectAsync(request, context.CancellationToken);
    }

    public override Task<CommonProto.Ack> DeleteSubject(
        SubjectProto.DeleteSubjectRequest request,
        ServerCallContext context)
    {
        return _subjectManager.DeleteSubjectAsync(request, context.CancellationToken);
    }

    public override Task<CommonProto.Ack> RegisterUserToSubject(
        SubjectProto.UserSubjectRequest request,
        ServerCallContext context)
    {
        return _subjectManager.RegisterUserToSubjectAsync(request, context.CancellationToken);
    }

    public override Task<CommonProto.Ack> RemoveUserFromSubject(
        SubjectProto.UserSubjectRequest request,
        ServerCallContext context)
    {
        return _subjectManager.RemoveUserFromSubjectAsync(request, context.CancellationToken);
    }

    public override Task<SubjectProto.Subject> AssignTeacherToSubject(
        SubjectProto.TeacherSubjectRequest request,
        ServerCallContext context)
    {
        return _subjectManager.AssignTeacherToSubjectAsync(request, context.CancellationToken);
    }

    public override Task<SubjectProto.Subject> RemoveTeacherFromSubject(
        SubjectProto.TeacherSubjectRequest request,
        ServerCallContext context)
    {
        return _subjectManager.RemoveTeacherFromSubjectAsync(request, context.CancellationToken);
    }
}
