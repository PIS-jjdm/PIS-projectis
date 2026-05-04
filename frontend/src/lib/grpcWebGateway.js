import * as grpcWeb from 'grpc-web'

import './grpc/generated/common_pb.js'
import './grpc/generated/auth_pb.js'
import './grpc/generated/subject_pb.js'
import './grpc/generated/project_pb.js'
import './grpc/generated/notification_pb.js'
import './grpc/generated/eval_pb.js'
import './grpc/generated/gateway_pb.js'

const GRPC_BASE_URL = (import.meta.env.VITE_GRPC_BASE_URL || '/grpc').replace(/\/$/, '')
const proto = globalThis.proto
const authPb = proto.auth
const commonPb = proto.common
const evalPb = proto.eval
const gatewayPb = proto.gateway
const notificationPb = proto.notification
const projectPb = proto.project
const subjectPb = proto.subject
const timestampPb = proto.google?.protobuf

function metadata(accessToken) {
  if (!accessToken) return {}
  return { authorization: `Bearer ${accessToken}` }
}

function serialize(message) {
  return message.serializeBinary()
}

function unaryDescriptor(path, RequestType, ResponseType) {
  return new grpcWeb.MethodDescriptor(
    path,
    grpcWeb.MethodType.UNARY,
    RequestType,
    ResponseType,
    serialize,
    ResponseType.deserializeBinary,
  )
}

function streamDescriptor(path, RequestType, ResponseType) {
  return new grpcWeb.MethodDescriptor(
    path,
    grpcWeb.MethodType.SERVER_STREAMING,
    RequestType,
    ResponseType,
    serialize,
    ResponseType.deserializeBinary,
  )
}

function parseRole(role) {
  switch (String(role || '').toLowerCase()) {
    case 'student':
      return commonPb.UserRole.USER_ROLE_STUDENT
    case 'teacher':
      return commonPb.UserRole.USER_ROLE_TEACHER
    case 'admin':
      return commonPb.UserRole.USER_ROLE_ADMIN
    default:
      return commonPb.UserRole.USER_ROLE_UNSPECIFIED
  }
}

function toTimestamp(value) {
  if (!value) return undefined
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime()) || !timestampPb?.Timestamp) {
    return undefined
  }

  const timestamp = new timestampPb.Timestamp()
  timestamp.fromDate(date)
  return timestamp
}

class FrontendGatewayClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl
    this.client = new grpcWeb.GrpcWebClientBase({ format: 'text' })
  }

  unary(method, request, accessToken = '') {
    return this.client.unaryCall(
      `${this.baseUrl}${method.getName()}`,
      request,
      metadata(accessToken),
      method,
    )
  }

  stream(method, request, accessToken = '') {
    return this.client.serverStreaming(
      `${this.baseUrl}${method.getName()}`,
      request,
      metadata(accessToken),
      method,
    )
  }
}

const methods = {
  register: unaryDescriptor(
    '/gateway.FrontendGateway/Register',
    authPb.RegisterRequest,
    authPb.AuthResponse,
  ),
  createUser: unaryDescriptor(
    '/gateway.FrontendGateway/CreateUser',
    authPb.CreateUserRequest,
    authPb.User,
  ),
  updateUser: unaryDescriptor(
    '/gateway.FrontendGateway/UpdateUser',
    authPb.UpdateUserRequest,
    authPb.User,
  ),
  setUserAvatar: unaryDescriptor(
    '/gateway.FrontendGateway/SetUserAvatar',
    authPb.SetUserAvatarRequest,
    commonPb.Ack,
  ),
  login: unaryDescriptor(
    '/gateway.FrontendGateway/Login',
    authPb.LoginRequest,
    authPb.AuthResponse,
  ),
  getMe: unaryDescriptor(
    '/gateway.FrontendGateway/GetMe',
    commonPb.Empty,
    authPb.User,
  ),
  getUser: unaryDescriptor(
    '/gateway.FrontendGateway/GetUser',
    authPb.GetUserRequest,
    authPb.User,
  ),
  listUsers: unaryDescriptor(
    '/gateway.FrontendGateway/ListUsers',
    commonPb.Empty,
    authPb.ListUsersResponse,
  ),
  changePassword: unaryDescriptor(
    '/gateway.FrontendGateway/ChangePassword',
    gatewayPb.ChangePasswordGatewayRequest,
    commonPb.Ack,
  ),
  logout: unaryDescriptor(
    '/gateway.FrontendGateway/Logout',
    commonPb.Empty,
    commonPb.Ack,
  ),
  listSubjects: unaryDescriptor(
    '/gateway.FrontendGateway/ListSubjects',
    commonPb.Empty,
    subjectPb.ListSubjectsResponse,
  ),
  getSubject: unaryDescriptor(
    '/gateway.FrontendGateway/GetSubject',
    subjectPb.GetSubjectRequest,
    subjectPb.Subject,
  ),
  createSubject: unaryDescriptor(
    '/gateway.FrontendGateway/CreateSubject',
    subjectPb.CreateSubjectRequest,
    subjectPb.Subject,
  ),
  updateSubject: unaryDescriptor(
    '/gateway.FrontendGateway/UpdateSubject',
    subjectPb.UpdateSubjectRequest,
    subjectPb.Subject,
  ),
  deleteSubject: unaryDescriptor(
    '/gateway.FrontendGateway/DeleteSubject',
    subjectPb.DeleteSubjectRequest,
    commonPb.Ack,
  ),
  registerSubject: unaryDescriptor(
    '/gateway.FrontendGateway/RegisterSubject',
    gatewayPb.RegisterSubjectGatewayRequest,
    commonPb.Ack,
  ),
  leaveSubject: unaryDescriptor(
    '/gateway.FrontendGateway/LeaveSubject',
    gatewayPb.LeaveSubjectGatewayRequest,
    commonPb.Ack,
  ),
  addStudentToSubject: unaryDescriptor(
    '/gateway.FrontendGateway/AddStudentToSubject',
    subjectPb.UserSubjectRequest,
    commonPb.Ack,
  ),
  removeStudentFromSubject: unaryDescriptor(
    '/gateway.FrontendGateway/RemoveStudentFromSubject',
    subjectPb.UserSubjectRequest,
    commonPb.Ack,
  ),
  assignTeacherToSubject: unaryDescriptor(
    '/gateway.FrontendGateway/AssignTeacherToSubject',
    subjectPb.TeacherSubjectRequest,
    subjectPb.Subject,
  ),
  removeTeacherFromSubject: unaryDescriptor(
    '/gateway.FrontendGateway/RemoveTeacherFromSubject',
    subjectPb.TeacherSubjectRequest,
    subjectPb.Subject,
  ),
  listProjects: unaryDescriptor(
    '/gateway.FrontendGateway/ListProjects',
    projectPb.ListProjectsRequest,
    projectPb.ListProjectsResponse,
  ),
  listProjectsWithTeams: unaryDescriptor(
    '/gateway.FrontendGateway/ListProjectsWithTeams',
    gatewayPb.ListProjectsWithTeamsGatewayRequest,
    gatewayPb.ListProjectsWithTeamsGatewayResponse,
  ),
  createProject: unaryDescriptor(
    '/gateway.FrontendGateway/CreateProject',
    gatewayPb.CreateProjectGatewayRequest,
    projectPb.Project,
  ),
  getProject: unaryDescriptor(
    '/gateway.FrontendGateway/GetProject',
    projectPb.GetProjectRequest,
    projectPb.Project,
  ),
  registerTeam: unaryDescriptor(
    '/gateway.FrontendGateway/RegisterTeam',
    projectPb.RegisterTeamRequest,
    projectPb.Team,
  ),
  leaveTeam: unaryDescriptor(
    '/gateway.FrontendGateway/LeaveTeam',
    projectPb.LeaveTeamRequest,
    commonPb.Ack,
  ),
  listTeamsByProject: unaryDescriptor(
    '/gateway.FrontendGateway/ListTeamsByProject',
    projectPb.ListTeamsByProjectRequest,
    gatewayPb.ListTeamsByProjectGatewayResponse,
  ),
  listProjectTeamDetails: unaryDescriptor(
    '/gateway.FrontendGateway/ListProjectTeamDetails',
    gatewayPb.ListProjectTeamDetailsGatewayRequest,
    gatewayPb.ListProjectTeamDetailsGatewayResponse,
  ),
  getTeam: unaryDescriptor(
    '/gateway.FrontendGateway/GetTeam',
    projectPb.GetTeamRequest,
    projectPb.TeamDetail,
  ),
  downloadSubmission: streamDescriptor(
    '/gateway.FrontendGateway/DownloadSubmission',
    projectPb.DownloadSubmissionRequest,
    projectPb.FileChunk,
  ),
  submitProject: unaryDescriptor(
    '/gateway.FrontendGateway/SubmitProject',
    projectPb.SubmitProjectRequest,
    projectPb.ProjectSubmission,
  ),
  listProjectEvaluations: unaryDescriptor(
    '/gateway.FrontendGateway/ListProjectEvaluations',
    evalPb.ListProjectEvaluationsRequest,
    evalPb.ListProjectEvaluationsResponse,
  ),
  createProjectEvaluation: unaryDescriptor(
    '/gateway.FrontendGateway/CreateProjectEvaluation',
    evalPb.CreateProjectEvaluationRequest,
    evalPb.ProjectEvaluation,
  ),
  updateProjectEvaluation: unaryDescriptor(
    '/gateway.FrontendGateway/UpdateProjectEvaluation',
    evalPb.UpdateProjectEvaluationRequest,
    evalPb.ProjectEvaluation,
  ),
  addTeamMember: unaryDescriptor(
    '/gateway.FrontendGateway/AddTeamMember',
    projectPb.AddTeamMemberRequest,
    projectPb.Team,
  ),
  removeTeamMember: unaryDescriptor(
    '/gateway.FrontendGateway/RemoveTeamMember',
    projectPb.RemoveTeamMemberRequest,
    projectPb.Team,
  ),
  listNotifications: unaryDescriptor(
    '/gateway.FrontendGateway/ListNotifications',
    commonPb.Empty,
    gatewayPb.ListNotificationsGatewayResponse,
  ),
  listScheduledNotifications: unaryDescriptor(
    '/gateway.FrontendGateway/ListScheduledNotifications',
    commonPb.Empty,
    notificationPb.ListScheduledNotificationsResponse,
  ),
  createNotification: unaryDescriptor(
    '/gateway.FrontendGateway/CreateNotification',
    gatewayPb.CreateNotificationGatewayRequest,
    gatewayPb.CreateNotificationGatewayResponse,
  ),
  markNotificationRead: unaryDescriptor(
    '/gateway.FrontendGateway/MarkNotificationRead',
    notificationPb.MarkAsReadRequest,
    commonPb.Ack,
  ),
  cancelScheduledNotification: unaryDescriptor(
    '/gateway.FrontendGateway/CancelScheduledNotification',
    gatewayPb.CancelScheduledNotificationGatewayRequest,
    commonPb.Ack,
  ),
  rescheduleScheduledNotification: unaryDescriptor(
    '/gateway.FrontendGateway/RescheduleScheduledNotification',
    gatewayPb.RescheduleScheduledNotificationGatewayRequest,
    commonPb.Ack,
  ),
  streamNotifications: streamDescriptor(
    '/gateway.FrontendGateway/StreamNotifications',
    commonPb.Empty,
    gatewayPb.NotificationWithSender,
  ),
}

const client = new FrontendGatewayClient(GRPC_BASE_URL)

export const gatewayClient = {
  register(payload) {
    const request = new authPb.RegisterRequest()
    request.setFirstname(payload.firstname || '')
    request.setLastname(payload.lastname || '')
    request.setEmail(payload.email || '')
    request.setPassword(payload.password || '')
    request.setRole(parseRole(payload.role))
    return client.unary(methods.register, request)
  },

  createUser(accessToken, payload) {
    const request = new authPb.CreateUserRequest()
    request.setFirstname(payload.firstname || '')
    request.setLastname(payload.lastname || '')
    request.setEmail(payload.email || '')
    request.setPassword(payload.password || '')
    request.setRole(parseRole(payload.role))
    return client.unary(methods.createUser, request, accessToken)
  },

  updateUser(accessToken, payload) {
    const request = new authPb.UpdateUserRequest()
    request.setUserId(payload.user_id || '')
    request.setFirstname(payload.firstname || '')
    request.setLastname(payload.lastname || '')
    request.setEmail(payload.email || '')
    request.setRole(parseRole(payload.role))
    return client.unary(methods.updateUser, request, accessToken)
  },

  setUserAvatar(accessToken, payload) {
    const request = new authPb.SetUserAvatarRequest()
    request.setUserId(payload.user_id || '')
    request.setImageData(payload.image_data || new Uint8Array())
    return client.unary(methods.setUserAvatar, request, accessToken)
  },

  login(credentials) {
    const request = new authPb.LoginRequest()
    request.setEmail(credentials.email || '')
    request.setPassword(credentials.password || '')
    return client.unary(methods.login, request)
  },

  getMe(accessToken) {
    return client.unary(methods.getMe, new commonPb.Empty(), accessToken)
  },

  getUser(accessToken, userId) {
    const request = new authPb.GetUserRequest()
    request.setUserId(userId || '')
    return client.unary(methods.getUser, request, accessToken)
  },

  listUsers(accessToken) {
    return client.unary(methods.listUsers, new commonPb.Empty(), accessToken)
  },

  changePassword(accessToken, payload) {
    const request = new gatewayPb.ChangePasswordGatewayRequest()
    request.setCurrentPassword(payload.current_password || '')
    request.setNewPassword(payload.new_password || '')
    return client.unary(methods.changePassword, request, accessToken)
  },

  logout(accessToken) {
    return client.unary(methods.logout, new commonPb.Empty(), accessToken)
  },

  listSubjects(accessToken) {
    return client.unary(methods.listSubjects, new commonPb.Empty(), accessToken)
  },

  getSubject(accessToken, subjectId) {
    const request = new subjectPb.GetSubjectRequest()
    request.setSubjectId(subjectId || '')
    return client.unary(methods.getSubject, request, accessToken)
  },

  createSubject(accessToken, payload) {
    const request = new subjectPb.CreateSubjectRequest()
    request.setName(payload.name || '')
    request.setDescription(payload.description || '')
    request.setAbbreviation(payload.abbreviation || '')
    return client.unary(methods.createSubject, request, accessToken)
  },

  updateSubject(accessToken, subjectId, payload) {
    const request = new subjectPb.UpdateSubjectRequest()
    request.setSubjectId(subjectId || '')
    request.setName(payload.name || '')
    request.setDescription(payload.description || '')
    request.setAbbreviation(payload.abbreviation || '')
    return client.unary(methods.updateSubject, request, accessToken)
  },

  deleteSubject(accessToken, subjectId) {
    const request = new subjectPb.DeleteSubjectRequest()
    request.setSubjectId(subjectId || '')
    return client.unary(methods.deleteSubject, request, accessToken)
  },

  registerSubject(accessToken, subjectId) {
    const request = new gatewayPb.RegisterSubjectGatewayRequest()
    request.setSubjectId(subjectId || '')
    return client.unary(methods.registerSubject, request, accessToken)
  },

  leaveSubject(accessToken, subjectId) {
    const request = new gatewayPb.LeaveSubjectGatewayRequest()
    request.setSubjectId(subjectId || '')
    return client.unary(methods.leaveSubject, request, accessToken)
  },

  addStudentToSubject(accessToken, subjectId, userId) {
    const request = new subjectPb.UserSubjectRequest()
    request.setSubjectId(subjectId || '')
    request.setUserId(userId || '')
    return client.unary(methods.addStudentToSubject, request, accessToken)
  },

  removeStudentFromSubject(accessToken, subjectId, userId) {
    const request = new subjectPb.UserSubjectRequest()
    request.setSubjectId(subjectId || '')
    request.setUserId(userId || '')
    return client.unary(methods.removeStudentFromSubject, request, accessToken)
  },

  assignTeacherToSubject(accessToken, subjectId, teacherUserId) {
    const request = new subjectPb.TeacherSubjectRequest()
    request.setSubjectId(subjectId || '')
    request.setTeacherUserId(teacherUserId || '')
    return client.unary(methods.assignTeacherToSubject, request, accessToken)
  },

  removeTeacherFromSubject(accessToken, subjectId, teacherUserId) {
    const request = new subjectPb.TeacherSubjectRequest()
    request.setSubjectId(subjectId || '')
    request.setTeacherUserId(teacherUserId || '')
    return client.unary(methods.removeTeacherFromSubject, request, accessToken)
  },

  listProjectsWithTeams(accessToken, subjectId) {
    const request = new gatewayPb.ListProjectsWithTeamsGatewayRequest()
    request.setSubjectId(subjectId || '')
    return client.unary(methods.listProjectsWithTeams, request, accessToken)
  },

  listProjects(accessToken, subjectId) {
    const request = new projectPb.ListProjectsRequest()
    request.setSubjectId(subjectId || '')
    return client.unary(methods.listProjects, request, accessToken)
  },

  createProject(accessToken, payload) {
    const request = new gatewayPb.CreateProjectGatewayRequest()
    request.setTitle(payload.title || '')
    request.setDescription(payload.description || '')
    request.setMaxStudentsPerTeam(Number(payload.max_students_per_team) || 0)
    request.setSubjectId(payload.subject_id || '')

    const startDate = toTimestamp(payload.start_date)
    if (startDate) request.setStartDate(startDate)

    const endDate = toTimestamp(payload.end_date)
    if (endDate) request.setEndDate(endDate)

    return client.unary(methods.createProject, request, accessToken)
  },

  getProject(accessToken, projectId) {
    const request = new projectPb.GetProjectRequest()
    request.setProjectId(projectId || '')
    return client.unary(methods.getProject, request, accessToken)
  },

  registerTeam(accessToken, projectId, teamName) {
    const request = new projectPb.RegisterTeamRequest()
    request.setProjectId(projectId || '')
    request.setTeamName(teamName || '')
    return client.unary(methods.registerTeam, request, accessToken)
  },

  leaveTeam(accessToken, teamId) {
    const request = new projectPb.LeaveTeamRequest()
    request.setTeamId(teamId || '')
    return client.unary(methods.leaveTeam, request, accessToken)
  },

  listTeamsByProject(accessToken, projectId) {
    const request = new projectPb.ListTeamsByProjectRequest()
    request.setProjectId(projectId || '')
    return client.unary(methods.listTeamsByProject, request, accessToken)
  },

  listProjectTeamDetails(accessToken, projectId) {
    const request = new gatewayPb.ListProjectTeamDetailsGatewayRequest()
    request.setProjectId(projectId || '')
    return client.unary(methods.listProjectTeamDetails, request, accessToken)
  },

  getTeam(accessToken, teamId) {
    const request = new projectPb.GetTeamRequest()
    request.setTeamId(teamId || '')
    return client.unary(methods.getTeam, request, accessToken)
  },

  submitProject(accessToken, { teamId, fileName, contentType, fileSize, fileData }) {
    const request = new projectPb.SubmitProjectRequest()
    request.setTeamId(teamId || '')
    request.setFileName(fileName || '')
    request.setContentType(contentType || 'application/octet-stream')
    request.setFileSize(fileSize || 0)
    request.setFileData(fileData || new Uint8Array())
    return client.unary(methods.submitProject, request, accessToken)
  },

  listProjectEvaluations(accessToken, { projectId, studentId, evaluatorTeacherId } = {}) {
    const request = new evalPb.ListProjectEvaluationsRequest()
    if (projectId) request.setProjectId(projectId)
    if (studentId) request.setStudentId(studentId)
    if (evaluatorTeacherId) request.setEvaluatorTeacherId(evaluatorTeacherId)
    return client.unary(methods.listProjectEvaluations, request, accessToken)
  },

  downloadSubmission(accessToken, teamId) {
    return new Promise((resolve, reject) => {
      const request = new projectPb.DownloadSubmissionRequest()
      request.setTeamId(teamId || '')
      const stream = client.stream(methods.downloadSubmission, request, accessToken)

      const chunks = []
      let fileName = ''
      let contentType = ''

      stream.on('data', (chunk) => {
        const data = chunk.getData()
        if (data && data.length) chunks.push(data)
        if (!fileName) fileName = chunk.getFileName() || ''
        if (!contentType) contentType = chunk.getContentType() || ''
      })
      stream.on('end', () =>
        resolve({
          blob: new Blob(chunks, contentType ? { type: contentType } : undefined),
          fileName,
          contentType,
        }),
      )
      stream.on('error', reject)
    })
  },

  createProjectEvaluation(accessToken, payload) {
    const request = new evalPb.CreateProjectEvaluationRequest()
    request.setSubjectId(payload.subject_id || '')
    request.setProjectId(payload.project_id || '')
    request.setTeamId(payload.team_id || '')
    request.setTotalScore(Number(payload.total_score) || 0)
    request.setFeedback(payload.feedback || '')
    return client.unary(methods.createProjectEvaluation, request, accessToken)
  },

  updateProjectEvaluation(accessToken, payload) {
    const request = new evalPb.UpdateProjectEvaluationRequest()
    request.setEvaluationId(payload.evaluation_id || '')
    if (payload.total_score !== undefined && payload.total_score !== null) {
      request.setTotalScore(Number(payload.total_score) || 0)
    }
    if (payload.feedback !== undefined && payload.feedback !== null) {
      request.setFeedback(payload.feedback)
    }
    return client.unary(methods.updateProjectEvaluation, request, accessToken)
  },

  addTeamMember(accessToken, teamId, studentId) {
    const request = new projectPb.AddTeamMemberRequest()
    request.setTeamId(teamId || '')
    request.setStudentId(studentId || '')
    return client.unary(methods.addTeamMember, request, accessToken)
  },

  removeTeamMember(accessToken, teamId, studentId) {
    const request = new projectPb.RemoveTeamMemberRequest()
    request.setTeamId(teamId || '')
    request.setStudentId(studentId || '')
    return client.unary(methods.removeTeamMember, request, accessToken)
  },

  listNotifications(accessToken) {
    return client.unary(methods.listNotifications, new commonPb.Empty(), accessToken)
  },

  listScheduledNotifications(accessToken) {
    return client.unary(methods.listScheduledNotifications, new commonPb.Empty(), accessToken)
  },

  createNotification(accessToken, payload) {
    const request = new gatewayPb.CreateNotificationGatewayRequest()
    request.setUserIdsList(payload.user_ids || [])
    request.setMessage(payload.message || '')
    const triggerAt = toTimestamp(payload.trigger_at)
    if (triggerAt) request.setTriggerAt(triggerAt)
    return client.unary(methods.createNotification, request, accessToken)
  },

  markNotificationRead(accessToken, notificationId) {
    const request = new notificationPb.MarkAsReadRequest()
    request.setNotificationId(notificationId || '')
    return client.unary(methods.markNotificationRead, request, accessToken)
  },

  cancelScheduledNotification(accessToken, batchId) {
    const request = new gatewayPb.CancelScheduledNotificationGatewayRequest()
    request.setBatchId(batchId || '')
    return client.unary(methods.cancelScheduledNotification, request, accessToken)
  },

  rescheduleScheduledNotification(accessToken, batchId, triggerAtValue) {
    const request = new gatewayPb.RescheduleScheduledNotificationGatewayRequest()
    request.setBatchId(batchId || '')
    const triggerAt = toTimestamp(triggerAtValue)
    if (triggerAt) request.setTriggerAt(triggerAt)
    return client.unary(methods.rescheduleScheduledNotification, request, accessToken)
  },

  streamNotifications(accessToken, handlers = {}) {
    const stream = client.stream(methods.streamNotifications, new commonPb.Empty(), accessToken)

    stream.on('data', (message) => handlers.onMessage?.(message))
    stream.on('end', () => handlers.onEnd?.())
    stream.on('error', (error) => handlers.onError?.(error))

    return () => stream.cancel()
  },
}
