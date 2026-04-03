import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import GroupRoundedIcon from '@mui/icons-material/GroupRounded'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import LoadingState from '../components/LoadingState'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import {
  displayUserName,
  formatFileSize,
  ownTeamForUser,
  resolveKnownUser,
} from '../lib/projectView'
import { formatDateOnly } from '../utils/date'

const validTabs = new Set(['overview', 'team', 'files'])

export default function ProjectDetailPage() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { token, user } = useAuth()
  const session = useMemo(() => ({ token, user }), [token, user])
  const [project, setProject] = useState(null)
  const [subject, setSubject] = useState(null)
  const [teams, setTeams] = useState([])
  const [knownUsers, setKnownUsers] = useState([])
  const [submissionFiles, setSubmissionFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [memberStudentId, setMemberStudentId] = useState('')

  const activeTab = validTabs.has(searchParams.get('tab')) ? searchParams.get('tab') : 'overview'
  const knownUsersById = useMemo(
    () => new Map(knownUsers.map((knownUser) => [knownUser.id, knownUser])),
    [knownUsers],
  )
  const effectiveUser = useMemo(() => resolveKnownUser(knownUsers, user), [knownUsers, user])
  const ownTeam = useMemo(
    () => (effectiveUser ? ownTeamForUser(teams, effectiveUser.id) : null),
    [effectiveUser, teams],
  )
  const canManageOwnTeam =
    !!ownTeam &&
    !!effectiveUser &&
    ownTeam.leader_student_id === effectiveUser.id &&
    effectiveUser.role === 'student'

  const candidateStudents = useMemo(() => {
    const projectMemberIds = new Set(
      teams
        .filter((team) => team.id !== ownTeam?.id)
        .flatMap((team) => team.student_ids || []),
    )
    const sourceIds =
      (subject?.user_ids && subject.user_ids.length > 0)
        ? subject.user_ids
        : knownUsers.filter((knownUser) => knownUser.role === 'student').map((knownUser) => knownUser.id)

    return sourceIds
      .map((studentId) => knownUsersById.get(studentId))
      .filter(
        (student) =>
          student &&
          student.role === 'student' &&
          !projectMemberIds.has(student.id) &&
          !(ownTeam?.student_ids || []).includes(student.id),
      )
  }, [knownUsers, knownUsersById, ownTeam, subject, teams])

  async function loadData() {
    if (!projectId) {
      setError('Project ID is missing.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const [projectData, subjectData, teamData, userData, fileData] = await Promise.all([
        api.getProject(session, projectId),
        api.listSubjects(session),
        api.listTeamsByProject(session, projectId),
        api.listKnownUsers(session),
        api.listSubmissionFiles(session, projectId),
      ])

      const subjects = Array.isArray(subjectData) ? subjectData : subjectData.subjects || []
      const nextProject = Array.isArray(projectData) ? projectData[0] : projectData
      setProject(nextProject)
      setSubject(subjects.find((item) => item.id === nextProject?.subject_id) || null)
      setTeams(Array.isArray(teamData) ? teamData : teamData.teams || [])
      setKnownUsers(Array.isArray(userData) ? userData : [])
      setSubmissionFiles(Array.isArray(fileData) ? fileData : [])
    } catch (loadError) {
      setError(loadError.message || 'Failed to load project details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [projectId, token, user])

  async function handleCreateTeam() {
    if (!projectId) return
    try {
      await api.registerTeam(session, projectId)
      setSuccess('Team created successfully.')
      await loadData()
      setSearchParams({ tab: 'team' })
    } catch (createError) {
      setError(createError.message || 'Failed to create team')
    }
  }

  async function handleAddMember() {
    if (!ownTeam?.id || !memberStudentId) {
      return
    }
    try {
      await api.addTeamMember(session, ownTeam.id, memberStudentId)
      setMemberStudentId('')
      setSuccess('Team member added.')
      await loadData()
    } catch (addError) {
      setError(addError.message || 'Failed to add team member')
    }
  }

  async function handleRemoveMember(studentId) {
    if (!ownTeam?.id) return
    try {
      await api.removeTeamMember(session, ownTeam.id, studentId)
      setSuccess('Team member removed.')
      await loadData()
    } catch (removeError) {
      setError(removeError.message || 'Failed to remove team member')
    }
  }

  function setTab(nextTab) {
    if (nextTab === 'overview') {
      setSearchParams({})
      return
    }
    setSearchParams({ tab: nextTab })
  }

  if (loading) {
    return <LoadingState />
  }

  if (!project) {
    return (
      <Alert severity="error">
        Project not found.
      </Alert>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow={subject?.abbreviation || 'Project'}
        title={project.title}
        subtitle={project.description}
        actions={
          <Button
            variant="outlined"
            startIcon={<ArrowBackRoundedIcon />}
            onClick={() => navigate('/projects')}
          >
            Back to projects
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

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
        <Chip label={`Subject: ${subject?.name || 'Unassigned'}`} color="secondary" />
        <Chip label={`Teacher: ${displayUserName(knownUsersById.get(project.teacher_id))}`} />
        <Chip label={`Max ${project.max_students_per_team} / team`} />
        {project.start_date && <Chip label={`Start ${formatDateOnly(project.start_date)}`} />}
        {project.end_date && <Chip label={`End ${formatDateOnly(project.end_date)}`} />}
      </Stack>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Tabs value={activeTab} onChange={(_event, nextTab) => setTab(nextTab)}>
          <Tab label="Overview" value="overview" />
          <Tab label="Team" value="team" />
          <Tab label="Submission files" value="files" />
        </Tabs>
        <Divider />

        <Box sx={{ p: { xs: 2.5, md: 3.5 } }}>
          {activeTab === 'overview' && (
            <Stack spacing={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Project brief
                  </Typography>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.8 }}>
                    {project.description}
                  </Typography>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Current state
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip
                      icon={<GroupRoundedIcon />}
                      label={`${teams.length} team${teams.length === 1 ? '' : 's'} formed`}
                      variant="outlined"
                    />
                    <Chip
                      label={`${submissionFiles.length} submission file${submissionFiles.length === 1 ? '' : 's'}`}
                      variant="outlined"
                    />
                    {ownTeam && (
                      <Chip label={`Your team: ${ownTeam.name}`} color="primary" variant="outlined" />
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          )}

          {activeTab === 'team' && (
            <Stack spacing={3}>
              {effectiveUser?.role === 'student' && !ownTeam && (
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={2}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                  >
                    <Box>
                      <Typography variant="h6">You are not in a team yet</Typography>
                      <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                        Create a team for this project, then manage members here.
                      </Typography>
                    </Box>
                    <Button variant="contained" onClick={handleCreateTeam}>
                      Create team
                    </Button>
                  </Stack>
                </Paper>
              )}

              {ownTeam && (
                <Card variant="outlined">
                  <CardContent>
                    <Stack spacing={2.5}>
                      <Box>
                        <Typography variant="h6">{ownTeam.name}</Typography>
                        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                          Leader: {displayUserName(knownUsersById.get(ownTeam.leader_student_id))}
                        </Typography>
                      </Box>

                      <Stack spacing={1.25}>
                        {(ownTeam.student_ids || []).map((studentId) => {
                          const member = knownUsersById.get(studentId)
                          const isLeader = ownTeam.leader_student_id === studentId

                          return (
                            <Paper
                              key={studentId}
                              variant="outlined"
                              sx={{ p: 1.5, borderRadius: 2.5 }}
                            >
                              <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={1}
                                justifyContent="space-between"
                                alignItems={{ xs: 'flex-start', sm: 'center' }}
                              >
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography>{displayUserName(member)}</Typography>
                                  {isLeader && (
                                    <Chip label="Leader" color="primary" size="small" />
                                  )}
                                </Stack>
                                {canManageOwnTeam && !isLeader && (
                                  <Button
                                    color="error"
                                    variant="text"
                                    onClick={() => handleRemoveMember(studentId)}
                                  >
                                    Remove
                                  </Button>
                                )}
                              </Stack>
                            </Paper>
                          )
                        })}
                      </Stack>

                      {canManageOwnTeam && (
                        <Stack
                          direction={{ xs: 'column', md: 'row' }}
                          spacing={1.25}
                          alignItems={{ xs: 'stretch', md: 'center' }}
                        >
                          <TextField
                            select
                            label="Add member"
                            value={memberStudentId}
                            onChange={(event) => setMemberStudentId(event.target.value)}
                            sx={{ minWidth: { md: 280 } }}
                            disabled={
                              candidateStudents.length === 0 ||
                              (ownTeam.student_ids || []).length >= project.max_students_per_team
                            }
                          >
                            {candidateStudents.map((student) => (
                              <MenuItem key={student.id} value={student.id}>
                                {displayUserName(student)}
                              </MenuItem>
                            ))}
                          </TextField>
                          <Button
                            variant="contained"
                            startIcon={<PersonAddRoundedIcon />}
                            disabled={
                              !memberStudentId ||
                              (ownTeam.student_ids || []).length >= project.max_students_per_team
                            }
                            onClick={handleAddMember}
                          >
                            Add member
                          </Button>
                          <Typography color="text.secondary" sx={{ fontSize: 14 }}>
                            {(ownTeam.student_ids || []).length} / {project.max_students_per_team} seats used
                          </Typography>
                        </Stack>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              )}

              <Box>
                <Typography variant="h6" sx={{ mb: 1.5 }}>
                  Current teams
                </Typography>
                {teams.length === 0 ? (
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
                    <Typography color="text.secondary">
                      No teams exist for this project yet.
                    </Typography>
                  </Paper>
                ) : (
                  <Stack spacing={1.5}>
                    {teams.map((team) => (
                      <Paper key={team.id} variant="outlined" sx={{ p: 2.25, borderRadius: 3 }}>
                        <Stack spacing={1}>
                          <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={1}
                            justifyContent="space-between"
                          >
                            <Typography variant="subtitle1">{team.name}</Typography>
                            <Chip
                              label={`${(team.student_ids || []).length} member${(team.student_ids || []).length === 1 ? '' : 's'}`}
                              size="small"
                              variant="outlined"
                            />
                          </Stack>
                          <Typography color="text.secondary" sx={{ fontSize: 14 }}>
                            Leader: {displayUserName(knownUsersById.get(team.leader_student_id))}
                          </Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ pt: 0.5 }}>
                            {(team.student_ids || []).map((studentId) => (
                              <Chip
                                key={studentId}
                                label={displayUserName(knownUsersById.get(studentId))}
                                size="small"
                                color={studentId === team.leader_student_id ? 'primary' : 'default'}
                                variant={studentId === team.leader_student_id ? 'filled' : 'outlined'}
                              />
                            ))}
                          </Stack>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          )}

          {activeTab === 'files' && (
            <Stack spacing={1.5}>
              {submissionFiles.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
                  <Typography color="text.secondary">
                    No submission files have been recorded for this project yet.
                  </Typography>
                </Paper>
              ) : (
                submissionFiles.map((file) => (
                  <Paper key={file.id} variant="outlined" sx={{ p: 2.25, borderRadius: 3 }}>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1.25}
                      justifyContent="space-between"
                    >
                      <Stack direction="row" spacing={1.25} alignItems="flex-start">
                        <InsertDriveFileRoundedIcon sx={{ mt: 0.25, color: 'primary.main' }} />
                        <Box>
                          <Typography variant="subtitle1">{file.filename}</Typography>
                          <Typography color="text.secondary" sx={{ fontSize: 14, mt: 0.5 }}>
                            Uploaded by {displayUserName(file.uploader)} on {formatDateOnly(file.uploaded_at)}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip label={formatFileSize(file.size_bytes)} size="small" variant="outlined" />
                        {file.team_id && (
                          <Chip
                            label={teams.find((team) => team.id === file.team_id)?.name || file.team_id}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    </Stack>
                  </Paper>
                ))
              )}
            </Stack>
          )}
        </Box>
      </Paper>
    </>
  )
}
