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
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import GroupRoundedIcon from '@mui/icons-material/GroupRounded'
import WorkspacesRoundedIcon from '@mui/icons-material/WorkspacesRounded'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { displayUserName, ownTeamForUser, resolveKnownUser } from '../lib/projectView'
import { formatDateOnly } from '../utils/date'

export default function ProjectsPage() {
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const session = useMemo(() => ({ token, user }), [token, user])
  const [projects, setProjects] = useState([])
  const [knownUsers, setKnownUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const knownUsersById = useMemo(
    () => new Map(knownUsers.map((knownUser) => [knownUser.id, knownUser])),
    [knownUsers],
  )
  const effectiveUser = useMemo(() => resolveKnownUser(knownUsers, user), [knownUsers, user])

  useEffect(() => {
    let active = true

    async function loadData() {
      setLoading(true)
      setError('')
      try {
        const [projectData, userData] = await Promise.all([
          api.listParticipantProjects(session),
          api.listKnownUsers(session),
        ])
        if (!active) return
        setProjects(Array.isArray(projectData) ? projectData : [])
        setKnownUsers(Array.isArray(userData) ? userData : [])
      } catch (loadError) {
        if (active) {
          setError(loadError.message || 'Failed to load project list')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadData()
    return () => {
      active = false
    }
  }, [token, user])

  if (loading) {
    return <LoadingState />
  }

  const title =
    effectiveUser?.role === 'teacher'
      ? 'Projects you supervise'
      : effectiveUser?.role === 'admin'
        ? 'Project workspace'
        : 'My projects'

  const subtitle =
    effectiveUser?.role === 'student'
      ? 'Projects where you already participate. Open one to manage your team and review submission files.'
      : effectiveUser?.role === 'teacher'
        ? 'Projects you own, with quick access to team rosters and submitted work.'
        : 'Admin view of all current projects and their participation state.'

  return (
    <>
      <PageHeader eyebrow="Projects" title={title} subtitle={subtitle} />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {!projects.length ? (
        <EmptyState
          title="No projects yet"
          description={
            effectiveUser?.role === 'student'
              ? 'Join or create a team from the Subjects page and your active projects will appear here.'
              : 'Projects will appear here once they are attached to subjects.'
          }
          actionLabel="Open subjects"
          onAction={() => navigate('/subjects')}
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' },
            gap: 2.5,
          }}
        >
          {projects.map((project) => {
            const ownTeam = effectiveUser ? ownTeamForUser(project.teams || [], effectiveUser.id) : null

            return (
              <Card key={project.id} sx={{ height: '100%' }}>
                <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Stack spacing={2} sx={{ flexGrow: 1 }}>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1.5}
                      justifyContent="space-between"
                    >
                      <Box>
                        <Typography variant="h5">{project.title}</Typography>
                        <Typography color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.7 }}>
                          {project.description}
                        </Typography>
                      </Box>
                      <Chip
                        icon={<WorkspacesRoundedIcon />}
                        label={project.subject?.name || 'Project'}
                        color="secondary"
                        size="small"
                      />
                    </Stack>

                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip
                        label={`Teacher: ${displayUserName(knownUsersById.get(project.teacher_id))}`}
                        variant="outlined"
                        size="small"
                      />
                      <Chip
                        icon={<GroupRoundedIcon />}
                        label={`${(project.teams || []).length} team${(project.teams || []).length === 1 ? '' : 's'}`}
                        variant="outlined"
                        size="small"
                      />
                      <Chip
                        label={`Max ${project.max_students_per_team} / team`}
                        variant="outlined"
                        size="small"
                      />
                      {project.end_date && (
                        <Chip
                          label={`End ${formatDateOnly(project.end_date)}`}
                          variant="outlined"
                          size="small"
                        />
                      )}
                      {ownTeam && (
                        <Chip
                          label={`Your team: ${ownTeam.name}`}
                          color="primary"
                          variant="outlined"
                          size="small"
                        />
                      )}
                    </Stack>
                  </Stack>

                  <Stack direction="row" spacing={1.25} sx={{ mt: 3 }} flexWrap="wrap" useFlexGap>
                    <Button
                      variant="contained"
                      endIcon={<ArrowForwardRoundedIcon />}
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      Open project
                    </Button>
                    <Button
                      variant="text"
                      onClick={() => navigate(`/projects/${project.id}?tab=files`)}
                    >
                      Submission files
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            )
          })}
        </Box>
      )}
    </>
  )
}
