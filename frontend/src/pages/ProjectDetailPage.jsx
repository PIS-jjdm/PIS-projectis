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
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import GroupRoundedIcon from '@mui/icons-material/GroupRounded'
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded'
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
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
const MAX_SUBMISSION_MB = 10
const MAX_SUBMISSION_BYTES = MAX_SUBMISSION_MB * 1024 * 1024

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
  const [teamDetails, setTeamDetails] = useState({})
  const [evaluationDrafts, setEvaluationDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [memberStudentId, setMemberStudentId] = useState('')
  const [savingEvaluation, setSavingEvaluation] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [submittingFile, setSubmittingFile] = useState(false)

  const isProjectTeacher =
    !!project && (user?.role === 'admin' || project.teacher_id === user?.id)
  const isStudent = user?.role === 'student'

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
  const visibleTeams = useMemo(
    () => (isStudent ? (ownTeam ? [ownTeam] : []) : teams),
    [isStudent, ownTeam, teams],
  )

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
      const [projectData, subjectData, teamData, userData] = await Promise.all([
        api.getProject(session, projectId),
        api.listSubjects(session),
        api.listTeamsByProject(session, projectId),
        api.listKnownUsers(session),
      ])

      const subjects = Array.isArray(subjectData) ? subjectData : subjectData.subjects || []
      const nextProject = Array.isArray(projectData) ? projectData[0] : projectData
      const nextTeams = Array.isArray(teamData) ? teamData : teamData.teams || []

      setProject(nextProject)
      setSubject(subjects.find((item) => item.id === nextProject?.subject_id) || null)
      setTeams(nextTeams)
      setKnownUsers(Array.isArray(userData) ? userData : [])

      const role = String(user?.role || '').toLowerCase()
      const detailFetchTeams =
        role === 'student'
          ? nextTeams.filter((team) => (team.student_ids || []).includes(user?.id))
          : nextTeams
      const detailEntries = await Promise.all(
        detailFetchTeams.map(async (team) => {
          try {
            const detail = await api.getTeam(session, team.id)
            return [team.id, detail]
          } catch {
            return [team.id, null]
          }
        }),
      )
      const nextDetails = Object.fromEntries(detailEntries)
      setTeamDetails(nextDetails)
      setEvaluationDrafts(
        Object.fromEntries(
          detailEntries.map(([teamId, detail]) => [
            teamId,
            {
              evaluation_id: detail?.evaluation?.id || null,
              score:
                detail?.evaluation?.total_score !== undefined &&
                detail?.evaluation?.total_score !== null
                  ? String(detail.evaluation.total_score)
                  : '',
              feedback: detail?.evaluation?.feedback || '',
              dirty: false,
            },
          ]),
        ),
      )
    } catch (loadError) {
      setError(loadError.message || 'Failed to load project details')
    } finally {
      setLoading(false)
    }
  }

  function setEvaluationField(teamId, field, value) {
    setEvaluationDrafts((current) => ({
      ...current,
      [teamId]: { ...(current[teamId] || {}), [field]: value, dirty: true },
    }))
  }

  async function saveEvaluationOne(teamId) {
    const draft = evaluationDrafts[teamId]
    if (!draft) return
    const score = Number(draft.score)
    if (!Number.isFinite(score)) {
      throw new Error('Score must be a number')
    }
    if (draft.evaluation_id) {
      await api.updateProjectEvaluation(session, {
        evaluation_id: draft.evaluation_id,
        total_score: score,
        feedback: draft.feedback || '',
      })
    } else {
      await api.createProjectEvaluation(session, {
        subject_id: project?.subject_id || '',
        project_id: project?.id || '',
        team_id: teamId,
        total_score: score,
        feedback: draft.feedback || '',
      })
    }
  }

  async function handleSaveEvaluation(teamId) {
    setError('')
    setSavingEvaluation(true)
    try {
      await saveEvaluationOne(teamId)
      setSuccess('Evaluation saved.')
      await loadData()
    } catch (saveError) {
      setError(saveError.message || 'Failed to save evaluation')
    } finally {
      setSavingEvaluation(false)
    }
  }

  async function handleSaveAllEvaluations() {
    const dirty = Object.entries(evaluationDrafts).filter(([, draft]) => draft.dirty)
    if (!dirty.length) return
    setError('')
    setSavingEvaluation(true)
    try {
      for (const [teamId] of dirty) {
        await saveEvaluationOne(teamId)
      }
      setSuccess(`Saved ${dirty.length} evaluation${dirty.length === 1 ? '' : 's'}.`)
      await loadData()
    } catch (saveError) {
      setError(saveError.message || 'Failed to save some evaluations')
    } finally {
      setSavingEvaluation(false)
    }
  }

  async function downloadOne(teamId) {
    const result = await api.downloadSubmission(session, teamId)
    const url = URL.createObjectURL(result.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = result.fileName || `submission-${teamId}.bin`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  async function handleDownload(teamId) {
    setError('')
    setDownloading(true)
    try {
      await downloadOne(teamId)
    } catch (downloadError) {
      setError(downloadError.message || 'Failed to download submission')
    } finally {
      setDownloading(false)
    }
  }

  async function handleDownloadAll() {
    setError('')
    setDownloading(true)
    try {
      const ids = visibleTeams
        .filter((team) => teamDetails[team.id]?.submission)
        .map((team) => team.id)
      for (const teamId of ids) {
        await downloadOne(teamId)
      }
    } catch (downloadError) {
      setError(downloadError.message || 'Failed to download submissions')
    } finally {
      setDownloading(false)
    }
  }

  async function handleSubmitFile(teamId, file) {
    if (!file) return
    setError('')
    if (file.size > MAX_SUBMISSION_BYTES) {
      setError(
        `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB; the limit is ${MAX_SUBMISSION_MB} MB.`,
      )
      return
    }
    setSubmittingFile(true)
    try {
      await api.submitProject(session, teamId, file)
      setSuccess(`Submitted "${file.name}" for the team.`)
      await loadData()
    } catch (submitError) {
      setError(submitError.message || 'Failed to submit file')
    } finally {
      setSubmittingFile(false)
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
        <Chip
          label={`Subject: ${subject?.name || 'Unassigned'}`}
          color="secondary"
          clickable={Boolean(project.subject_id)}
          onClick={project.subject_id ? () => navigate(`/subjects/${project.subject_id}`) : undefined}
        />
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
                      label={`${
                        teams.filter((team) => teamDetails[team.id]?.submission).length
                      } / ${teams.length} team${teams.length === 1 ? '' : 's'} submitted`}
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
            <Stack spacing={2}>
              {(() => {
                const teamsWithSubmission = visibleTeams.filter(
                  (team) => teamDetails[team.id]?.submission,
                )
                const dirtyCount = Object.values(evaluationDrafts).filter(
                  (draft) => draft.dirty,
                ).length
                return (
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                  >
                    <Typography color="text.secondary">
                      {isStudent
                        ? ownTeam
                          ? teamsWithSubmission.length === 1
                            ? 'Your team has submitted.'
                            : 'Your team has not submitted yet.'
                          : 'Join or create a team to submit a file.'
                        : `${teamsWithSubmission.length} of ${visibleTeams.length} team${visibleTeams.length === 1 ? '' : 's'} submitted`}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {!isStudent && (
                        <Button
                          variant="outlined"
                          startIcon={<DownloadRoundedIcon />}
                          onClick={handleDownloadAll}
                          disabled={teamsWithSubmission.length === 0 || downloading}
                        >
                          Download all
                        </Button>
                      )}
                      {isProjectTeacher && (
                        <Button
                          variant="contained"
                          onClick={handleSaveAllEvaluations}
                          disabled={dirtyCount === 0 || savingEvaluation}
                        >
                          {savingEvaluation
                            ? 'Saving…'
                            : `Save all evaluations${dirtyCount ? ` (${dirtyCount})` : ''}`}
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                )
              })()}

              {visibleTeams.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
                  <Typography color="text.secondary">
                    {isStudent
                      ? 'You are not in a team for this project yet. Join or create a team from the Team tab to submit a file.'
                      : 'No teams have been formed for this project yet.'}
                  </Typography>
                </Paper>
              ) : (
                visibleTeams.map((team) => {
                  const detail = teamDetails[team.id]
                  const submission = detail?.submission
                  const isOwnTeam = ownTeam?.id === team.id
                  const canSubmit = isStudent && isOwnTeam
                  const draft = evaluationDrafts[team.id] || {
                    score: '',
                    feedback: '',
                    dirty: false,
                  }
                  return (
                    <Paper
                      key={team.id}
                      variant="outlined"
                      sx={{ p: 2.5, borderRadius: 3 }}
                    >
                      <Stack spacing={1.5}>
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={1}
                          justifyContent="space-between"
                          alignItems={{ xs: 'flex-start', sm: 'center' }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="h6">{team.name}</Typography>
                            <Stack
                              direction="row"
                              spacing={0.75}
                              flexWrap="wrap"
                              useFlexGap
                              sx={{ mt: 0.5 }}
                            >
                              {(team.student_ids || []).map((studentId) => (
                                <Chip
                                  key={studentId}
                                  label={displayUserName(knownUsersById.get(studentId))}
                                  size="small"
                                  color={
                                    studentId === team.leader_student_id ? 'primary' : 'default'
                                  }
                                  variant={
                                    studentId === team.leader_student_id ? 'filled' : 'outlined'
                                  }
                                />
                              ))}
                            </Stack>
                          </Box>
                          {submission && (
                            <Button
                              variant="outlined"
                              startIcon={<DownloadRoundedIcon />}
                              onClick={() => handleDownload(team.id)}
                              disabled={downloading}
                            >
                              Download
                            </Button>
                          )}
                        </Stack>

                        {submission ? (
                          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                            <Stack
                              direction={{ xs: 'column', sm: 'row' }}
                              spacing={1}
                              justifyContent="space-between"
                              alignItems={{ xs: 'flex-start', sm: 'center' }}
                            >
                              <Stack direction="row" spacing={1.25} alignItems="flex-start">
                                <InsertDriveFileRoundedIcon
                                  sx={{ color: 'primary.main', mt: 0.25 }}
                                />
                                <Box>
                                  <Typography variant="subtitle1">
                                    {submission.file_name || 'submission'}
                                  </Typography>
                                  {submission.submitted_at && (
                                    <Typography
                                      color="text.secondary"
                                      sx={{ fontSize: 14, mt: 0.25 }}
                                    >
                                      Submitted {formatDateOnly(submission.submitted_at)}
                                    </Typography>
                                  )}
                                </Box>
                              </Stack>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Chip
                                  label={formatFileSize(submission.file_size)}
                                  size="small"
                                  variant="outlined"
                                />
                                {submission.content_type && (
                                  <Chip
                                    label={submission.content_type}
                                    size="small"
                                    variant="outlined"
                                  />
                                )}
                              </Stack>
                            </Stack>
                          </Paper>
                        ) : (
                          <Typography color="text.secondary" sx={{ pl: 0.5 }}>
                            No submission yet.
                          </Typography>
                        )}

                        {canSubmit && (
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            alignItems={{ xs: 'stretch', sm: 'center' }}
                          >
                            <Button
                              component="label"
                              variant={submission ? 'outlined' : 'contained'}
                              startIcon={<UploadFileRoundedIcon />}
                              disabled={submittingFile}
                            >
                              {submittingFile
                                ? 'Submitting…'
                                : submission
                                  ? 'Replace submission'
                                  : 'Submit a file'}
                              <input
                                type="file"
                                hidden
                                onChange={(event) => {
                                  const file = event.target.files?.[0]
                                  event.target.value = ''
                                  if (file) handleSubmitFile(team.id, file)
                                }}
                              />
                            </Button>
                            <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                              {submission
                                ? `Max ${MAX_SUBMISSION_MB} MB. Uploading a new file replaces the current one.`
                                : `Max ${MAX_SUBMISSION_MB} MB.`}
                            </Typography>
                          </Stack>
                        )}

                        {isProjectTeacher && (
                          <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={1.25}
                            alignItems={{ xs: 'stretch', md: 'flex-start' }}
                          >
                            <TextField
                              label="Score"
                              type="number"
                              inputProps={{ step: 0.5, min: 0 }}
                              size="small"
                              value={draft.score ?? ''}
                              onChange={(event) =>
                                setEvaluationField(team.id, 'score', event.target.value)
                              }
                              sx={{ width: { xs: '100%', md: 140 } }}
                              disabled={savingEvaluation}
                            />
                            <TextField
                              label="Feedback"
                              size="small"
                              fullWidth
                              multiline
                              minRows={1}
                              value={draft.feedback ?? ''}
                              onChange={(event) =>
                                setEvaluationField(team.id, 'feedback', event.target.value)
                              }
                              disabled={savingEvaluation}
                            />
                            <Button
                              variant="contained"
                              onClick={() => handleSaveEvaluation(team.id)}
                              disabled={!draft.dirty || savingEvaluation}
                              sx={{ minWidth: 100 }}
                            >
                              Save
                            </Button>
                          </Stack>
                        )}
                      </Stack>
                    </Paper>
                  )
                })
              )}
            </Stack>
          )}
        </Box>
      </Paper>
    </>
  )
}
