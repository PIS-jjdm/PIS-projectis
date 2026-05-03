import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import GroupRoundedIcon from '@mui/icons-material/GroupRounded'
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded'
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded'
import PersonRemoveRoundedIcon from '@mui/icons-material/PersonRemoveRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { displayUserName } from '../lib/projectView'
import { formatDateOnly } from '../utils/date'

function userLabel(user) {
  return displayUserName(user) || user?.email || user?.id || 'Unknown user'
}

function userNameSearchText(user) {
  return `${user?.firstname || ''} ${user?.lastname || ''}`.trim().toLowerCase()
}

function UserList({ emptyText, maxVisible, users, onRemove, removable }) {
  if (!users.length) {
    return (
      <Typography color="text.secondary" sx={{ py: 1 }}>
        {emptyText}
      </Typography>
    )
  }

  return (
    <Stack
      spacing={1.25}
      sx={{
        maxHeight: maxVisible ? maxVisible * 78 : 'none',
        overflowY: maxVisible && users.length > maxVisible ? 'auto' : 'visible',
        pr: maxVisible && users.length > maxVisible ? 1 : 0,
      }}
    >
      {users.map((user) => (
        <Paper key={user.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
          >
            <Box>
              <Typography fontWeight={700}>{userLabel(user)}</Typography>
              <Typography variant="body2" color="text.secondary">
                {user.email}
              </Typography>
            </Box>
            {removable && (
              <Button
                color="error"
                size="small"
                variant="outlined"
                startIcon={<PersonRemoveRoundedIcon />}
                onClick={() => onRemove(user.id)}
              >
                Remove
              </Button>
            )}
          </Stack>
        </Paper>
      ))}
    </Stack>
  )
}

export default function SubjectDetailPage() {
  const { subjectId } = useParams()
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const session = useMemo(() => ({ token, user }), [token, user])
  const [subject, setSubject] = useState(null)
  const [projects, setProjects] = useState([])
  const [knownUsers, setKnownUsers] = useState([])
  const [studentToAdd, setStudentToAdd] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [teacherToAdd, setTeacherToAdd] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [projectsExpanded, setProjectsExpanded] = useState(true)

  const isAdmin = user?.role === 'admin'
  const knownUsersById = useMemo(
    () => new Map(knownUsers.map((knownUser) => [knownUser.id, knownUser])),
    [knownUsers],
  )
  const subjectProjects = useMemo(
    () => projects.filter((project) => project.subject_id === subject?.id),
    [projects, subject],
  )
  const enrolledStudents = useMemo(
    () =>
      (subject?.user_ids || [])
        .map((studentId) => knownUsersById.get(studentId) || { id: studentId })
        .sort((left, right) => userLabel(left).localeCompare(userLabel(right))),
    [knownUsersById, subject],
  )
  const assignedTeachers = useMemo(
    () =>
      (subject?.teacher_ids || [])
        .map((teacherId) => knownUsersById.get(teacherId) || { id: teacherId })
        .sort((left, right) => userLabel(left).localeCompare(userLabel(right))),
    [knownUsersById, subject],
  )
  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase()
    if (!query) return enrolledStudents

    return enrolledStudents.filter((student) => userNameSearchText(student).includes(query))
  }, [enrolledStudents, studentSearch])
  const availableStudents = useMemo(
    () =>
      knownUsers
        .filter(
          (knownUser) =>
            knownUser.role === 'student' && !(subject?.user_ids || []).includes(knownUser.id),
        )
        .sort((left, right) => userLabel(left).localeCompare(userLabel(right))),
    [knownUsers, subject],
  )
  const availableTeachers = useMemo(
    () =>
      knownUsers
        .filter(
          (knownUser) =>
            ['teacher', 'admin'].includes(knownUser.role) &&
            !(subject?.teacher_ids || []).includes(knownUser.id),
        )
        .sort((left, right) => userLabel(left).localeCompare(userLabel(right))),
    [knownUsers, subject],
  )

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [subjectData, projectData, userData] = await Promise.all([
        api.getSubject(session, subjectId),
        api.listProjects(session),
        api.listKnownUsers(session),
      ])
      setSubject(subjectData)
      setProjects(Array.isArray(projectData) ? projectData : projectData.projects || [])
      setKnownUsers(Array.isArray(userData) ? userData : [])
      setStudentToAdd('')
      setStudentSearch('')
      setTeacherToAdd('')
    } catch (loadError) {
      setSubject(null)
      setError(loadError.message || 'Failed to load subject')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [subjectId, token, user])

  async function runMembershipUpdate(action, message) {
    setSaving(true)
    setError('')
    try {
      await action()
      setSuccess(message)
      await loadData()
    } catch (updateError) {
      setError(updateError.message || 'Failed to update subject membership')
    } finally {
      setSaving(false)
    }
  }

  function handleAddStudent() {
    if (!studentToAdd) return
    runMembershipUpdate(
      () => api.addStudentToSubject(session, subject.id, studentToAdd),
      'Student added to subject.',
    )
  }

  function handleRemoveStudent(studentId) {
    runMembershipUpdate(
      () => api.removeStudentFromSubject(session, subject.id, studentId),
      'Student removed from subject.',
    )
  }

  function handleAddTeacher() {
    if (!teacherToAdd) return
    runMembershipUpdate(
      () => api.assignTeacherToSubject(session, subject.id, teacherToAdd),
      'Teacher assigned to subject.',
    )
  }

  function handleRemoveTeacher(teacherId) {
    runMembershipUpdate(
      () => api.removeTeacherFromSubject(session, subject.id, teacherId),
      'Teacher removed from subject.',
    )
  }

  if (loading) {
    return <LoadingState />
  }

  if (!subject) {
    return (
      <>
        <PageHeader
          eyebrow="Subject"
          title="Subject not found"
          subtitle="The requested subject could not be loaded."
          actions={
            <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/subjects')}>
              Back to subjects
            </Button>
          }
        />
        {error && <Alert severity="error">{error}</Alert>}
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow={subject.abbreviation || 'Subject'}
        title={subject.name}
        subtitle={subject.description}
        actions={
          <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/subjects')}>
            Back to subjects
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip icon={<SchoolRoundedIcon />} label={subject.abbreviation} color="secondary" />
            <Chip
              icon={<GroupRoundedIcon />}
              label={`${enrolledStudents.length} student${enrolledStudents.length === 1 ? '' : 's'}`}
              variant="outlined"
            />
            <Chip
              label={`${assignedTeachers.length} teacher${assignedTeachers.length === 1 ? '' : 's'}`}
              variant="outlined"
            />
            <Chip
              label={`${subjectProjects.length} project${subjectProjects.length === 1 ? '' : 's'}`}
              variant="outlined"
            />
          </Stack>
        </Paper>

        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="flex-start">
          <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3, flex: 1 }}>
            <Stack spacing={2}>
              <Typography variant="h6">Students</Typography>
              {isAdmin && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                  <TextField
                    select
                    label="Add student"
                    value={studentToAdd}
                    onChange={(event) => setStudentToAdd(event.target.value)}
                    fullWidth
                    disabled={saving || availableStudents.length === 0}
                  >
                    {availableStudents.map((student) => (
                      <MenuItem key={student.id} value={student.id}>
                        {userLabel(student)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    variant="contained"
                    startIcon={<PersonAddRoundedIcon />}
                    onClick={handleAddStudent}
                    disabled={saving || !studentToAdd}
                    sx={{ minWidth: 120 }}
                  >
                    Add
                  </Button>
                </Stack>
              )}
              {enrolledStudents.length > 0 && (
                <Stack spacing={0.75}>
                  <TextField
                    label="Search students"
                    placeholder="First or last name"
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                    fullWidth
                  />
                  <Typography variant="body2" color="text.secondary">
                    Showing {filteredStudents.length} of {enrolledStudents.length} students
                  </Typography>
                </Stack>
              )}
              <UserList
                emptyText={
                  studentSearch
                    ? 'No students match this search.'
                    : 'No students are enrolled in this subject.'
                }
                maxVisible={20}
                users={filteredStudents}
                removable={isAdmin}
                onRemove={handleRemoveStudent}
              />
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3, flex: 1 }}>
            <Stack spacing={2}>
              <Typography variant="h6">Teachers</Typography>
              {isAdmin && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                  <TextField
                    select
                    label="Assign teacher"
                    value={teacherToAdd}
                    onChange={(event) => setTeacherToAdd(event.target.value)}
                    fullWidth
                    disabled={saving || availableTeachers.length === 0}
                  >
                    {availableTeachers.map((teacher) => (
                      <MenuItem key={teacher.id} value={teacher.id}>
                        {userLabel(teacher)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    variant="contained"
                    startIcon={<PersonAddRoundedIcon />}
                    onClick={handleAddTeacher}
                    disabled={saving || !teacherToAdd}
                    sx={{ minWidth: 120 }}
                  >
                    Add
                  </Button>
                </Stack>
              )}
              <UserList
                emptyText="No teachers are assigned to this subject."
                users={assignedTeachers}
                removable={isAdmin}
                onRemove={handleRemoveTeacher}
              />
            </Stack>
          </Paper>
        </Stack>

        <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3 }}>
          <Stack spacing={2}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={1}
            >
              <Typography variant="h6">
                Projects ({subjectProjects.length})
              </Typography>
              <IconButton
                size="small"
                onClick={() => setProjectsExpanded((value) => !value)}
                aria-label={projectsExpanded ? 'Hide projects' : 'Show projects'}
              >
                {projectsExpanded ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
              </IconButton>
            </Stack>
            <Collapse in={projectsExpanded} unmountOnExit>
              {subjectProjects.length === 0 ? (
                <EmptyState
                  title="No projects in this subject"
                  description="Projects attached to this subject will appear here."
                />
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.5,
                  }}
                >
                  {subjectProjects.map((project) => (
                    <Paper
                      key={project.id}
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1.25,
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700}>
                          {project.title}
                        </Typography>
                        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                          {project.description}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip
                          label={`Teacher: ${userLabel(knownUsersById.get(project.teacher_id))}`}
                          variant="outlined"
                          size="small"
                        />
                        <Chip
                          label={`Max ${project.max_students_per_team} / team`}
                          variant="outlined"
                          size="small"
                        />
                      </Stack>
                      {(project.start_date || project.end_date) && (
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="nowrap">
                          {project.start_date && (
                            <Chip
                              label={`Start ${formatDateOnly(project.start_date)}`}
                              variant="outlined"
                              size="small"
                            />
                          )}
                          {project.end_date && (
                            <Chip
                              label={`End ${formatDateOnly(project.end_date)}`}
                              variant="outlined"
                              size="small"
                            />
                          )}
                        </Stack>
                      )}
                      <Button
                        variant="outlined"
                        startIcon={<LaunchRoundedIcon />}
                        onClick={() => navigate(`/projects/${project.id}`)}
                        sx={{ mt: 'auto', alignSelf: 'flex-start' }}
                      >
                        Open details
                      </Button>
                    </Paper>
                  ))}
                </Box>
              )}
            </Collapse>
          </Stack>
        </Paper>
      </Stack>
    </>
  )
}
