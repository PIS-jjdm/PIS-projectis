import * as grpcWeb from 'grpc-web'
import { isHybridMode, isMockMode } from './config'
import { gatewayClient } from './grpcWebGateway'
import { mockApi } from './mockApi'

let authFailureHandler = null

function unauthenticatedCode(error) {
  if (typeof error?.code === 'number') return error.code
  if (typeof error?.code === 'string' && /^\d+$/.test(error.code)) {
    return Number(error.code)
  }
  return null
}

function isAuthenticationFailure(error) {
  const code = unauthenticatedCode(error)
  return code === grpcWeb.StatusCode.UNAUTHENTICATED || code === 16
}

function handleAuthenticationFailure(error) {
  if (!isAuthenticationFailure(error)) {
    return false
  }

  authFailureHandler?.(error)
  return true
}

async function tryLive(fn, fallback) {
  if (isMockMode()) {
    return fallback()
  }

  try {
    return await fn()
  } catch (error) {
    if (handleAuthenticationFailure(error)) {
      throw error
    }

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
      user_ids: subject.getUserIdsList?.() || [],
      teacher_ids: subject.getTeacherIdsList?.() || [],
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

function uniqueIds(values) {
  return [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))]
}

function normalizeNotification(notification) {
  if (!notification) return null
  const source =
    typeof notification.getNotification === 'function'
      ? notification.getNotification()
      : notification.notification || notification
  const sender =
    typeof notification.getSender === 'function'
      ? normalizeUser(notification.getSender())
      : normalizeUser(notification.sender)

  if (typeof source?.getId === 'function') {
    return {
      id: source.getId(),
      batch_id: source.getBatchId?.() || '',
      user_id: source.getUserId(),
      creator_user_id: source.getCreatorUserId?.() || '',
      message: source.getMessage(),
      date: timestampToIso(source.getDate()),
      trigger_at: timestampToIso(source.getTriggerAt?.()),
      read: source.getRead(),
      sender,
    }
  }
  return {
    ...source,
    sender,
  }
}

function normalizeScheduledNotificationBatch(batch) {
  if (!batch) return null
  if (typeof batch.getBatchId === 'function') {
    return {
      batch_id: batch.getBatchId(),
      message: batch.getMessage(),
      trigger_at: timestampToIso(batch.getTriggerAt()),
      creator_user_id: batch.getCreatorUserId(),
      user_ids: batch.getUserIdsList(),
    }
  }
  return batch
}

async function buildDashboardSummary(session) {
  const [subjectsResult, projectsResult, notificationsResult] = await Promise.allSettled([
    api.listSubjects(session),
    api.listProjects(session),
    api.listNotifications(session),
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
  setAuthFailureHandler(handler) {
    authFailureHandler = typeof handler === 'function' ? handler : null
  },

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

  async createUser(session, payload) {
    return tryLive(
      async () => normalizeUser(await gatewayClient.createUser(accessToken(session), payload)),
      () => mockApi.createUser(session, payload),
    )
  },

  async updateUser(session, payload) {
    return tryLive(
      async () => normalizeUser(await gatewayClient.updateUser(accessToken(session), payload)),
      () => mockApi.updateUser(session, payload),
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

  async getUser(session, userId) {
    return tryLive(
      async () => normalizeUser(await gatewayClient.getUser(accessToken(session), userId)),
      () => mockApi.getUser(session, userId),
    )
  },

  async changePassword(session, payload) {
    return tryLive(
      async () => gatewayClient.changePassword(accessToken(session), payload),
      () => mockApi.changePassword(session, payload),
    )
  },

  async setUserAvatar(session, payload) {
    return tryLive(
      async () => gatewayClient.setUserAvatar(accessToken(session), payload),
      () => mockApi.setUserAvatar(session, payload),
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

  async getSubjectNotificationRecipients(session, subjectId) {
    const subjects = await api.listSubjects(session)
    const subject = subjects.find((item) => item.id === subjectId)
    if (!subject) {
      throw new Error('Subject not found')
    }

    return uniqueIds([...(subject.user_ids || []), ...(subject.teacher_ids || [])])
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

  async getProjectNotificationRecipients(session, projectId) {
    const [project, teams] = await Promise.all([
      api.getProject(session, projectId),
      api.listTeamsByProject(session, projectId),
    ])

    return uniqueIds([
      project?.teacher_id,
      ...teams.flatMap((team) => [team.leader_student_id, ...(team.student_ids || [])]),
    ])
  },

  async getProject(session, projectId) {
    return tryLive(
      async () => normalizeProject(await gatewayClient.getProject(accessToken(session), projectId)),
      () => mockApi.getProject(projectId),
    )
  },

  async createProject(session, payload) {
    return tryLive(
      async () => normalizeProject(await gatewayClient.createProject(accessToken(session), payload)),
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

  async removeTeamMember(session, teamId, studentId) {
    return tryLive(
      async () => normalizeTeam(
        await gatewayClient.removeTeamMember(accessToken(session), teamId, studentId),
      ),
      () => mockApi.removeTeamMember(session, teamId, studentId),
    )
  },

  async listTeamsByProject(session, projectId) {
    return tryLive(
      async () => {
        const response = await gatewayClient.listTeamsByProject(accessToken(session), projectId)
        return response.getTeamsList().map(normalizeTeam)
      },
      () => mockApi.listTeamsByProject(projectId),
    )
  },

  async listParticipantProjects(session) {
    const [projects, subjects, knownUsers] = await Promise.all([
      api.listProjects(session),
      api.listSubjects(session),
      api.listKnownUsers(session),
    ])

    const teamLists = await Promise.all(
      projects.map(async (project) => ({
        projectId: project.id,
        teams: await api.listTeamsByProject(session, project.id),
      })),
    )

    const teamsByProjectId = new Map(teamLists.map((item) => [item.projectId, item.teams]))
    const subjectById = new Map(subjects.map((subject) => [subject.id, subject]))
    const role = String(session?.user?.role || '').trim().toLowerCase()
    const userEmail = String(session?.user?.email || '').trim().toLowerCase()
    const effectiveUser =
      knownUsers.find((user) => user.id === session?.user?.id) ||
      knownUsers.find((user) => user.email.toLowerCase() === userEmail) ||
      knownUsers.find((user) => user.role === role) ||
      null
    const userId = String(effectiveUser?.id || session?.user?.id || '').trim()

    if (role === 'admin') {
      return projects.map((project) => ({
        ...project,
        subject: subjectById.get(project.subject_id) || null,
        teams: teamsByProjectId.get(project.id) || [],
      }))
    }

    return projects
      .filter((project) => {
        const subject = subjectById.get(project.subject_id)
        const projectTeams = teamsByProjectId.get(project.id) || []

        if (role === 'teacher') {
          return (
            String(project.teacher_id || '').trim() === userId ||
            (subject?.teacher_ids || []).some((teacherId) => teacherId === userId)
          )
        }

        return projectTeams.some((team) => (team.student_ids || []).includes(userId))
      })
      .map((project) => ({
        ...project,
        subject: subjectById.get(project.subject_id) || null,
        teams: teamsByProjectId.get(project.id) || [],
      }))
  },

  async listKnownUsers(session) {
    return mockApi.listKnownUsers(session)
  },

  async listSubmissionFiles(session, projectId) {
    return mockApi.listSubmissionFiles(session, projectId)
  },

  async listNotifications(session) {
    return tryLive(
      async () => {
        const response = await gatewayClient.listNotifications(accessToken(session))
        return response.getNotificationsList().map(normalizeNotification)
      },
      () => mockApi.listNotifications(session),
    )
  },

  async listScheduledNotifications(session) {
    return tryLive(
      async () => {
        const response = await gatewayClient.listScheduledNotifications(accessToken(session))
        return response.getBatchesList().map(normalizeScheduledNotificationBatch)
      },
      () => mockApi.listScheduledNotifications(session),
    )
  },

  subscribeNotifications(session, handlers = {}) {
    if (isMockMode()) {
      handlers.onError?.(new Error('Notification streaming is unavailable in mock mode'))
      return () => {}
    }

    return gatewayClient.streamNotifications(accessToken(session), {
      onMessage: (message) => handlers.onMessage?.(normalizeNotification(message)),
      onError: (error) => {
        handleAuthenticationFailure(error)
        handlers.onError?.(error)
      },
      onEnd: handlers.onEnd,
    })
  },

  async createNotification(session, payload) {
    return tryLive(
      async () => {
        const response = await gatewayClient.createNotification(accessToken(session), payload)
        return response.getNotificationsList().map(normalizeNotification)
      },
      () => mockApi.createNotification(session, payload),
    )
  },

  async markNotificationRead(session, notificationId) {
    return tryLive(
      async () => gatewayClient.markNotificationRead(accessToken(session), notificationId),
      () => mockApi.markNotificationRead(session, notificationId),
    )
  },

  async cancelScheduledNotification(session, batchId) {
    return tryLive(
      async () => gatewayClient.cancelScheduledNotification(accessToken(session), batchId),
      () => mockApi.cancelScheduledNotification(session, batchId),
    )
  },

  async rescheduleScheduledNotification(session, batchId, triggerAt) {
    return tryLive(
      async () =>
        gatewayClient.rescheduleScheduledNotification(accessToken(session), batchId, triggerAt),
      () => mockApi.rescheduleScheduledNotification(session, batchId, triggerAt),
    )
  },

  async listUsers(session) {
    return tryLive(
      async () => {
        const response = await gatewayClient.listUsers(accessToken(session))
        return response.getUsersList().map(normalizeUser)
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
