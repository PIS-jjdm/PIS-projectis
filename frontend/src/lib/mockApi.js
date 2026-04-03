const now = new Date()
const day = 24 * 60 * 60 * 1000

let users = [
  {
    id: 'user-student-1',
    firstname: 'An',
    lastname: 'Nguyen',
    email: 'student@example.com',
    password: 'student123',
    role: 'student',
  },
  {
    id: 'user-student-2',
    firstname: 'Petra',
    lastname: 'Dvorakova',
    email: 'petra.dvorakova@example.com',
    password: 'student123',
    role: 'student',
  },
  {
    id: 'user-student-3',
    firstname: 'Jakub',
    lastname: 'Havel',
    email: 'jakub.havel@example.com',
    password: 'student123',
    role: 'student',
  },
  {
    id: 'user-teacher-1',
    firstname: 'Marek',
    lastname: 'Novak',
    email: 'teacher@example.com',
    password: 'teacher123',
    role: 'teacher',
  },
  {
    id: 'user-teacher-2',
    firstname: 'Lenka',
    lastname: 'Kralova',
    email: 'lenka.kralova@example.com',
    password: 'teacher123',
    role: 'teacher',
  },
  {
    id: 'user-admin-1',
    firstname: 'Eva',
    lastname: 'Svobodova',
    email: 'admin@example.com',
    password: 'admin123',
    role: 'admin',
  },
]

let subjects = [
  {
    id: 'subject-1',
    name: 'Secure Software Systems',
    description: 'Focuses on secure coding, threat modeling, and software assurance.',
    abbreviation: 'SSS',
    user_ids: ['user-student-2'],
    teacher_ids: ['user-teacher-2'],
  },
  {
    id: 'subject-2',
    name: 'Distributed Applications',
    description: 'Covers service design, microservices, messaging, and observability.',
    abbreviation: 'DIA',
    user_ids: ['user-student-1', 'user-student-2'],
    teacher_ids: ['user-teacher-1'],
  },
  {
    id: 'subject-3',
    name: 'Applied Cryptography',
    description: 'Practical symmetric and asymmetric cryptography used in real systems.',
    abbreviation: 'ACR',
    user_ids: ['user-student-3'],
    teacher_ids: ['user-teacher-1'],
  },
  {
    id: 'subject-4',
    name: 'Human Computer Interaction',
    description: 'Explores interaction design, interface evaluation, and collaborative prototyping.',
    abbreviation: 'HCI',
    user_ids: ['user-student-1', 'user-student-3'],
    teacher_ids: ['user-teacher-2'],
  },
]

let projects = [
  {
    id: 'project-1',
    title: 'Microservice Router with Distributed Tracing',
    description: 'Create an API gateway and integrate OpenTelemetry-based tracing.',
    teacher_id: 'user-teacher-1',
    max_students_per_team: 3,
    start_date: iso(now),
    end_date: iso(new Date(now.getTime() + 60 * day)),
    subject_id: 'subject-2',
  },
  {
    id: 'project-2',
    title: 'Authentication Service',
    description: 'Implement auth with HS256 JWT signing, validation, and refresh strategy.',
    teacher_id: 'user-teacher-1',
    max_students_per_team: 2,
    start_date: iso(new Date(now.getTime() + 3 * day)),
    end_date: iso(new Date(now.getTime() + 80 * day)),
    subject_id: 'subject-3',
  },
  {
    id: 'project-3',
    title: 'Notification Delivery Service',
    description: 'Provide read state, deadlines, and event-driven alerts for students.',
    teacher_id: 'user-teacher-1',
    max_students_per_team: 4,
    start_date: iso(new Date(now.getTime() + 5 * day)),
    end_date: iso(new Date(now.getTime() + 70 * day)),
    subject_id: 'subject-1',
  },
  {
    id: 'project-4',
    title: 'Collaborative Whiteboard for Seminar Feedback',
    description: 'Design a browser-based feedback wall with live updates, moderation, and archival export.',
    teacher_id: 'user-teacher-2',
    max_students_per_team: 5,
    start_date: iso(new Date(now.getTime() - 4 * day)),
    end_date: iso(new Date(now.getTime() + 45 * day)),
    subject_id: 'subject-4',
  },
  {
    id: 'project-5',
    title: 'Static Analysis Rules for Student CI Pipelines',
    description: 'Create reusable checks for dependency drift, secrets scanning, and unsafe configuration defaults.',
    teacher_id: 'user-teacher-2',
    max_students_per_team: 3,
    start_date: iso(new Date(now.getTime() + 7 * day)),
    end_date: iso(new Date(now.getTime() + 95 * day)),
    subject_id: 'subject-1',
  },
]

let teams = [
  {
    id: 'team-1',
    project_id: 'project-1',
    name: 'Tracefinders',
    leader_student_id: 'user-student-1',
    student_ids: ['user-student-1'],
  },
  {
    id: 'team-2',
    project_id: 'project-4',
    name: 'Interface Guild',
    leader_student_id: 'user-student-2',
    student_ids: ['user-student-2', 'user-student-3'],
  },
]

let submissionFiles = [
  {
    id: 'submission-1',
    project_id: 'project-1',
    team_id: 'team-1',
    filename: 'system-architecture.pdf',
    uploaded_at: iso(new Date(now.getTime() - 2 * day)),
    uploaded_by_user_id: 'user-student-1',
    size_bytes: 482_100,
  },
  {
    id: 'submission-2',
    project_id: 'project-1',
    team_id: 'team-1',
    filename: 'trace-pipeline.png',
    uploaded_at: iso(new Date(now.getTime() - 18 * 60 * 60 * 1000)),
    uploaded_by_user_id: 'user-student-1',
    size_bytes: 1_284_220,
  },
  {
    id: 'submission-3',
    project_id: 'project-4',
    team_id: 'team-2',
    filename: 'ux-feedback-summary.docx',
    uploaded_at: iso(new Date(now.getTime() - 8 * 60 * 60 * 1000)),
    uploaded_by_user_id: 'user-student-2',
    size_bytes: 268_044,
  },
]

let notifications = [
  {
    id: 'notification-1',
    batch_id: 'batch-1',
    user_id: 'user-student-1',
    creator_user_id: 'system',
    message: 'Registration for Distributed Applications is open.',
    trigger_at: iso(new Date(now.getTime() - 2 * day)),
    date: iso(new Date(now.getTime() - 2 * day)),
    read: false,
  },
  {
    id: 'notification-2',
    batch_id: 'batch-2',
    user_id: 'user-student-1',
    creator_user_id: 'system',
    message: 'Project proposal deadline is in 7 days.',
    trigger_at: iso(new Date(now.getTime() - 1 * day)),
    date: iso(new Date(now.getTime() - 1 * day)),
    read: false,
  },
  {
    id: 'notification-3',
    batch_id: 'batch-3',
    user_id: 'user-teacher-1',
    creator_user_id: 'system',
    message: 'A new student registered interest in your project.',
    trigger_at: iso(new Date(now.getTime() - 6 * 60 * 60 * 1000)),
    date: iso(new Date(now.getTime() - 6 * 60 * 60 * 1000)),
    read: false,
  },
]

let subjectRegistrations = {
  'user-student-1': ['subject-2'],
  'user-student-2': ['subject-1', 'subject-2'],
  'user-student-3': ['subject-3', 'subject-4'],
}

function iso(value) {
  return value.toISOString()
}

function delay(result, ms = 250) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(structuredClone(result)), ms)
  })
}

function generateId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function stripPassword(user) {
  const { password, ...rest } = user
  return rest
}

function senderForNotification(notification) {
  if (!notification?.creator_user_id || notification.creator_user_id === 'system') {
    return null
  }

  const sender = users.find((user) => user.id === notification.creator_user_id)
  return sender ? stripPassword(sender) : null
}

function attachNotificationSender(notification) {
  return {
    ...notification,
    sender: senderForNotification(notification),
  }
}

function attachNotificationSenders(items) {
  return items.map(attachNotificationSender)
}

function authSession(user) {
  return {
    token: `mock-token-${user.id}`,
    user: stripPassword(user),
  }
}

function currentUserFromSession(session) {
  const sessionId = String(session?.user?.id || '').trim()
  if (sessionId) {
    const byId = users.find((user) => user.id === sessionId)
    if (byId) return byId
  }

  const sessionEmail = String(session?.user?.email || '').trim().toLowerCase()
  if (sessionEmail) {
    const byEmail = users.find((user) => user.email.toLowerCase() === sessionEmail)
    if (byEmail) return byEmail
  }

  const sessionRole = String(session?.user?.role || '').trim().toLowerCase()
  if (sessionRole) {
    return users.find((user) => user.role === sessionRole) || null
  }

  return null
}

function requireCurrentUser(session) {
  const user = currentUserFromSession(session)
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

function findUser(userId) {
  return users.find((user) => user.id === userId) || null
}

function projectById(projectId) {
  return projects.find((project) => project.id === projectId) || null
}

function teamById(teamId) {
  return teams.find((team) => team.id === teamId) || null
}

function teamForStudent(projectId, studentId) {
  return teams.find(
    (team) => team.project_id === projectId && (team.student_ids || []).includes(studentId),
  ) || null
}

function projectParticipants(projectId) {
  return new Set(
    teams
      .filter((team) => team.project_id === projectId)
      .flatMap((team) => team.student_ids || []),
  )
}

function decorateSubmissionFile(file) {
  return {
    ...file,
    uploader: stripPassword(findUser(file.uploaded_by_user_id) || {}),
  }
}

function syncSubjectsFromRegistrations() {
  subjects = subjects.map((subject) => ({
    ...subject,
    user_ids: Object.entries(subjectRegistrations)
      .filter(([, subjectIds]) => subjectIds.includes(subject.id))
      .map(([userId]) => userId)
      .sort(),
  }))
}

function normalizeUserIds(values) {
  const seen = new Set()
  return (values || [])
    .map((value) => String(value || '').trim())
    .filter((value) => value && !seen.has(value) && seen.add(value))
}

function materializeDueNotifications() {
  const currentIso = iso(new Date())
  notifications = notifications.map((item) => {
    if (!item.date && !item.cancelled_at && new Date(item.trigger_at).getTime() <= Date.now()) {
      return { ...item, date: currentIso }
    }
    return item
  })
}

export const mockApi = {
  async login({ email, password }) {
    const user = users.find((item) => item.email === email && item.password === password)
    if (!user) {
      throw new Error('Invalid email or password')
    }
    return delay(authSession(user))
  },

  async register(payload) {
    const exists = users.some((user) => user.email === payload.email)
    if (exists) throw new Error('Email already registered')

    const user = {
      id: generateId('user'),
      firstname: payload.firstname,
      lastname: payload.lastname,
      email: payload.email,
      password: payload.password,
      role: payload.role,
    }

    users = [user, ...users]
    notifications = [
      {
        id: generateId('notification'),
        batch_id: generateId('batch'),
        user_id: user.id,
        creator_user_id: 'system',
        message: 'Welcome to the project registration system.',
        trigger_at: iso(new Date()),
        date: iso(new Date()),
        read: false,
      },
      ...notifications,
    ]

    return delay(authSession(user))
  },

  async createUser(session, payload) {
    if (session.user?.role !== 'admin') throw new Error('Forbidden')
    const exists = users.some((user) => user.email === payload.email)
    if (exists) throw new Error('Email already registered')

    const user = {
      id: generateId('user'),
      firstname: payload.firstname,
      lastname: payload.lastname,
      email: payload.email,
      password: payload.password,
      role: payload.role,
    }

    users = [user, ...users]
    return delay(stripPassword(user))
  },

  async updateUser(session, payload) {
    if (session.user?.role !== 'admin') throw new Error('Forbidden')
    if (!payload.user_id) throw new Error('User ID is required')

    const existing = users.find((user) => user.id === payload.user_id)
    if (!existing) throw new Error('User not found')

    const emailTaken = users.some(
      (user) => user.email === payload.email && user.id !== payload.user_id,
    )
    if (emailTaken) throw new Error('Email already registered')

    const updatedUser = {
      ...existing,
      firstname: payload.firstname,
      lastname: payload.lastname,
      email: payload.email,
      role: payload.role,
    }

    users = users.map((user) => (user.id === payload.user_id ? updatedUser : user))
    return delay(stripPassword(updatedUser))
  },

  async getMe(session) {
    const user = requireCurrentUser(session)
    return delay(stripPassword(user))
  },

  async getUser(_session, userId) {
    const user = users.find((item) => item.id === userId)
    if (!user) throw new Error('User not found')
    return delay(stripPassword(user))
  },

  async changePassword(session, payload) {
    const user = requireCurrentUser(session)
    if (payload.current_password !== user.password) {
      throw new Error('Current password is incorrect')
    }
    if (!payload.new_password) {
      throw new Error('New password is required')
    }
    if (payload.new_password === user.password) {
      throw new Error('New password must be different from current password')
    }

    users = users.map((item) =>
      item.id === user.id ? { ...item, password: payload.new_password } : item,
    )

    return delay({ success: true })
  },

  async setUserAvatar(session, payload) {
    const user = requireCurrentUser(session)
    if (!payload?.user_id) throw new Error('User ID is required')
    if (user.id !== payload.user_id && user.role !== 'admin') throw new Error('Forbidden')
    return delay({ success: true })
  },

  async logout() {
    return delay({ success: true })
  },

  async listSubjects() {
    syncSubjectsFromRegistrations()
    return delay(subjects)
  },

  async createSubject(session, payload) {
    if (requireCurrentUser(session).role !== 'admin') throw new Error('Forbidden')
    const subject = { id: generateId('subject'), ...payload, user_ids: [], teacher_ids: [] }
    subjects = [subject, ...subjects]
    return delay(subject)
  },

  async updateSubject(session, subjectId, payload) {
    if (requireCurrentUser(session).role !== 'admin') throw new Error('Forbidden')
    subjects = subjects.map((subject) =>
      subject.id === subjectId ? { ...subject, ...payload } : subject,
    )
    return delay(subjects.find((subject) => subject.id === subjectId))
  },

  async deleteSubject(session, subjectId) {
    if (requireCurrentUser(session).role !== 'admin') throw new Error('Forbidden')
    subjects = subjects.filter((subject) => subject.id !== subjectId)
    return delay({ success: true })
  },

  async registerSubject(session, subjectId) {
    const user = requireCurrentUser(session)
    if (user.role !== 'student') throw new Error('Only students can register to subjects')
    const current = new Set(subjectRegistrations[user.id] || [])
    current.add(subjectId)
    subjectRegistrations[user.id] = [...current]
    syncSubjectsFromRegistrations()
    notifications = [
      {
        id: generateId('notification'),
        batch_id: generateId('batch'),
        user_id: user.id,
        creator_user_id: user.id,
        message: `You registered to subject ${subjects.find((s) => s.id === subjectId)?.name || subjectId}.`,
        trigger_at: iso(new Date()),
        date: iso(new Date()),
        read: false,
      },
      ...notifications,
    ]
    return delay({ success: true })
  },

  async listProjects() {
    return delay(projects)
  },

  async getProject(projectId) {
    const project = projects.find((item) => item.id === projectId)
    if (!project) throw new Error('Project not found')
    return delay(project)
  },

  async createProject(session, payload) {
    const user = requireCurrentUser(session)
    if (!['teacher', 'admin'].includes(user.role)) throw new Error('Forbidden')
    const project = {
      id: generateId('project'),
      title: payload.title,
      description: payload.description,
      teacher_id: payload.teacher_id || user.id,
      max_students_per_team: Number(payload.max_students_per_team),
      start_date: payload.start_date,
      end_date: payload.end_date,
      subject_id: payload.subject_id,
    }
    projects = [project, ...projects]
    return delay(project)
  },

  async registerTeam(session, projectId) {
    const user = requireCurrentUser(session)
    if (user.role !== 'student') throw new Error('Only students can create teams')
    if (teamForStudent(projectId, user.id)) {
      throw new Error('You are already assigned to a team in this project')
    }
    const team = {
      id: generateId('team'),
      project_id: projectId,
      name: `${user.firstname}'s Team`,
      leader_student_id: user.id,
      student_ids: [user.id],
    }
    teams = [team, ...teams]
    return delay(team)
  },

  async addTeamMember(session, teamId, studentId) {
    const user = requireCurrentUser(session)
    const team = teamById(teamId)
    if (!team) throw new Error('Team not found')
    if (
      team.leader_student_id !== user.id &&
      user.role !== 'teacher' &&
      user.role !== 'admin'
    ) {
      throw new Error('Forbidden')
    }
    const project = projectById(team.project_id)
    if (!project) throw new Error('Project not found')
    const student = findUser(studentId)
    if (!student || student.role !== 'student') throw new Error('Student not found')
    if (team.student_ids.includes(studentId)) {
      return delay(team)
    }
    if ((team.student_ids || []).length >= Number(project.max_students_per_team || 0)) {
      throw new Error('Team is already full')
    }
    const existingTeam = teamForStudent(team.project_id, studentId)
    if (existingTeam && existingTeam.id !== team.id) {
      throw new Error('Student is already assigned to another team for this project')
    }
    if (!team.student_ids.includes(studentId)) {
      team.student_ids.push(studentId)
    }
    return delay(team)
  },

  async removeTeamMember(session, teamId, studentId) {
    const user = requireCurrentUser(session)
    const team = teamById(teamId)
    if (!team) throw new Error('Team not found')
    if (
      team.leader_student_id !== user.id &&
      user.role !== 'teacher' &&
      user.role !== 'admin'
    ) {
      throw new Error('Forbidden')
    }
    if (team.leader_student_id === studentId) {
      throw new Error('Team leader cannot be removed')
    }
    teams = teams.map((item) =>
      item.id === teamId
        ? { ...item, student_ids: item.student_ids.filter((memberId) => memberId !== studentId) }
        : item,
    )
    return delay(teams.find((item) => item.id === teamId))
  },

  async listTeamsByProject(projectId) {
    return delay(teams.filter((team) => team.project_id === projectId))
  },

  async listKnownUsers() {
    return delay(users.map(stripPassword))
  },

  async listSubmissionFiles(_session, projectId) {
    return delay(
      submissionFiles
        .filter((item) => item.project_id === projectId)
        .map(decorateSubmissionFile)
        .sort((left, right) => new Date(right.uploaded_at) - new Date(left.uploaded_at)),
    )
  },

  async listNotifications(session) {
    materializeDueNotifications()
    const effectiveUserId = requireCurrentUser(session).id
    return delay(
      attachNotificationSenders(
        notifications.filter(
          (item) => item.user_id === effectiveUserId && item.date && !item.cancelled_at,
        ),
      ),
    )
  },

  async createNotification(session, payload) {
    const user = requireCurrentUser(session)
    if (!['teacher', 'admin'].includes(user.role)) throw new Error('Forbidden')
    const userIds = normalizeUserIds(payload.user_ids)
    if (!userIds.length) throw new Error('At least one recipient is required')

    const triggerDate = payload.trigger_at ? new Date(payload.trigger_at) : new Date()
    if (Number.isNaN(triggerDate.getTime())) throw new Error('Invalid trigger time')

    const isDue = triggerDate.getTime() <= Date.now()
    const batchId = generateId('batch')
    const created = userIds.map((userId) => ({
      id: generateId('notification'),
      batch_id: batchId,
      user_id: userId,
      creator_user_id: user.id,
      message: payload.message,
      trigger_at: iso(triggerDate),
      date: isDue ? iso(new Date()) : null,
      cancelled_at: null,
      read: false,
    }))

    notifications = [...created, ...notifications]
    return delay(attachNotificationSenders(created))
  },

  async markNotificationRead(session, notificationId) {
    materializeDueNotifications()
    notifications = notifications.map((item) =>
      item.id === notificationId ? { ...item, read: true } : item,
    )
    return delay({ success: true })
  },

  async listScheduledNotifications(session) {
    materializeDueNotifications()
    const user = requireCurrentUser(session)
    if (!['teacher', 'admin'].includes(user.role)) throw new Error('Forbidden')
    const batches = new Map()
    for (const item of notifications.filter(
      (entry) =>
        entry.creator_user_id === user.id && !entry.date && !entry.cancelled_at,
    )) {
      if (!batches.has(item.batch_id)) {
        batches.set(item.batch_id, {
          batch_id: item.batch_id,
          message: item.message,
          trigger_at: item.trigger_at,
          creator_user_id: item.creator_user_id,
          user_ids: [],
        })
      }
      batches.get(item.batch_id).user_ids.push(item.user_id)
    }

    return delay(
      [...batches.values()]
        .map((batch) => ({
          ...batch,
          user_ids: [...new Set(batch.user_ids)].sort(),
        }))
        .sort((left, right) => new Date(left.trigger_at) - new Date(right.trigger_at)),
    )
  },

  async cancelScheduledNotification(session, batchId) {
    materializeDueNotifications()
    const user = requireCurrentUser(session)
    if (!['teacher', 'admin'].includes(user.role)) throw new Error('Forbidden')
    const targets = notifications.filter((item) => item.batch_id === batchId)
    if (!targets.length) throw new Error('Notification batch not found')
    if (targets.some((item) => item.creator_user_id !== user.id)) throw new Error('Forbidden')
    if (targets.every((item) => item.cancelled_at)) return delay({ success: true })
    if (targets.every((item) => item.date)) throw new Error('Notification batch has already been delivered')

    notifications = notifications.map((item) =>
      item.batch_id === batchId && !item.date
        ? { ...item, cancelled_at: iso(new Date()) }
        : item,
    )
    return delay({ success: true })
  },

  async rescheduleScheduledNotification(session, batchId, triggerAt) {
    materializeDueNotifications()
    const user = requireCurrentUser(session)
    if (!['teacher', 'admin'].includes(user.role)) throw new Error('Forbidden')

    const triggerDate = new Date(triggerAt)
    if (Number.isNaN(triggerDate.getTime())) throw new Error('Invalid trigger time')

    const targets = notifications.filter((item) => item.batch_id === batchId)
    if (!targets.length) throw new Error('Notification batch not found')
    if (targets.some((item) => item.creator_user_id !== user.id)) throw new Error('Forbidden')
    if (targets.some((item) => item.cancelled_at)) throw new Error('Notification batch has already been cancelled')
    if (targets.some((item) => item.date)) throw new Error('Notification batch has already been delivered')

    notifications = notifications.map((item) =>
      item.batch_id === batchId
        ? { ...item, trigger_at: iso(triggerDate) }
        : item,
    )

    return delay({ success: true })
  },

  async listUsers(session) {
    if (requireCurrentUser(session).role !== 'admin') throw new Error('Forbidden')
    return delay(users.map(stripPassword))
  },

  async getDashboardSummary(session) {
    const user = requireCurrentUser(session)
    const registeredSubjects = new Set(subjectRegistrations[user.id] || [])
    const ownTeams = teams.filter((team) => team.student_ids.includes(user.id))
    const ownProjects = projects.filter((project) => project.teacher_id === user.id)
    return delay({
      subjects: subjects.length,
      registeredSubjects: registeredSubjects.size,
      projects: projects.length,
      ownProjects: ownProjects.length,
      teams: ownTeams.length,
      unreadNotifications: notifications.filter(
        (item) => item.user_id === user.id && item.date && !item.cancelled_at && !item.read,
      ).length,
    })
  },
}
