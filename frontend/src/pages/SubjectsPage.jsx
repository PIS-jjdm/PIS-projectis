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
import { displayUserName, ownTeamForUser, resolveKnownUser } from '../lib/projectView'
import { formatDateOnly } from '../utils/date'

const initialSubjectForm = { name: '', description: '', abbreviation: '' }
const initialProjectForm = {
  title: '',
  description: '',
  subject_id: '',
  max_students_per_team: 3,
  start_date: '',
  end_date: '',
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
  const [projectForm, setProjectForm] = useState(initialProjectForm)

  const knownUsersById = useMemo(
    () => new Map(knownUsers.map((knownUser) => [knownUser.id, knownUser])),
    [knownUsers],
  )
  const effectiveUser = useMemo(() => resolveKnownUser(knownUsers, user), [knownUsers, user])
  const projectsBySubjectId = useMemo(
    () =>
      projects.reduce((accumulator, project) => {
        accumulator[project.subject_id] = [...(accumulator[project.subject_id] || []), project]
        return accumulator
      }, {}),
    [projects],
  )

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [subjectData, projectData, userData] = await Promise.all([
        api.listSubjects(session),
        api.listProjects(session),
        api.listKnownUsers(session),
      ])

      const nextSubjects = Array.isArray(subjectData) ? subjectData : subjectData.subjects || []
      const nextProjects = Array.isArray(projectData) ? projectData : projectData.projects || []
      const teamLists = await Promise.all(
        nextProjects.map(async (project) => ({
          projectId: project.id,
          teams: await api.listTeamsByProject(session, project.id),
        })),
      )

      setSubjects(nextSubjects)
      setProjects(nextProjects)
      setKnownUsers(Array.isArray(userData) ? userData : [])
      setTeamsByProject(Object.fromEntries(teamLists.map((item) => [item.projectId, item.teams])))
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

  async function handleSaveSubject() {
    try {
      if (editingSubject) {
        await api.updateSubject(session, editingSubject.id, subjectForm)
        setSuccess('Subject updated.')
      } else {
        await api.createSubject(session, subjectForm)
        setSuccess('Subject created.')
      }
      setSubjectDialogOpen(false)
      setEditingSubject(null)
      setSubjectForm(initialSubjectForm)
      await loadData()
    } catch (saveError) {
      setError(saveError.message || 'Failed to save subject')
    }
  }

  async function handleDeleteSubject(subjectId) {
    try {
      await api.deleteSubject(session, subjectId)
      setSuccess('Subject deleted.')
      await loadData()
    } catch (deleteError) {
      setError(deleteError.message || 'Failed to delete subject')
    }
  }

  async function handleCreateProject() {
    try {
      await api.createProject(session, projectForm)
      setProjectDialogOpen(false)
      setProjectForm(initialProjectForm)
      setSuccess('Project created.')
      await loadData()
    } catch (createError) {
      setError(createError.message || 'Failed to create project')
    }
  }

  async function handleCreateTeam(projectId) {
    try {
      await api.registerTeam(session, projectId)
      setSuccess('Team created for this project.')
      await loadData()
      navigate(`/projects/${projectId}?tab=team`)
    } catch (createError) {
      setError(createError.message || 'Failed to create team')
    }
  }

  function openSubjectEditor(subject) {
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
    setProjectForm({
      ...initialProjectForm,
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
                              onClick={() => handleDeleteSubject(subject.id)}
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
                          <Box
                            sx={{
                              mt: 1.5,
                              display: 'grid',
                              gridTemplateColumns: {
                                xs: '1fr',
                                md: 'repeat(2, minmax(0, 1fr))',
                              },
                              gap: 1.5,
                            }}
                          >
                            {subjectProjects.map((project) => {
                              const projectTeams = teamsByProject[project.id] || []
                              const ownTeam = effectiveUser
                                ? ownTeamForUser(projectTeams, effectiveUser.id)
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
                                    gap: 1.25,
                                  }}
                                >
                                  <Box>
                                    <Typography variant="h6">{project.title}</Typography>
                                    <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                                      {project.description}
                                    </Typography>
                                  </Box>
                                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
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
                                  </Stack>
                                  {(project.start_date || project.end_date) && (
                                    <Stack
                                      direction="row"
                                      spacing={1}
                                      useFlexGap
                                      flexWrap="nowrap"
                                    >
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
                                    {effectiveUser?.role === 'student' && !ownTeam && (
                                      <Button
                                        variant="contained"
                                        onClick={() => handleCreateTeam(project.id)}
                                      >
                                        Create team
                                      </Button>
                                    )}
                                    {effectiveUser?.role === 'student' && ownTeam && (
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
                          </Box>
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

      <Dialog open={subjectDialogOpen} onClose={() => setSubjectDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingSubject ? 'Edit subject' : 'Create subject'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={subjectForm.name}
              onChange={(event) =>
                setSubjectForm((current) => ({ ...current, name: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Abbreviation"
              value={subjectForm.abbreviation}
              onChange={(event) =>
                setSubjectForm((current) => ({ ...current, abbreviation: event.target.value }))
              }
              fullWidth
            />
            <TextField
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
          <Button onClick={() => setSubjectDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveSubject} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={projectDialogOpen} onClose={() => setProjectDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create project</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              value={projectForm.title}
              onChange={(event) =>
                setProjectForm((current) => ({ ...current, title: event.target.value }))
              }
              fullWidth
            />
            <TextField
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
              label="Max students per team"
              type="number"
              value={projectForm.max_students_per_team}
              onChange={(event) =>
                setProjectForm((current) => ({
                  ...current,
                  max_students_per_team: Number(event.target.value) || 1,
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
          <Button onClick={() => setProjectDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateProject} variant="contained">
            Save project
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
