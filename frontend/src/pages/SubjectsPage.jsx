import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import GroupRoundedIcon from '@mui/icons-material/GroupRounded'
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded'
import PlaylistAddRoundedIcon from '@mui/icons-material/PlaylistAddRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { displayUserName, ownTeamForUser } from '../lib/projectView'
import { formatDateOnly } from '../utils/date'

const initialSubjectForm = { name: '', description: '', abbreviation: '' }

function pad(value) {
  return String(value).padStart(2, '0')
}

function dateAtTime(date, hours, minutes, seconds) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

function defaultProjectForm() {
  const today = new Date()
  return {
    title: '',
    description: '',
    subject_id: '',
    max_students_per_team: 3,
    start_date: dateAtTime(today, 0, 0, 0),
    end_date: dateAtTime(today, 23, 59, 59),
  }
}

export default function SubjectsPage() {
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const session = useMemo(() => ({ token, user }), [token, user])
  const [subjects, setSubjects] = useState([])
  const [projects, setProjects] = useState([])
  const [teamsByProject, setTeamsByProject] = useState({})
  const [knownUsers, setKnownUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [collapsedSubjects, setCollapsedSubjects] = useState({})
  const [deleteSubjectTarget, setDeleteSubjectTarget] = useState(null)

  function toggleSubjectCollapsed(subjectId) {
    setCollapsedSubjects((current) => ({
      ...current,
      [subjectId]: !current[subjectId],
    }))
  }
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState(null)
  const [subjectForm, setSubjectForm] = useState(initialSubjectForm)
  const [projectForm, setProjectForm] = useState(defaultProjectForm())
  const [subjectFormError, setSubjectFormError] = useState('')
  const [projectFormError, setProjectFormError] = useState('')
  const [subjectSubmitting, setSubjectSubmitting] = useState(false)
  const [projectSubmitting, setProjectSubmitting] = useState(false)
  const [teamDialogOpen, setTeamDialogOpen] = useState(false)
  const [teamDialogProjectId, setTeamDialogProjectId] = useState(null)
  const [teamNameInput, setTeamNameInput] = useState('')
  const [teamDialogError, setTeamDialogError] = useState('')
  const [creatingTeam, setCreatingTeam] = useState(false)

  const knownUsersById = useMemo(
    () => new Map(knownUsers.map((knownUser) => [knownUser.id, knownUser])),
    [knownUsers],
  )
  const projectsBySubjectId = useMemo(
    () =>
      projects.reduce((accumulator, project) => {
        accumulator[project.subject_id] = [...(accumulator[project.subject_id] || []), project]
        return accumulator
      }, {}),
    [projects],
  )

  // Subjects in which the current student is on at least one team. Used to hide the
  // "Leave subject" button — leaving a subject while still belonging to a team there
  // would leave that team in an inconsistent state.
  const subjectsWhereStudentHasTeam = useMemo(() => {
    const studentId = user?.id
    if (!studentId) return new Set()
    const result = new Set()
    for (const project of projects) {
      const teams = teamsByProject[project.id] || []
      if (teams.some((team) => (team.student_ids || []).includes(studentId))) {
        result.add(project.subject_id)
      }
    }
    return result
  }, [projects, teamsByProject, user?.id])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      // Single bundled call replaces listProjects + per-project listTeamsByProject (was N+1).
      const [subjectData, projectsBundle, userData] = await Promise.all([
        api.listSubjects(session),
        api.listProjectsWithTeams(session),
        api.listUsers(session),
      ])

      const nextSubjects = Array.isArray(subjectData) ? subjectData : subjectData.subjects || []
      const bundle = Array.isArray(projectsBundle) ? projectsBundle : []
      const nextProjects = bundle.map((entry) => entry.project).filter(Boolean)
      const nextTeamsByProject = Object.fromEntries(
        bundle
          .filter((entry) => entry.project?.id)
          .map((entry) => [entry.project.id, entry.teams || []]),
      )

      setSubjects(nextSubjects)
      setProjects(nextProjects)
      setKnownUsers(Array.isArray(userData) ? userData : [])
      setTeamsByProject(nextTeamsByProject)
    } catch (loadError) {
      setError(loadError.message || 'Failed to load subject workspace')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [token, user])

  async function handleRegisterSubject(subjectId) {
    try {
      await api.registerSubject(session, subjectId)
      setSuccess('Subject registration recorded.')
      await loadData()
    } catch (registerError) {
      setError(registerError.message || 'Failed to register to subject')
    }
  }

  async function handleLeaveSubject(subjectId) {
    try {
      await api.leaveSubject(session, subjectId)
      setSuccess('Unenrolled from subject.')
      await loadData()
    } catch (leaveError) {
      setError(leaveError.message || 'Failed to leave subject')
    }
  }

  function validateSubjectForm() {
    if (!subjectForm.name.trim()) return 'Subject name is required.'
    if (!subjectForm.abbreviation.trim()) return 'Abbreviation is required.'
    if (!subjectForm.description.trim()) return 'Description is required.'
    return ''
  }

  function closeSubjectDialog() {
    setSubjectDialogOpen(false)
    setEditingSubject(null)
    setSubjectForm(initialSubjectForm)
    setSubjectFormError('')
  }

  async function handleSaveSubject() {
    setSubjectFormError('')
    const validationError = validateSubjectForm()
    if (validationError) {
      setSubjectFormError(validationError)
      return
    }
    setSubjectSubmitting(true)
    try {
      const payload = {
        name: subjectForm.name.trim(),
        abbreviation: subjectForm.abbreviation.trim(),
        description: subjectForm.description.trim(),
      }
      if (editingSubject) {
        await api.updateSubject(session, editingSubject.id, payload)
        setSuccess('Subject updated.')
      } else {
        await api.createSubject(session, payload)
        setSuccess('Subject created.')
      }
      closeSubjectDialog()
      await loadData()
    } catch (saveError) {
      setSubjectFormError(
        saveError.message ||
          (editingSubject ? 'Failed to update subject.' : 'Subject was not created.'),
      )
    } finally {
      setSubjectSubmitting(false)
    }
  }

  async function handleDeleteSubject() {
    if (!deleteSubjectTarget) return
    try {
      await api.deleteSubject(session, deleteSubjectTarget.id)
      setSuccess('Subject deleted.')
      setDeleteSubjectTarget(null)
      await loadData()
    } catch (deleteError) {
      setError(deleteError.message || 'Failed to delete subject')
    }
  }

  function validateProjectForm() {
    if (!projectForm.title.trim()) return 'Project title is required.'
    if (!projectForm.description.trim()) return 'Project description is required.'
    if (!projectForm.subject_id) return 'Pick a subject for the project.'
    const max = Number(projectForm.max_students_per_team)
    if (!Number.isFinite(max) || max < 1) {
      return 'Max students per team must be at least 1.'
    }
    if (projectForm.start_date && projectForm.end_date) {
      const start = new Date(projectForm.start_date)
      const end = new Date(projectForm.end_date)
      if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && start > end) {
        return 'Start date must be on or before the end date.'
      }
    }
    return ''
  }

  function closeProjectDialog() {
    setProjectDialogOpen(false)
    setProjectForm(defaultProjectForm())
    setProjectFormError('')
  }

  async function handleCreateProject() {
    setProjectFormError('')
    const validationError = validateProjectForm()
    if (validationError) {
      setProjectFormError(validationError)
      return
    }
    setProjectSubmitting(true)
    try {
      await api.createProject(session, {
        ...projectForm,
        title: projectForm.title.trim(),
        description: projectForm.description.trim(),
      })
      closeProjectDialog()
      setSuccess('Project created.')
      await loadData()
    } catch (createError) {
      setProjectFormError(createError.message || 'Project was not created.')
    } finally {
      setProjectSubmitting(false)
    }
  }

  function openCreateTeamDialog(projectId) {
    setTeamDialogProjectId(projectId)
    setTeamNameInput('')
    setTeamDialogError('')
    setTeamDialogOpen(true)
  }

  function closeCreateTeamDialog() {
    setTeamDialogOpen(false)
    setTeamDialogProjectId(null)
    setTeamDialogError('')
    setTeamNameInput('')
  }

  async function handleCreateTeam() {
    if (!teamDialogProjectId) return
    const trimmedName = teamNameInput.trim()
    if (!trimmedName) {
      setTeamDialogError('Team name is required.')
      return
    }
    setCreatingTeam(true)
    try {
      await api.registerTeam(session, teamDialogProjectId, trimmedName)
      const projectId = teamDialogProjectId
      closeCreateTeamDialog()
      setSuccess(`Team "${trimmedName}" created.`)
      await loadData()
      navigate(`/projects/${projectId}?tab=team`)
    } catch (createError) {
      setTeamDialogError(createError.message || 'Failed to create team')
    } finally {
      setCreatingTeam(false)
    }
  }

  function openSubjectEditor(subject) {
    setSubjectFormError('')
    setEditingSubject(subject)
    setSubjectForm(
      subject
        ? {
            name: subject.name,
            description: subject.description,
            abbreviation: subject.abbreviation,
          }
        : initialSubjectForm,
    )
    setSubjectDialogOpen(true)
  }

  function openProjectCreator(subjectId = '') {
    setProjectFormError('')
    setProjectForm({
      ...defaultProjectForm(),
      subject_id: subjectId || subjects[0]?.id || '',
    })
    setProjectDialogOpen(true)
  }

  if (loading) {
    return <LoadingState />
  }

  return (
    <>
      <PageHeader
        eyebrow="Subjects"
        title="Subjects and available projects"
        subtitle="Start from a subject, inspect its project options, then move into teams and submissions from there."
        actions={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            {['teacher', 'admin'].includes(user?.role) && (
              <Button
                variant="contained"
                startIcon={<PlaylistAddRoundedIcon />}
                onClick={() => openProjectCreator()}
              >
                Create project
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                variant="outlined"
                startIcon={<AddRoundedIcon />}
                onClick={() => openSubjectEditor(null)}
              >
                Create subject
              </Button>
            )}
          </Stack>
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

      {!subjects.length ? (
        <EmptyState
          title="No subjects available"
          description="Create a subject first, then attach projects to it so teams can form around those projects."
          actionLabel={user?.role === 'admin' ? 'Create subject' : undefined}
          onAction={user?.role === 'admin' ? () => openSubjectEditor(null) : undefined}
        />
      ) : (
        <Stack spacing={3}>
          {subjects.map((subject) => {
            const subjectProjects = projectsBySubjectId[subject.id] || []
            const teacherNames = (subject.teacher_ids || [])
              .map((teacherId) => displayUserName(knownUsersById.get(teacherId)))
              .filter(Boolean)

            return (
              <Card key={subject.id}>
                <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
                  <Stack spacing={3}>
                    <Stack
                      direction={{ xs: 'column', lg: 'row' }}
                      spacing={2.5}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', lg: 'center' }}
                    >
                      <Stack direction="row" spacing={2} sx={{ minWidth: 0 }}>
                        <Box
                          sx={(theme) => ({
                            width: 54,
                            height: 54,
                            borderRadius: 3,
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: alpha(theme.palette.primary.main, 0.12),
                            color: 'primary.main',
                            flexShrink: 0,
                          })}
                        >
                          <SchoolRoundedIcon />
                        </Box>
                        <Stack spacing={1} sx={{ minWidth: 0 }}>
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1.25}
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                          >
                            <Typography variant="h5">{subject.name}</Typography>
                            <Chip label={subject.abbreviation} color="secondary" size="small" />
                          </Stack>
                          <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                            {subject.description}
                          </Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip
                              label={`${subjectProjects.length} project${subjectProjects.length === 1 ? '' : 's'}`}
                              variant="outlined"
                              size="small"
                            />
                            <Chip
                              label={`${(subject.user_ids || []).length} enrolled student${(subject.user_ids || []).length === 1 ? '' : 's'}`}
                              variant="outlined"
                              size="small"
                            />
                            {teacherNames.length > 0 && (
                              <Chip
                                label={`Teachers: ${teacherNames.join(', ')}`}
                                variant="outlined"
                                size="small"
                              />
                            )}
                          </Stack>
                        </Stack>
                      </Stack>

                      <Stack direction={{ xs: 'row', sm: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
                        <Button
                          variant="outlined"
                          startIcon={<LaunchRoundedIcon />}
                          onClick={() => navigate(`/subjects/${subject.id}`)}
                        >
                          Open details
                        </Button>
                        {user?.role === 'student' &&
                          !(subject.user_ids || []).includes(user?.id) && (
                            <Button
                              variant="outlined"
                              onClick={() => handleRegisterSubject(subject.id)}
                            >
                              Register to subject
                            </Button>
                          )}
                        {user?.role === 'student' &&
                          (subject.user_ids || []).includes(user?.id) &&
                          !subjectsWhereStudentHasTeam.has(subject.id) && (
                            <Button
                              color="error"
                              variant="outlined"
                              onClick={() => handleLeaveSubject(subject.id)}
                            >
                              Leave subject
                            </Button>
                          )}
                        {['teacher', 'admin'].includes(user?.role) && (
                          <Button
                            variant="contained"
                            startIcon={<PlaylistAddRoundedIcon />}
                            onClick={() => openProjectCreator(subject.id)}
                          >
                            Add project
                          </Button>
                        )}
                        {user?.role === 'admin' && (
                          <>
                            <Button
                              variant="outlined"
                              startIcon={<EditRoundedIcon />}
                              onClick={() => openSubjectEditor(subject)}
                            >
                              Edit subject
                            </Button>
                            <Button
                              color="error"
                              variant="outlined"
                              startIcon={<DeleteRoundedIcon />}
                              onClick={() => setDeleteSubjectTarget(subject)}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </Stack>
                    </Stack>

                    <Box>
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        spacing={1}
                      >
                        <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700 }}>
                          Projects In This Subject ({subjectProjects.length})
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => toggleSubjectCollapsed(subject.id)}
                          aria-label={
                            collapsedSubjects[subject.id] ? 'Show projects' : 'Hide projects'
                          }
                        >
                          {collapsedSubjects[subject.id] ? (
                            <ExpandMoreRoundedIcon />
                          ) : (
                            <ExpandLessRoundedIcon />
                          )}
                        </IconButton>
                      </Stack>
                      <Collapse in={!collapsedSubjects[subject.id]} unmountOnExit>
                        {subjectProjects.length === 0 ? (
                          <Paper
                            variant="outlined"
                            sx={{
                              mt: 1.5,
                              p: 2.5,
                              borderStyle: 'dashed',
                              color: 'text.secondary',
                            }}
                          >
                            No projects have been attached to this subject yet.
                          </Paper>
                        ) : (
                          <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                            {subjectProjects.map((project) => {
                              const projectTeams = teamsByProject[project.id] || []
                              const ownTeam = user?.id
                                ? ownTeamForUser(projectTeams, user.id)
                                : null

                              return (
                                <Paper
                                  key={project.id}
                                  variant="outlined"
                                  sx={{
                                    p: 2.25,
                                    borderRadius: 3,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1.5,
                                  }}
                                >
                                  <Box
                                    sx={{
                                      display: 'grid',
                                      gridTemplateColumns: {
                                        xs: '1fr',
                                        sm: 'minmax(0, 1fr) 240px',
                                      },
                                      columnGap: 2.5,
                                      rowGap: 1.5,
                                      alignItems: 'start',
                                    }}
                                  >
                                    <Box sx={{ minWidth: 0 }}>
                                      <Typography variant="h6">{project.title}</Typography>
                                      <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                                        {project.description}
                                      </Typography>
                                    </Box>
                                    <Stack
                                      spacing={1}
                                      sx={{
                                        alignItems: { xs: 'flex-start', sm: 'flex-end' },
                                      }}
                                    >
                                      <Chip
                                        icon={<GroupRoundedIcon />}
                                        label={`${projectTeams.length} team${projectTeams.length === 1 ? '' : 's'}`}
                                        variant="outlined"
                                        size="small"
                                      />
                                      <Chip
                                        label={`Teacher: ${displayUserName(knownUsersById.get(project.teacher_id))}`}
                                        variant="outlined"
                                        size="small"
                                      />
                                      <Chip
                                        label={`Max ${project.max_students_per_team} / team`}
                                        variant="outlined"
                                        size="small"
                                      />
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
                                    </Stack>
                                  </Box>

                                  <Stack
                                    direction="row"
                                    spacing={1}
                                    flexWrap="wrap"
                                    useFlexGap
                                    sx={{ mt: 'auto' }}
                                  >
                                    <Button
                                      variant="outlined"
                                      startIcon={<LaunchRoundedIcon />}
                                      onClick={() => navigate(`/projects/${project.id}`)}
                                    >
                                      Open details
                                    </Button>
                                    <Button
                                      variant="text"
                                      onClick={() => navigate(`/projects/${project.id}?tab=team`)}
                                    >
                                      View teams
                                    </Button>
                                    {user?.role === 'student' &&
                                      !ownTeam &&
                                      (subject.user_ids || []).includes(user?.id) && (
                                        <Button
                                          variant="contained"
                                          onClick={() => openCreateTeamDialog(project.id)}
                                        >
                                          Create team
                                        </Button>
                                      )}
                                    {user?.role === 'student' && ownTeam && (
                                      <Button
                                        variant="contained"
                                        onClick={() => navigate(`/projects/${project.id}?tab=team`)}
                                      >
                                        Open my team
                                      </Button>
                                    )}
                                  </Stack>
                                </Paper>
                              )
                            })}
                          </Stack>
                        )}
                      </Collapse>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            )
          })}
        </Stack>
      )}

      <Dialog open={subjectDialogOpen} onClose={closeSubjectDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editingSubject ? 'Edit subject' : 'Create subject'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {subjectFormError && (
              <Alert severity="error" onClose={() => setSubjectFormError('')}>
                {subjectFormError}
              </Alert>
            )}
            <TextField
              required
              label="Name"
              value={subjectForm.name}
              onChange={(event) =>
                setSubjectForm((current) => ({ ...current, name: event.target.value }))
              }
              fullWidth
            />
            <TextField
              required
              label="Abbreviation"
              value={subjectForm.abbreviation}
              onChange={(event) =>
                setSubjectForm((current) => ({ ...current, abbreviation: event.target.value }))
              }
              fullWidth
            />
            <TextField
              required
              label="Description"
              value={subjectForm.description}
              onChange={(event) =>
                setSubjectForm((current) => ({ ...current, description: event.target.value }))
              }
              fullWidth
              multiline
              minRows={4}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeSubjectDialog} disabled={subjectSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSaveSubject} variant="contained" disabled={subjectSubmitting}>
            {subjectSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={projectDialogOpen} onClose={closeProjectDialog} fullWidth maxWidth="sm">
        <DialogTitle>Create project</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {projectFormError && (
              <Alert severity="error" onClose={() => setProjectFormError('')}>
                {projectFormError}
              </Alert>
            )}
            <TextField
              required
              label="Title"
              value={projectForm.title}
              onChange={(event) =>
                setProjectForm((current) => ({ ...current, title: event.target.value }))
              }
              fullWidth
            />
            <TextField
              required
              label="Description"
              value={projectForm.description}
              onChange={(event) =>
                setProjectForm((current) => ({ ...current, description: event.target.value }))
              }
              fullWidth
              multiline
              minRows={4}
            />
            <TextField
              required
              select
              label="Subject"
              value={projectForm.subject_id}
              onChange={(event) =>
                setProjectForm((current) => ({ ...current, subject_id: event.target.value }))
              }
              fullWidth
            >
              {subjects.map((subject) => (
                <MenuItem key={subject.id} value={subject.id}>
                  {subject.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              required
              label="Max students per team"
              type="number"
              inputProps={{ min: 1 }}
              value={projectForm.max_students_per_team}
              onChange={(event) =>
                setProjectForm((current) => ({
                  ...current,
                  max_students_per_team: Math.max(Number(event.target.value) || 1, 1),
                }))
              }
              fullWidth
            />
            <TextField
              label="Start date"
              type="datetime-local"
              value={projectForm.start_date}
              onChange={(event) =>
                setProjectForm((current) => ({ ...current, start_date: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="End date"
              type="datetime-local"
              value={projectForm.end_date}
              onChange={(event) =>
                setProjectForm((current) => ({ ...current, end_date: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeProjectDialog} disabled={projectSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleCreateProject} variant="contained" disabled={projectSubmitting}>
            {projectSubmitting ? 'Creating…' : 'Save project'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(deleteSubjectTarget)}
        onClose={() => setDeleteSubjectTarget(null)}
        maxWidth="xs"
      >
        <DialogTitle>Delete subject</DialogTitle>
        <DialogContent>
          <Typography>
            Delete <strong>{deleteSubjectTarget?.name}</strong>? Attached projects, teams, and
            registrations will be removed. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteSubjectTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteSubject}>
            Delete subject
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={teamDialogOpen} onClose={closeCreateTeamDialog} fullWidth maxWidth="xs">
        <DialogTitle>Create team</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {teamDialogError && (
              <Alert severity="error" onClose={() => setTeamDialogError('')}>
                {teamDialogError}
              </Alert>
            )}
            <TextField
              required
              autoFocus
              label="Team name"
              value={teamNameInput}
              onChange={(event) => setTeamNameInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !creatingTeam) {
                  event.preventDefault()
                  handleCreateTeam()
                }
              }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCreateTeamDialog} disabled={creatingTeam}>
            Cancel
          </Button>
          <Button onClick={handleCreateTeam} variant="contained" disabled={creatingTeam}>
            {creatingTeam ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
