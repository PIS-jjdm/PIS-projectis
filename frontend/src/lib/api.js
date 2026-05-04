import * as grpcWeb from 'grpc-web'
import { gatewayClient } from './grpcWebGateway'

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

// Auth-sensitive callers (e.g. session hydration) opt in to the
// session-clear behaviour by invoking this directly on UNAUTHENTICATED.
export function reportAuthFailure(error) {
  return handleAuthenticationFailure(error)
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
  if (typeof project.getProjectId === 'function') {
    return {
      id: project.getProjectId(),
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
  if (typeof team.getTeamId === 'function') {
    return {
      id: team.getTeamId(),
      project_id: team.getProjectId(),
      name: team.getName(),
      leader_student_id: team.getLeaderStudentId(),
      student_ids: team.getStudentIdsList?.() || [],
    }
  }
  return team
}

function normalizeProjectSubmission(submission) {
  if (!submission) return null
  if (typeof submission.getTeamId === 'function') {
    return {
      team_id: submission.getTeamId(),
      submitted_at: submission.getSubmittedAt(),
      file_name: submission.getFileName(),
      content_type: submission.getContentType(),
      file_size: Number(submission.getFileSize?.() || 0),
    }
  }
  return submission
}

function normalizeProjectEvaluation(evaluation) {
  if (!evaluation) return null
  if (typeof evaluation.getId === 'function') {
    return {
      id: evaluation.getId(),
      project_id: evaluation.getProjectId(),
      team_id: evaluation.getTeamId(),
      evaluator_teacher_id: evaluation.getEvaluatorTeacherId(),
      total_score: evaluation.getTotalScore(),
      feedback: evaluation.getFeedback(),
      timestamp: timestampToIso(evaluation.getTimestamp()),
    }
  }
  return evaluation
}

function normalizeTeamDetail(detail) {
  if (!detail) return null
  if (typeof detail.getTeamId === 'function') {
    const students = detail.getStudentsList?.().map(normalizeUser) || []
    const submission = detail.hasSubmission?.()
      ? normalizeProjectSubmission(detail.getSubmission())
      : null
    const evaluation = detail.hasEvaluation?.()
      ? normalizeProjectEvaluation(detail.getEvaluation())
      : null
    return {
      id: detail.getTeamId(),
      project_id: detail.getProjectId(),
      name: detail.getName(),
      leader_student_id: detail.getLeaderStudentId(),
      students,
      student_ids: students.map((student) => student.id).filter(Boolean),
      submission,
      evaluation,
    }
  }
  return detail
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
    return normalizeAuthResponse(await gatewayClient.login(credentials))
  },

  async register(payload) {
    return normalizeAuthResponse(await gatewayClient.register(payload))
  },

  async createUser(session, payload) {
    return normalizeUser(await gatewayClient.createUser(accessToken(session), payload))
  },

  async updateUser(session, payload) {
    return normalizeUser(await gatewayClient.updateUser(accessToken(session), payload))
  },

  async getMe(session) {
    return normalizeUser(await gatewayClient.getMe(accessToken(session)))
  },

  async getUser(session, userId) {
    return normalizeUser(await gatewayClient.getUser(accessToken(session), userId))
  },

  async changePassword(session, payload) {
    return gatewayClient.changePassword(accessToken(session), payload)
  },

  async setUserAvatar(session, payload) {
    return gatewayClient.setUserAvatar(accessToken(session), payload)
  },

  async logout(session) {
    return gatewayClient.logout(accessToken(session))
  },

  async listSubjects(session) {
    const response = await gatewayClient.listSubjects(accessToken(session))
    return response.getSubjectsList().map(normalizeSubject)
  },

  async getSubject(session, subjectId) {
    return normalizeSubject(await gatewayClient.getSubject(accessToken(session), subjectId))
  },

  async getSubjectNotificationRecipients(session, subjectId) {
    const subject = await api.getSubject(session, subjectId)
    if (!subject) {
      throw new Error('Subject not found')
    }

    return uniqueIds([...(subject.user_ids || []), ...(subject.teacher_ids || [])])
  },

  async createSubject(session, payload) {
    return normalizeSubject(await gatewayClient.createSubject(accessToken(session), payload))
  },

  async updateSubject(session, subjectId, payload) {
    return normalizeSubject(
      await gatewayClient.updateSubject(accessToken(session), subjectId, payload),
    )
  },

  async deleteSubject(session, subjectId) {
    return gatewayClient.deleteSubject(accessToken(session), subjectId)
  },

  async registerSubject(session, subjectId) {
    return gatewayClient.registerSubject(accessToken(session), subjectId)
  },

  async addStudentToSubject(session, subjectId, userId) {
    return gatewayClient.addStudentToSubject(accessToken(session), subjectId, userId)
  },

  async removeStudentFromSubject(session, subjectId, userId) {
    return gatewayClient.removeStudentFromSubject(accessToken(session), subjectId, userId)
  },

  async assignTeacherToSubject(session, subjectId, teacherUserId) {
    return normalizeSubject(
      await gatewayClient.assignTeacherToSubject(accessToken(session), subjectId, teacherUserId),
    )
  },

  async removeTeacherFromSubject(session, subjectId, teacherUserId) {
    return normalizeSubject(
      await gatewayClient.removeTeacherFromSubject(accessToken(session), subjectId, teacherUserId),
    )
  },

  async listProjects(session, subjectId) {
    // The router fans out internally when subject_id is empty, so a single grpc-web round-trip
    // returns every project the caller can see.
    const response = await gatewayClient.listProjects(accessToken(session), subjectId || '')
    return response.getProjectsList().map(normalizeProject)
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
    return normalizeProject(await gatewayClient.getProject(accessToken(session), projectId))
  },

  async createProject(session, payload) {
    return normalizeProject(await gatewayClient.createProject(accessToken(session), payload))
  },

  async registerTeam(session, projectId, teamName) {
    const resolvedName =
      (teamName && teamName.trim()) || `${session?.user?.firstname || 'Team'}'s team`
    return normalizeTeam(
      await gatewayClient.registerTeam(accessToken(session), projectId, resolvedName),
    )
  },

  async addTeamMember(session, teamId, studentId) {
    return normalizeTeam(
      await gatewayClient.addTeamMember(accessToken(session), teamId, studentId),
    )
  },

  async removeTeamMember(session, teamId, studentId) {
    return normalizeTeam(
      await gatewayClient.removeTeamMember(accessToken(session), teamId, studentId),
    )
  },

  async listTeamsByProject(session, projectId) {
    const response = await gatewayClient.listTeamsByProject(accessToken(session), projectId)
    return response.getTeamsList().map(normalizeTeam)
  },

  async getTeam(session, teamId) {
    return normalizeTeamDetail(await gatewayClient.getTeam(accessToken(session), teamId))
  },

  async listProjectTeamDetails(session, projectId) {
    const response = await gatewayClient.listProjectTeamDetails(accessToken(session), projectId)
    return response.getTeamsList().map(normalizeTeamDetail).filter(Boolean)
  },

  async downloadSubmission(session, teamId) {
    return gatewayClient.downloadSubmission(accessToken(session), teamId)
  },

  async listProjectEvaluations(session, filters = {}) {
    const response = await gatewayClient.listProjectEvaluations(accessToken(session), filters)
    return response.getEvaluationsList().map(normalizeProjectEvaluation)
  },

  async submitProject(session, teamId, file) {
    if (!file) throw new Error('No file selected')
    const buffer = await file.arrayBuffer()
    const fileData = new Uint8Array(buffer)
    return normalizeProjectSubmission(
      await gatewayClient.submitProject(accessToken(session), {
        teamId,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        fileSize: file.size,
        fileData,
      }),
    )
  },

  async createProjectEvaluation(session, payload) {
    return normalizeProjectEvaluation(
      await gatewayClient.createProjectEvaluation(accessToken(session), payload),
    )
  },

  async updateProjectEvaluation(session, payload) {
    return normalizeProjectEvaluation(
      await gatewayClient.updateProjectEvaluation(accessToken(session), payload),
    )
  },

  async listParticipantProjects(session) {
    const [projects, subjects] = await Promise.all([
      api.listProjects(session),
      api.listSubjects(session),
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
    const userId = String(session?.user?.id || '').trim()

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

  async listNotifications(session) {
    const response = await gatewayClient.listNotifications(accessToken(session))
    return response.getNotificationsList().map(normalizeNotification)
  },

  async listScheduledNotifications(session) {
    const response = await gatewayClient.listScheduledNotifications(accessToken(session))
    return response.getBatchesList().map(normalizeScheduledNotificationBatch)
  },

  subscribeNotifications(session, handlers = {}) {
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
    const response = await gatewayClient.createNotification(accessToken(session), payload)
    return response.getNotificationsList().map(normalizeNotification)
  },

  async markNotificationRead(session, notificationId) {
    return gatewayClient.markNotificationRead(accessToken(session), notificationId)
  },

  async cancelScheduledNotification(session, batchId) {
    return gatewayClient.cancelScheduledNotification(accessToken(session), batchId)
  },

  async rescheduleScheduledNotification(session, batchId, triggerAt) {
    return gatewayClient.rescheduleScheduledNotification(accessToken(session), batchId, triggerAt)
  },

  async listUsers(session) {
    const response = await gatewayClient.listUsers(accessToken(session))
    return response.getUsersList().map(normalizeUser)
  },

  async getDashboardSummary(session) {
    return buildDashboardSummary(session)
  },
}
