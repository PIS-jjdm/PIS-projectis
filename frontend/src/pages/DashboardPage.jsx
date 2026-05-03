import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import ForumRoundedIcon from '@mui/icons-material/ForumRounded'
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded'
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded'
import RuleFolderRoundedIcon from '@mui/icons-material/RuleFolderRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import LoadingState from '../components/LoadingState'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { formatDateOnly } from '../utils/date'

function daysUntil(value) {
  if (!value) return null
  const today = new Date()
  const target = new Date(value)
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

function milestoneStatus(value) {
  const days = daysUntil(value)
  if (days === null) return { label: 'Planned', color: '#475265', background: '#d8e3fa' }
  if (days <= 3) return { label: 'Urgent', color: '#9f403d', background: 'rgba(254, 137, 131, 0.18)' }
  if (days <= 10) return { label: 'Planned', color: '#475265', background: '#d8e3fa' }
  return { label: 'Scheduled', color: '#38527b', background: '#d6e3ff' }
}

function subjectAccent(index) {
  return index % 2 === 0
    ? { bar: '#d6e3ff', iconBg: '#dfeaef', icon: '#455f88', titleHover: '#455f88', label: 'Level 400' }
    : { bar: '#75aef7', iconBg: '#dfeaef', icon: '#1a61a4', titleHover: '#1a61a4', label: 'Elective' }
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const session = useMemo(() => ({ token, user }), [token, user])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [projects, setProjects] = useState([])
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      try {
        const [summaryData, subjectData, projectData, notificationData] = await Promise.all([
          api.getDashboardSummary(session),
          api.listSubjects(session),
          api.listProjects(session),
          api.listNotifications(session),
        ])

        if (!active) return

        setSummary(summaryData)
        setSubjects(Array.isArray(subjectData) ? subjectData : subjectData.subjects || [])
        setProjects(Array.isArray(projectData) ? projectData : projectData.projects || [])
        setNotifications(Array.isArray(notificationData) ? notificationData : [])
        setError('')
      } catch (err) {
        if (!active) return
        setError(err.message || 'Failed to load dashboard')
        setSummary({
          subjects: 0,
          registeredSubjects: 0,
          projects: 0,
          ownProjects: 0,
          teams: 0,
          unreadNotifications: 0,
        })
        setSubjects([])
        setProjects([])
        setNotifications([])
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [session, user?.id])

  const activityItems = useMemo(() => {
    const palette = [
      {
        icon: <DescriptionRoundedIcon sx={{ fontSize: 20 }} />,
        background: '#d6e3ff',
        color: '#38527b',
        title: 'Project Updated',
      },
      {
        icon: <ForumRoundedIcon sx={{ fontSize: 20 }} />,
        background: '#d8e3fa',
        color: '#475265',
        title: 'Team Feedback',
      },
      {
        icon: <AssignmentTurnedInRoundedIcon sx={{ fontSize: 20 }} />,
        background: '#75aef7',
        color: '#002d55',
        title: 'Evaluation Complete',
      },
    ]

    return notifications.slice(0, 3).map((item, index) => ({
      ...palette[index % palette.length],
      message: item.message,
      time: item.date ? formatDateOnly(item.date) : 'Recently',
    }))
  }, [notifications])

  const stats = useMemo(() => {
    const nextProject = [...projects]
      .filter((project) => project.end_date)
      .sort((a, b) => new Date(a.end_date) - new Date(b.end_date))[0]

    const nextDeadlineDays = nextProject?.end_date != null ? daysUntil(nextProject.end_date) : null

    return [
      {
        icon: <PendingActionsRoundedIcon sx={{ color: 'primary.main' }} />,
        value: `${summary?.projects ?? 0}`,
        label: 'Active Tasks',
      },
      {
        icon: <RuleFolderRoundedIcon sx={{ color: 'primary.main' }} />,
        value: String(summary?.unreadNotifications ?? 0).padStart(2, '0'),
        label: 'Pending Reviews',
      },
      {
        icon: <ScheduleRoundedIcon sx={{ color: 'text.secondary' }} />,
        value: nextDeadlineDays == null ? '—' : `${Math.max(nextDeadlineDays, 0)}d`,
        label: 'Next Deadline',
      },
    ]
  }, [projects, summary])

  const featuredSubjects = useMemo(() => subjects.slice(0, 2), [subjects])
  const milestones = useMemo(
    () =>
      [...projects]
        .sort((a, b) => {
          if (!a.end_date) return 1
          if (!b.end_date) return -1
          return new Date(a.end_date) - new Date(b.end_date)
        })
        .slice(0, 3),
    [projects],
  )

  if (loading) return <LoadingState />

  return (
    <Box>
      <Box component="header" sx={{ mb: 6 }}>
        <Typography
          variant="h3"
          sx={{
            color: 'primary.main',
            fontSize: { xs: 34, md: 40 },
            mb: 1,
          }}
        >
          Welcome, {user?.firstname || 'Curator'}
        </Typography>
        <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
          Review your registration progress and upcoming academic milestones.
        </Typography>
      </Box>

      {error && <Alert severity="warning" sx={{ mb: 3 }}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 4 }}>
        <Box sx={{ gridColumn: { xs: '1 / -1', lg: 'span 4' }, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              borderLeft: '4px solid #455f88',
              boxShadow: 'none',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ color: 'primary.main', fontSize: 20 }}>
                Recent Activity
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontWeight: 700 }}>...</Typography>
            </Stack>

            <Stack spacing={3}>
              {(activityItems.length ? activityItems : [
                {
                  icon: <DescriptionRoundedIcon sx={{ fontSize: 20 }} />,
                  background: '#d6e3ff',
                  color: '#38527b',
                  title: 'No recent activity',
                  message: 'Activity will appear here once notifications and milestones are available.',
                  time: 'Just now',
                },
              ]).map((item) => (
                <Stack key={`${item.title}-${item.time}`} direction="row" spacing={2}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1,
                      bgcolor: item.background,
                      color: item.color,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.7 }}>
                      {item.message}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        mt: 1,
                        color: 'success.main',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.12em',
                      }}
                    >
                      {item.time}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>

            <Button
              fullWidth
              onClick={() => navigate('/notifications')}
              sx={{ mt: 4, fontWeight: 700, color: 'primary.main' }}
            >
              View Full Log
            </Button>
          </Paper>
        </Box>

        <Box sx={{ gridColumn: { xs: '1 / -1', lg: 'span 8' }, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
            {stats.map((item) => (
              <Paper
                key={item.label}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  minHeight: 128,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: 'none',
                  bgcolor: 'action.hover',
                }}
              >
                {item.icon}
                <Box>
                  <Typography sx={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1 }}>
                    {item.value}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      mt: 0.75,
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      letterSpacing: '0.16em',
                      fontWeight: 700,
                    }}
                  >
                    {item.label}
                  </Typography>
                </Box>
              </Paper>
            ))}
          </Box>

          <Box component="section">
            <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 3 }}>
              <Box>
                <Typography variant="h6" sx={{ color: 'primary.main', fontSize: 22 }}>
                  Registered Subjects
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Manage your current academic portfolio.
                </Typography>
              </Box>
              <Button
                onClick={() => navigate('/subjects')}
                endIcon={<ArrowForwardRoundedIcon />}
                sx={{ color: 'success.main', fontWeight: 700 }}
              >
                Browse All
              </Button>
            </Stack>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
              {featuredSubjects.map((subject, index) => {
                const accent = subjectAccent(index)
                return (
                  <Paper
                    key={subject.id}
                    sx={{
                      borderRadius: 3,
                      overflow: 'hidden',
                      boxShadow: 'none',
                    }}
                  >
                    <Box sx={{ height: 12, bgcolor: accent.bar }} />
                    <Box sx={{ p: 3 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 1.5,
                            bgcolor: accent.iconBg,
                            color: accent.icon,
                            display: 'grid',
                            placeItems: 'center',
                          }}
                        >
                          {index % 2 === 0 ? <SearchRoundedIcon /> : <AutoStoriesRoundedIcon />}
                        </Box>
                        <Chip
                          label={accent.label}
                          size="small"
                          sx={{
                            bgcolor: '#d8e3fa',
                            color: '#475265',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                          }}
                        />
                      </Stack>
                      <Typography variant="h6" sx={{ mb: 1.5 }}>
                        {subject.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, minHeight: 56 }}>
                        {subject.description}
                      </Typography>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={-0.75}>
                          <Avatar
                            sx={(theme) => ({
                              width: 24,
                              height: 24,
                              fontSize: 10,
                              border: `2px solid ${theme.palette.background.paper}`,
                              bgcolor: '#d6e3ff',
                              color: '#38527b',
                            })}
                          >
                            {subject.abbreviation?.[0] || 'S'}
                          </Avatar>
                          <Avatar
                            sx={(theme) => ({
                              width: 24,
                              height: 24,
                              fontSize: 10,
                              border: `2px solid ${theme.palette.background.paper}`,
                              bgcolor: '#d8e3fa',
                              color: '#475265',
                            })}
                          >
                            {user?.firstname?.[0] || 'U'}
                          </Avatar>
                          <Avatar
                            sx={(theme) => ({
                              width: 24,
                              height: 24,
                              fontSize: 10,
                              border: `2px solid ${theme.palette.background.paper}`,
                              bgcolor: '#d8e3fa',
                              color: '#283439',
                            })}
                          >
                            +{Math.max((summary?.registeredSubjects ?? 0) + index + 1, 1)}
                          </Avatar>
                        </Stack>
                        <ChevronRightRoundedIcon sx={{ color: 'text.secondary' }} />
                      </Stack>
                    </Box>
                  </Paper>
                )
              })}
            </Box>
          </Box>

          <Box component="section">
            <Typography variant="h6" sx={{ color: 'primary.main', fontSize: 22, mb: 3 }}>
              Critical Milestones
            </Typography>

            <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: 'none' }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                  px: 3,
                  py: 2,
                  bgcolor: 'action.hover',
                }}
              >
                <Typography sx={{ gridColumn: 'span 6', fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
                  Milestone Title
                </Typography>
                <Typography sx={{ gridColumn: 'span 3', fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
                  Due Date
                </Typography>
                <Typography sx={{ gridColumn: 'span 3', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
                  Status
                </Typography>
              </Box>

              {(milestones.length ? milestones : [
                {
                  id: 'placeholder-milestone',
                  title: 'No active project milestones',
                  description: 'Create or activate projects to populate this table.',
                  end_date: null,
                },
              ]).map((project) => {
                const status = milestoneStatus(project.end_date)
                return (
                  <Box
                    key={project.id}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                      px: 3,
                      py: 2.5,
                      alignItems: 'center',
                      borderTop: (theme) => `1px solid ${theme.palette.divider}`,
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 6' }, mb: { xs: 1.5, md: 0 } }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {project.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {project.description || 'Project workspace milestone'}
                      </Typography>
                    </Box>
                    <Typography sx={{ gridColumn: { xs: 'span 6', md: 'span 3' }, color: 'text.secondary', fontWeight: 500, fontSize: 14 }}>
                      {project.end_date ? formatDateOnly(project.end_date) : 'TBD'}
                    </Typography>
                    <Box sx={{ gridColumn: { xs: 'span 6', md: 'span 3' }, textAlign: 'right' }}>
                      <Chip
                        label={status.label}
                        size="small"
                        sx={{
                          bgcolor: status.background,
                          color: status.color,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      />
                    </Box>
                  </Box>
                )
              })}
            </Paper>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
