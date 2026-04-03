import * as grpcWeb from 'grpc-web'

import './grpc/generated/common_pb.js'
import './grpc/generated/auth_pb.js'
import './grpc/generated/subject_pb.js'
import './grpc/generated/project_pb.js'
import './grpc/generated/notification_pb.js'
import './grpc/generated/gateway_pb.js'

const GRPC_BASE_URL = (import.meta.env.VITE_GRPC_BASE_URL || '/grpc').replace(/\/$/, '')
const proto = globalThis.proto
const authPb = proto.auth
const commonPb = proto.common
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
  listProjects: unaryDescriptor(
    '/gateway.FrontendGateway/ListProjects',
    commonPb.Empty,
    projectPb.ListProjectsResponse,
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
    gatewayPb.RegisterTeamGatewayRequest,
    projectPb.Team,
  ),
  listTeamsByProject: unaryDescriptor(
    '/gateway.FrontendGateway/ListTeamsByProject',
    projectPb.ListTeamsByProjectRequest,
    projectPb.ListTeamsByProjectResponse,
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

  listProjects(accessToken) {
    return client.unary(methods.listProjects, new commonPb.Empty(), accessToken)
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

  registerTeam(accessToken, projectId) {
    const request = new gatewayPb.RegisterTeamGatewayRequest()
    request.setProjectId(projectId || '')
    return client.unary(methods.registerTeam, request, accessToken)
  },

  listTeamsByProject(accessToken, projectId) {
    const request = new projectPb.ListTeamsByProjectRequest()
    request.setProjectId(projectId || '')
    return client.unary(methods.listTeamsByProject, request, accessToken)
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
