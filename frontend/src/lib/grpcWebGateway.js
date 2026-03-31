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
    notificationPb.ListNotificationsResponse,
  ),
  createNotification: unaryDescriptor(
    '/gateway.FrontendGateway/CreateNotification',
    notificationPb.CreateNotificationRequest,
    notificationPb.Notification,
  ),
  markNotificationRead: unaryDescriptor(
    '/gateway.FrontendGateway/MarkNotificationRead',
    notificationPb.MarkAsReadRequest,
    commonPb.Ack,
  ),
  streamNotifications: streamDescriptor(
    '/gateway.FrontendGateway/StreamNotifications',
    commonPb.Empty,
    notificationPb.Notification,
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

  login(credentials) {
    const request = new authPb.LoginRequest()
    request.setEmail(credentials.email || '')
    request.setPassword(credentials.password || '')
    return client.unary(methods.login, request)
  },

  getMe(accessToken) {
    return client.unary(methods.getMe, new commonPb.Empty(), accessToken)
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

  createNotification(accessToken, payload) {
    const request = new notificationPb.CreateNotificationRequest()
    request.setUserId(payload.user_id || '')
    request.setMessage(payload.message || '')
    return client.unary(methods.createNotification, request, accessToken)
  },

  markNotificationRead(accessToken, notificationId) {
    const request = new notificationPb.MarkAsReadRequest()
    request.setNotificationId(notificationId || '')
    return client.unary(methods.markNotificationRead, request, accessToken)
  },

  streamNotifications(accessToken, handlers = {}) {
    const stream = client.stream(methods.streamNotifications, new commonPb.Empty(), accessToken)

    stream.on('data', (message) => handlers.onMessage?.(message))
    stream.on('end', () => handlers.onEnd?.())
    stream.on('error', (error) => handlers.onError?.(error))

    return () => stream.cancel()
  },
}
