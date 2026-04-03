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
    id: 'user-teacher-1',
    firstname: 'Marek',
    lastname: 'Novak',
    email: 'teacher@example.com',
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
    user_ids: [],
    teacher_ids: ['user-teacher-1'],
  },
  {
    id: 'subject-2',
    name: 'Distributed Applications',
    description: 'Covers service design, microservices, messaging, and observability.',
    abbreviation: 'DIA',
    user_ids: ['user-student-1'],
    teacher_ids: ['user-teacher-1'],
  },
  {
    id: 'subject-3',
    name: 'Applied Cryptography',
    description: 'Practical symmetric and asymmetric cryptography used in real systems.',
    abbreviation: 'ACR',
    user_ids: [],
    teacher_ids: ['user-teacher-1'],
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
]

let teams = [
  {
    id: 'team-1',
    project_id: 'project-1',
    name: 'Tracefinders',
    leader_student_id: 'user-student-1',
    student_ids: ['user-student-1'],
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
  return users.find((user) => user.id === session.user?.id) || null
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
    const user = currentUserFromSession(session)
    if (!user) throw new Error('Unauthorized')
    return delay(stripPassword(user))
  },

  async getUser(_session, userId) {
    const user = users.find((item) => item.id === userId)
    if (!user) throw new Error('User not found')
    return delay(stripPassword(user))
  },

  async changePassword(session, payload) {
    const user = currentUserFromSession(session)
    if (!user) throw new Error('Unauthorized')
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

  async logout() {
    return delay({ success: true })
  },

  async listSubjects() {
    syncSubjectsFromRegistrations()
    return delay(subjects)
  },

  async createSubject(session, payload) {
    if (session.user?.role !== 'admin') throw new Error('Forbidden')
    const subject = { id: generateId('subject'), ...payload, user_ids: [], teacher_ids: [] }
    subjects = [subject, ...subjects]
    return delay(subject)
  },

  async updateSubject(session, subjectId, payload) {
    if (session.user?.role !== 'admin') throw new Error('Forbidden')
    subjects = subjects.map((subject) =>
      subject.id === subjectId ? { ...subject, ...payload } : subject,
    )
    return delay(subjects.find((subject) => subject.id === subjectId))
  },

  async deleteSubject(session, subjectId) {
    if (session.user?.role !== 'admin') throw new Error('Forbidden')
    subjects = subjects.filter((subject) => subject.id !== subjectId)
    return delay({ success: true })
  },

  async registerSubject(session, subjectId) {
    if (session.user?.role !== 'student') throw new Error('Only students can register to subjects')
    const current = new Set(subjectRegistrations[session.user.id] || [])
    current.add(subjectId)
    subjectRegistrations[session.user.id] = [...current]
    syncSubjectsFromRegistrations()
    notifications = [
      {
        id: generateId('notification'),
        batch_id: generateId('batch'),
        user_id: session.user.id,
        creator_user_id: session.user.id,
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
    if (!['teacher', 'admin'].includes(session.user?.role)) throw new Error('Forbidden')
    const project = {
      id: generateId('project'),
      title: payload.title,
      description: payload.description,
      teacher_id: payload.teacher_id || session.user.id,
      max_students_per_team: Number(payload.max_students_per_team),
      start_date: payload.start_date,
      end_date: payload.end_date,
      subject_id: payload.subject_id,
    }
    projects = [project, ...projects]
    return delay(project)
  },

  async registerTeam(session, projectId) {
    if (session.user?.role !== 'student') throw new Error('Only students can create teams')
    const team = {
      id: generateId('team'),
      project_id: projectId,
      name: `${session.user.firstname}'s Team`,
      leader_student_id: session.user.id,
      student_ids: [session.user.id],
    }
    teams = [team, ...teams]
    return delay(team)
  },

  async addTeamMember(session, teamId, studentId) {
    const team = teams.find((item) => item.id === teamId)
    if (!team) throw new Error('Team not found')
    if (team.leader_student_id !== session.user?.id && session.user?.role !== 'teacher' && session.user?.role !== 'admin') {
      throw new Error('Forbidden')
    }
    if (!team.student_ids.includes(studentId)) {
      team.student_ids.push(studentId)
    }
    return delay(team)
  },

  async listTeamsByProject(projectId) {
    return delay(teams.filter((team) => team.project_id === projectId))
  },

  async listNotifications(session, userId) {
    materializeDueNotifications()
    const effectiveUserId = userId || session.user?.id
    return delay(
      attachNotificationSenders(
        notifications.filter(
          (item) => item.user_id === effectiveUserId && item.date && !item.cancelled_at,
        ),
      ),
    )
  },

  async createNotification(session, payload) {
    if (!['teacher', 'admin'].includes(session.user?.role)) throw new Error('Forbidden')
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
      creator_user_id: session.user.id,
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
    if (!['teacher', 'admin'].includes(session.user?.role)) throw new Error('Forbidden')
    const batches = new Map()
    for (const item of notifications.filter(
      (entry) =>
        entry.creator_user_id === session.user.id && !entry.date && !entry.cancelled_at,
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
    if (!['teacher', 'admin'].includes(session.user?.role)) throw new Error('Forbidden')
    const targets = notifications.filter((item) => item.batch_id === batchId)
    if (!targets.length) throw new Error('Notification batch not found')
    if (targets.some((item) => item.creator_user_id !== session.user.id)) throw new Error('Forbidden')
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
    if (!['teacher', 'admin'].includes(session.user?.role)) throw new Error('Forbidden')

    const triggerDate = new Date(triggerAt)
    if (Number.isNaN(triggerDate.getTime())) throw new Error('Invalid trigger time')

    const targets = notifications.filter((item) => item.batch_id === batchId)
    if (!targets.length) throw new Error('Notification batch not found')
    if (targets.some((item) => item.creator_user_id !== session.user.id)) throw new Error('Forbidden')
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
    if (session.user?.role !== 'admin') throw new Error('Forbidden')
    return delay(users.map(stripPassword))
  },

  async getDashboardSummary(session) {
    const registeredSubjects = new Set(subjectRegistrations[session.user?.id] || [])
    const ownTeams = teams.filter((team) => team.student_ids.includes(session.user?.id))
    const ownProjects = projects.filter((project) => project.teacher_id === session.user?.id)
    return delay({
      subjects: subjects.length,
      registeredSubjects: registeredSubjects.size,
      projects: projects.length,
      ownProjects: ownProjects.length,
      teams: ownTeams.length,
      unreadNotifications: notifications.filter(
        (item) => item.user_id === session.user?.id && item.date && !item.cancelled_at && !item.read,
      ).length,
    })
  },
}
