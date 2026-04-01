import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import GroupRoundedIcon from '@mui/icons-material/GroupRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import HelpCenterRoundedIcon from '@mui/icons-material/HelpCenterRounded'
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useEffect, useMemo, useState } from 'react'
import LoadingState from '../components/LoadingState'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { formatDateOnly } from '../utils/date'

const initialProjectForm = {
  title: '',
  description: '',
  subject_id: '',
  max_students_per_team: 3,
  start_date: '',
  end_date: '',
}

const wizardSteps = [
  { id: 1, phase: 'Active Step', label: 'Project Info' },
  { id: 2, phase: 'Upcoming', label: 'Team Members' },
  { id: 3, phase: 'Upcoming', label: 'File Upload' },
  { id: 4, phase: 'Upcoming', label: 'Review & Submit' },
]

export default function ProjectsPage() {
  const { token, user } = useAuth()
  const session = useMemo(() => ({ token, user }), [token, user])

  const [projects, setProjects] = useState([])
  const [subjects, setSubjects] = useState([])
  const [teams, setTeams] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [memberDialogOpen, setMemberDialogOpen] = useState(false)
  const [form, setForm] = useState(initialProjectForm)
  const [memberStudentId, setMemberStudentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [teamError, setTeamError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmitProject = ['teacher', 'admin'].includes(user?.role)
  const canCreateTeam = user?.role === 'student'

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [projectData, subjectData] = await Promise.all([
        api.listProjects(session),
        api.listSubjects(session),
      ])
      setProjects(Array.isArray(projectData) ? projectData : projectData.projects || [])
      setSubjects(Array.isArray(subjectData) ? subjectData : subjectData.subjects || [])
    } catch (err) {
      setError(err.message || 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [token, user])

  async function openProject(project) {
    setSelectedProject(project)
    setTeamError('')
    try {
      const projectTeams = await api.listTeamsByProject(session, project.id)
      setTeams(Array.isArray(projectTeams) ? projectTeams : projectTeams.teams || [])
    } catch (err) {
      setTeams([])
      setTeamError(err.message || 'Failed to load teams for this project')
    }
  }

  async function handleRegisterTeam(projectId) {
    setError('')
    setSuccess('')
    try {
      await api.registerTeam(session, projectId)
      setSuccess('Team created successfully.')
      const project = projects.find((item) => item.id === projectId)
      if (project) {
        await openProject(project)
      }
    } catch (err) {
      setError(err.message || 'Failed to create team')
    }
  }

  async function handleCreateProject() {
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      await api.createProject(session, form)
      setSuccess('Project submitted successfully.')
      setForm(initialProjectForm)
      await loadData()
    } catch (err) {
      setError(err.message || 'Failed to create project')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAddMember() {
    if (!teams[0]?.id) return
    setError('')
    setSuccess('')
    try {
      await api.addTeamMember(session, teams[0].id, memberStudentId)
      setSuccess('Team member added successfully.')
      setMemberDialogOpen(false)
      setMemberStudentId('')
      if (selectedProject) {
        await openProject(selectedProject)
      }
    } catch (err) {
      setError(err.message || 'Failed to add team member')
    }
  }

  if (loading) return <LoadingState />

  return (
    <Box>
      <Box sx={{ mb: 6 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Typography
            variant="caption"
            sx={{
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              fontWeight: 700,
              color: 'primary.main',
            }}
          >
            Research Submission
          </Typography>
          <Box sx={{ width: 48, height: 1, bgcolor: 'rgba(69,95,136,0.3)' }} />
        </Stack>
        <Typography
          variant="h3"
          sx={{ fontSize: { xs: 34, md: 48 }, mb: 2, color: 'text.primary' }}
        >
          {canSubmitProject ? 'New Project Submission' : 'Projects & Team Assembly'}
        </Typography>
        <Typography
          sx={{
            fontSize: { xs: 16, md: 18 },
            color: 'text.secondary',
            maxWidth: 720,
            lineHeight: 1.7,
          }}
        >
          {canSubmitProject
            ? 'Follow the curated steps to formalize your research project within the institutional repository. Clarity and detail at this stage ensure seamless archiving.'
            : 'Browse the available projects, inspect deadlines, and create a team around the work you want to pursue.'}
        </Typography>
      </Box>

      {error && <Alert severity="warning" sx={{ mb: 3 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

      {canSubmitProject ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 4, alignItems: 'start', mb: 6 }}>
          <Box sx={{ gridColumn: { xs: '1 / -1', lg: 'span 3' } }}>
            <Stack
              spacing={2}
              sx={{
                flexDirection: { xs: 'row', lg: 'column' },
                overflowX: { xs: 'auto', lg: 'visible' },
                pb: { xs: 2, lg: 0 },
              }}
            >
              {wizardSteps.map((step, index) => (
                <Stack key={step.id} spacing={2}>
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ flexShrink: 0, opacity: step.id === 1 ? 1 : 0.5 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        bgcolor: step.id === 1 ? 'primary.main' : '#dfeaef',
                        color: step.id === 1 ? '#f6f7ff' : 'text.secondary',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 700,
                        boxShadow: step.id === 1 ? '0 10px 24px rgba(69,95,136,0.2)' : 'none',
                      }}
                    >
                      {step.id}
                    </Box>
                    <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          color: step.id === 1 ? 'primary.main' : 'text.secondary',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.16em',
                        }}
                      >
                        {step.phase}
                      </Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: step.id === 1 ? 700 : 500 }}>
                        {step.label}
                      </Typography>
                    </Box>
                  </Stack>
                  {index < wizardSteps.length - 1 && (
                    <Box sx={{ display: { xs: 'none', lg: 'block' }, ml: 2.5, width: 1, height: 32, bgcolor: 'rgba(167,180,186,0.3)' }} />
                  )}
                </Stack>
              ))}
            </Stack>
          </Box>

          <Paper sx={{ gridColumn: { xs: '1 / -1', lg: 'span 9' }, p: { xs: 3, md: 4 }, borderRadius: 3, boxShadow: 'none' }}>
            <Stack component="form" spacing={4} onSubmit={(event) => event.preventDefault()}>
              <Box>
                <Typography
                  variant="caption"
                  sx={{ display: 'block', mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700 }}
                >
                  Project Title
                </Typography>
                <TextField
                  fullWidth
                  placeholder="Enter the full scholarly title of your research..."
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  slotProps={{ input: { sx: { fontSize: 18, fontWeight: 500, py: 1.1 } } }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
                  Ensure your title is descriptive and follows the APA capitalization standards.
                </Typography>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 4 }}>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700 }}
                  >
                    Research Area
                  </Typography>
                  <TextField
                    select
                    fullWidth
                    value={form.subject_id}
                    onChange={(event) => setForm((prev) => ({ ...prev, subject_id: event.target.value }))}
                    SelectProps={{ IconComponent: ExpandMoreRoundedIcon }}
                  >
                    <MenuItem value="">Select discipline...</MenuItem>
                    {subjects.map((subject) => (
                      <MenuItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>

                <Box>
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700 }}
                  >
                    Expected Completion
                  </Typography>
                  <TextField
                    fullWidth
                    type="date"
                    value={form.end_date}
                    onChange={(event) => setForm((prev) => ({ ...prev, end_date: event.target.value }))}
                    slotProps={{
                      inputLabel: { shrink: true },
                      input: {
                        endAdornment: <CalendarTodayRoundedIcon sx={{ color: 'text.secondary', ml: 1 }} />,
                      },
                    }}
                  />
                </Box>
              </Box>

              <Box>
                <Typography
                  variant="caption"
                  sx={{ display: 'block', mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700 }}
                >
                  Abstract / Summary
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={6}
                  placeholder="Provide a concise overview of your research objectives, methodology, and anticipated outcomes..."
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                />
                <Stack direction="row" justifyContent="space-between" sx={{ mt: 1, px: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Character Limit: {form.description.length} / 2500
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700 }}>
                    Recommended: 250 - 500 words
                  </Typography>
                </Stack>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 4 }}>
                <Box>
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700 }}
                  >
                    Start Date
                  </Typography>
                  <TextField
                    fullWidth
                    type="date"
                    value={form.start_date}
                    onChange={(event) => setForm((prev) => ({ ...prev, start_date: event.target.value }))}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Box>

                <Box>
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', mb: 1, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700 }}
                  >
                    Max Students Per Team
                  </Typography>
                  <TextField
                    fullWidth
                    type="number"
                    value={form.max_students_per_team}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, max_students_per_team: event.target.value }))
                    }
                  />
                </Box>
              </Box>

              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ pt: 4, borderTop: '1px solid rgba(231,239,243,1)' }}
              >
                <Button
                  startIcon={<CloseRoundedIcon />}
                  onClick={() => setForm(initialProjectForm)}
                  sx={{ color: 'text.secondary', fontWeight: 600 }}
                >
                  Save as Draft
                </Button>

                <Button
                  variant="contained"
                  endIcon={<ArrowForwardRoundedIcon />}
                  onClick={handleCreateProject}
                  disabled={submitting}
                  sx={{
                    px: 4,
                    py: 1.8,
                    boxShadow: '0 10px 28px rgba(69,95,136,0.2)',
                  }}
                >
                  {submitting ? 'Submitting...' : 'Next Step'}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Box>
      ) : null}

      <Box sx={{ mt: canSubmitProject ? 2 : 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ color: 'primary.main', fontSize: 24 }}>
            {canSubmitProject ? 'Current Submissions' : 'Project Gallery'}
          </Typography>
          {!canSubmitProject && (
            <Button variant="outlined" startIcon={<AddRoundedIcon />} disabled>
              Create New Team
            </Button>
          )}
        </Stack>

        {projects.length === 0 ? (
          <Paper sx={{ p: 4, borderRadius: 3, boxShadow: 'none' }}>
            <Typography variant="h6">No projects available</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Create a project to start the submission cycle or verify that the project service is reachable.
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, 1fr)' }, gap: 3 }}>
            {projects.map((project, index) => {
              const subject = subjects.find((item) => item.id === project.subject_id)
              const accent = index % 2 === 0 ? '#d6e3ff' : '#75aef7'
              const chipBg = index % 2 === 0 ? 'rgba(214,227,255,0.7)' : 'rgba(117,174,247,0.24)'
              return (
                <Paper key={project.id} sx={{ p: 3, borderRadius: 3, boxShadow: 'none' }}>
                  <Stack spacing={2.5}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Chip
                          size="small"
                          label={subject?.name || project.subject_id || 'Research'}
                          sx={{ mb: 1.5, bgcolor: chipBg, color: 'primary.main', fontWeight: 700 }}
                        />
                        <Typography variant="h6" sx={{ fontSize: 22, mb: 1 }}>
                          {project.title}
                        </Typography>
                        <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                          {project.description}
                        </Typography>
                      </Box>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: accent, mt: 1 }} />
                    </Box>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} useFlexGap flexWrap="wrap">
                      <Chip icon={<CalendarTodayRoundedIcon />} label={`Start ${formatDateOnly(project.start_date)}`} variant="outlined" />
                      <Chip icon={<CalendarTodayRoundedIcon />} label={`End ${formatDateOnly(project.end_date)}`} variant="outlined" />
                      <Chip icon={<GroupRoundedIcon />} label={`${project.max_students_per_team} / team`} variant="outlined" />
                    </Stack>

                    <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                      <Button variant="outlined" startIcon={<LaunchRoundedIcon />} onClick={() => openProject(project)}>
                        View Details
                      </Button>
                      {canCreateTeam && (
                        <Button variant="contained" onClick={() => handleRegisterTeam(project.id)}>
                          Join Team
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              )
            })}
          </Box>
        )}
      </Box>

      <Dialog open={Boolean(selectedProject)} onClose={() => setSelectedProject(null)} fullWidth maxWidth="md">
        <DialogTitle>{selectedProject?.title}</DialogTitle>
        <DialogContent>
          {selectedProject && (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <Typography variant="body1">{selectedProject.description}</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} useFlexGap flexWrap="wrap">
                <Chip label={`Start: ${formatDateOnly(selectedProject.start_date)}`} />
                <Chip label={`End: ${formatDateOnly(selectedProject.end_date)}`} />
                <Chip label={`Max students/team: ${selectedProject.max_students_per_team}`} />
              </Stack>
              {teamError && <Alert severity="warning">{teamError}</Alert>}
              <Typography variant="h6" sx={{ mt: 1 }}>Team Listings</Typography>
              {!teams.length ? (
                <Typography color="text.secondary">No teams registered for this project yet.</Typography>
              ) : (
                <Stack spacing={1.5}>
                  {teams.map((team) => (
                    <Paper key={team.id} variant="outlined" sx={{ p: 2, boxShadow: 'none' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {team.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Leader: {team.leader_student_id}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Members: {team.student_ids.join(', ')}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {teams.length > 0 && (
            <Button onClick={() => setMemberDialogOpen(true)} startIcon={<GroupRoundedIcon />}>
              Add member
            </Button>
          )}
          <Button onClick={() => setSelectedProject(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={memberDialogOpen} onClose={() => setMemberDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add team member</DialogTitle>
        <DialogContent>
          <TextField
            sx={{ mt: 1 }}
            fullWidth
            label="Student ID"
            value={memberStudentId}
            onChange={(event) => setMemberStudentId(event.target.value)}
            helperText="Enter the target student ID. In mock mode, try user-student-1."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMemberDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddMember} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
