import { isHybridMode, isMockMode } from './config'
import { gatewayClient } from './grpcWebGateway'
import { mockApi } from './mockApi'

async function tryLive(fn, fallback) {
  if (isMockMode()) {
    return fallback()
  }

  try {
    return await fn()
  } catch (error) {
    if (isHybridMode()) {
      return fallback(error)
    }
    throw error
  }
}

function normalizeAuthResponse(data) {
  return {
    token: data?.getAccessToken?.() || data?.access_token || data?.token || '',
    user: normalizeUser(data?.getUser?.() || data?.user),
  }
}

function accessToken(session) {
  return session?.token || ''
}

function normalizeRole(value) {
  if (typeof value === 'string') {
    return value.toLowerCase().replace('user_role_', '')
  }

  switch (value) {
    case 1:
      return 'student'
    case 2:
      return 'teacher'
    case 3:
      return 'admin'
    default:
      return 'unspecified'
  }
}

function normalizeUser(user) {
  if (!user) return null
  if (typeof user.getId === 'function') {
    return {
      id: user.getId(),
      firstname: user.getFirstname(),
      lastname: user.getLastname(),
      email: user.getEmail(),
      role: normalizeRole(user.getRole()),
    }
  }

  return {
    id: user.id,
    firstname: user.firstname,
    lastname: user.lastname,
    email: user.email,
    role: normalizeRole(user.role),
  }
}

function timestampToIso(timestamp) {
  if (!timestamp) return null
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString()
  }
  return timestamp
}

function normalizeSubject(subject) {
  if (!subject) return null
  if (typeof subject.getId === 'function') {
    return {
      id: subject.getId(),
      name: subject.getName(),
      description: subject.getDescription(),
      abbreviation: subject.getAbbreviation(),
    }
  }
  return subject
}

function normalizeProject(project) {
  if (!project) return null
  if (typeof project.getId === 'function') {
    return {
      id: project.getId(),
      title: project.getTitle(),
      description: project.getDescription(),
      teacher_id: project.getTeacherId(),
      max_students_per_team: project.getMaxStudentsPerTeam(),
      start_date: timestampToIso(project.getStartDate()),
      end_date: timestampToIso(project.getEndDate()),
      subject_id: project.getSubjectId(),
    }
  }
  return project
}

function normalizeTeam(team) {
  if (!team) return null
  if (typeof team.getId === 'function') {
    return {
      id: team.getId(),
      project_id: team.getProjectId(),
      name: team.getName(),
      leader_student_id: team.getLeaderStudentId(),
      student_ids: team.getStudentIdsList(),
    }
  }
  return team
}

function normalizeNotification(notification) {
  if (!notification) return null
  if (typeof notification.getId === 'function') {
    return {
      id: notification.getId(),
      user_id: notification.getUserId(),
      message: notification.getMessage(),
      date: timestampToIso(notification.getDate()),
      read: notification.getRead(),
    }
  }
  return notification
}

async function buildDashboardSummary(session) {
  const [subjectsResult, projectsResult, notificationsResult] = await Promise.allSettled([
    api.listSubjects(session),
    api.listProjects(session),
    api.listNotifications(session, session.user?.id),
  ])

  const subjects = subjectsResult.status === 'fulfilled' ? subjectsResult.value : []
  const projects = projectsResult.status === 'fulfilled' ? projectsResult.value : []
  const notifications =
    notificationsResult.status === 'fulfilled' ? notificationsResult.value : []

  return {
    subjects: subjects.length,
    registeredSubjects: 0,
    projects: projects.length,
    ownProjects: projects.filter((project) => project.teacher_id === session.user?.id).length,
    teams: 0,
    unreadNotifications: notifications.filter((item) => !item.read).length,
  }
}

export const api = {
  async login(credentials) {
    return tryLive(
      async () => normalizeAuthResponse(await gatewayClient.login(credentials)),
      () => mockApi.login(credentials),
    )
  },

  async register(payload) {
    return tryLive(
      async () => normalizeAuthResponse(await gatewayClient.register(payload)),
      () => mockApi.register(payload),
    )
  },

  async getMe(session) {
    return tryLive(
      async () => normalizeUser(await gatewayClient.getMe(accessToken(session))),
      async () => {
        if (session.user?.id) {
          return mockApi.getMe(session)
        }
        return session.user
      },
    )
  },

  async logout(session) {
    return tryLive(
      async () => gatewayClient.logout(accessToken(session)),
      () => mockApi.logout(session),
    )
  },

  async listSubjects(session) {
    return tryLive(
      async () => {
        const response = await gatewayClient.listSubjects(accessToken(session))
        return response.getSubjectsList().map(normalizeSubject)
      },
      () => mockApi.listSubjects(session),
    )
  },

  async createSubject(session, payload) {
    return tryLive(
      async () => normalizeSubject(await gatewayClient.createSubject(accessToken(session), payload)),
      () => mockApi.createSubject(session, payload),
    )
  },

  async updateSubject(session, subjectId, payload) {
    return tryLive(
      async () => normalizeSubject(
        await gatewayClient.updateSubject(accessToken(session), subjectId, payload),
      ),
      () => mockApi.updateSubject(session, subjectId, payload),
    )
  },

  async deleteSubject(session, subjectId) {
    return tryLive(
      async () => gatewayClient.deleteSubject(accessToken(session), subjectId),
      () => mockApi.deleteSubject(session, subjectId),
    )
  },

  async registerSubject(session, subjectId) {
    return tryLive(
      async () => gatewayClient.registerSubject(accessToken(session), subjectId),
      () => mockApi.registerSubject(session, subjectId),
    )
  },

  async listProjects(session) {
    return tryLive(
      async () => {
        const response = await gatewayClient.listProjects(accessToken(session))
        return response.getProjectsList().map(normalizeProject)
      },
      () => mockApi.listProjects(session),
    )
  },

  async getProject(session, projectId) {
    return tryLive(
      async () => normalizeProject(await gatewayClient.getProject(accessToken(session), projectId)),
      () => mockApi.getProject(projectId),
    )
  },

  async createProject(session, payload) {
    return tryLive(
      async () => {
        throw new Error('CreateProject is not available through the gRPC gateway yet')
      },
      () => mockApi.createProject(session, payload),
    )
  },

  async registerTeam(session, projectId) {
    return tryLive(
      async () => normalizeTeam(await gatewayClient.registerTeam(accessToken(session), projectId)),
      () => mockApi.registerTeam(session, projectId),
    )
  },

  async addTeamMember(session, teamId, studentId) {
    return tryLive(
      async () => normalizeTeam(
        await gatewayClient.addTeamMember(accessToken(session), teamId, studentId),
      ),
      () => mockApi.addTeamMember(session, teamId, studentId),
    )
  },

  async listTeamsByProject(session, projectId) {
    return tryLive(
      async () => {
        throw new Error('ListTeamsByProject is not available through the gRPC gateway yet')
      },
      () => mockApi.listTeamsByProject(projectId),
    )
  },

  async listNotifications(session, userId) {
    return tryLive(
      async () => {
        const response = await gatewayClient.listNotifications(accessToken(session))
        return response.getNotificationsList().map(normalizeNotification)
      },
      () => mockApi.listNotifications(session, userId),
    )
  },

  subscribeNotifications(session, handlers = {}) {
    if (isMockMode()) {
      handlers.onError?.(new Error('Notification streaming is unavailable in mock mode'))
      return () => {}
    }

    return gatewayClient.streamNotifications(accessToken(session), {
      onMessage: (message) => handlers.onMessage?.(normalizeNotification(message)),
      onError: handlers.onError,
      onEnd: handlers.onEnd,
    })
  },

  async createNotification(session, payload) {
    return tryLive(
      async () => normalizeNotification(
        await gatewayClient.createNotification(accessToken(session), payload),
      ),
      () => mockApi.createNotification(session, payload),
    )
  },

  async markNotificationRead(session, notificationId) {
    return tryLive(
      async () => gatewayClient.markNotificationRead(accessToken(session), notificationId),
      () => mockApi.markNotificationRead(session, notificationId),
    )
  },

  async listUsers(session) {
    return tryLive(
      async () => {
        throw new Error('ListUsers is not available through the gRPC gateway yet')
      },
      () => mockApi.listUsers(session),
    )
  },

  async getDashboardSummary(session) {
    return tryLive(
      async () => buildDashboardSummary(session),
      () => mockApi.getDashboardSummary(session),
    )
  },
}
