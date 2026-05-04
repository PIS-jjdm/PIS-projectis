import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { displayUserName } from '../lib/projectView'
import { formatDateOnly } from '../utils/date'

export default function MyEvaluationsPage() {
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const session = useMemo(() => ({ token, user }), [token, user])
  const role = String(user?.role || '').toLowerCase()

  const [evaluations, setEvaluations] = useState([])
  const [projects, setProjects] = useState([])
  const [knownUsers, setKnownUsers] = useState([])
  const [teamsById, setTeamsById] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const filters = useMemo(() => {
    if (role === 'student') return { studentId: user?.id }
    if (role === 'teacher') return { evaluatorTeacherId: user?.id }
    return {}
  }, [role, user?.id])

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')
      try {
        const [evals, projectsData, usersData] = await Promise.all([
          api.listProjectEvaluations(session, filters),
          api.listProjects(session),
          api.listUsers(session),
        ])
        if (!active) return

        const evaluationList = Array.isArray(evals) ? evals : []
        setEvaluations(evaluationList)
        setProjects(Array.isArray(projectsData) ? projectsData : [])
        setKnownUsers(Array.isArray(usersData) ? usersData : [])

        const projectIds = [
          ...new Set(evaluationList.map((item) => item.project_id).filter(Boolean)),
        ]
        const teamLists = await Promise.all(
          projectIds.map((projectId) =>
            api.listTeamsByProject(session, projectId).catch(() => []),
          ),
        )
        if (!active) return
        const map = {}
        teamLists.flat().forEach((team) => {
          if (team?.id) map[team.id] = team
        })
        setTeamsById(map)
      } catch (loadError) {
        if (active) {
          setError(loadError.message || 'Failed to load evaluations')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [filters, session])

  const projectsById = useMemo(() => {
    const map = new Map()
    projects.forEach((project) => map.set(project.id, project))
    return map
  }, [projects])

  const usersById = useMemo(() => {
    const map = new Map()
    knownUsers.forEach((knownUser) => map.set(knownUser.id, knownUser))
    return map
  }, [knownUsers])

  const sortedEvaluations = useMemo(() => {
    const filtered =
      role === 'student'
        ? evaluations.filter((evaluation) => {
            const team = teamsById[evaluation.team_id]
            return (team?.student_ids || []).includes(user?.id)
          })
        : evaluations
    return [...filtered].sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0
      return tb - ta
    })
  }, [evaluations, role, teamsById, user?.id])

  const title =
    role === 'teacher'
      ? 'Evaluations you submitted'
      : role === 'admin'
        ? 'All evaluations'
        : 'My evaluations'

  const subtitle =
    role === 'teacher'
      ? 'Scores and feedback you have given to project teams.'
      : role === 'admin'
        ? 'Every evaluation across the system.'
        : 'Scores and feedback your team has received from teachers.'

  if (loading) return <LoadingState />

  return (
    <>
      <PageHeader eyebrow="Evaluations" title={title} subtitle={subtitle} />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {sortedEvaluations.length === 0 ? (
        <EmptyState
          title={role === 'teacher' ? 'No evaluations submitted yet' : 'No evaluations yet'}
          description={
            role === 'teacher'
              ? 'Evaluations you save in a project will appear here.'
              : role === 'admin'
                ? 'Once teachers start grading teams, the entries will show up here.'
                : 'Once a teacher evaluates your team, the score and feedback will appear here.'
          }
        />
      ) : (
        <Stack spacing={2}>
          {sortedEvaluations.map((evaluation) => {
            const project = projectsById.get(evaluation.project_id)
            const team = teamsById[evaluation.team_id]
            const evaluator = usersById.get(evaluation.evaluator_teacher_id)
            const teamLabel =
              team?.name || (evaluation.team_id ? `Team ${evaluation.team_id.slice(0, 8)}` : 'Team')

            return (
              <Card key={evaluation.id || `${evaluation.team_id}-${evaluation.timestamp}`}>
                <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', md: 'flex-start' }}
                    spacing={1.5}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        variant="overline"
                        color="primary.main"
                        sx={{ fontWeight: 700 }}
                      >
                        {project?.title || 'Project'}
                      </Typography>
                      <Typography variant="h6">{teamLabel}</Typography>
                      <Stack
                        direction="row"
                        spacing={1}
                        flexWrap="wrap"
                        useFlexGap
                        sx={{ mt: 1 }}
                      >
                        <Chip
                          icon={<EmojiEventsRoundedIcon />}
                          label={`Score ${evaluation.total_score}`}
                          color="primary"
                          size="small"
                        />
                        {evaluation.timestamp && (
                          <Chip
                            label={formatDateOnly(evaluation.timestamp)}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        {role !== 'teacher' && evaluator && (
                          <Chip
                            label={`Evaluator: ${displayUserName(evaluator)}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    </Box>
                    {project && (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<LaunchRoundedIcon />}
                        onClick={() => navigate(`/projects/${project.id}?tab=files`)}
                      >
                        Open project
                      </Button>
                    )}
                  </Stack>
                  {evaluation.feedback && (
                    <Typography
                      color="text.secondary"
                      sx={{ mt: 2, whiteSpace: 'pre-wrap', lineHeight: 1.65 }}
                    >
                      {evaluation.feedback}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </Stack>
      )}
    </>
  )
}
