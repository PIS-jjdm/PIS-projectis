import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AddAlertRoundedIcon from '@mui/icons-material/AddAlertRounded'
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditCalendarRoundedIcon from '@mui/icons-material/EditCalendarRounded'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { formatDate } from '../utils/date'
import { useEffect, useMemo, useState } from 'react'

function parseUserIds(value) {
  const seen = new Set()
  return value
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter((item) => item && !seen.has(item) && seen.add(item))
}

function defaultTriggerAtValue() {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)
}

function userSearchLabel(user) {
  if (!user) return ''
  return `${user.firstname} ${user.lastname}`.trim() || user.email || user.id
}

function unknownRecipientIds(selectedIds, knownUsers) {
  return selectedIds.filter((id) => !knownUsers.some((user) => user.id === id))
}

export default function NotificationsPage() {
  const { token, user } = useAuth()
  const session = useMemo(() => ({ token, user }), [token, user])
  const canManageNotifications = ['teacher', 'admin'].includes(user?.role)

  const [notifications, setNotifications] = useState([])
  const [scheduledNotifications, setScheduledNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false)
  const [rescheduleBatch, setRescheduleBatch] = useState(null)
  const [rescheduleTriggerAt, setRescheduleTriggerAt] = useState(defaultTriggerAtValue())
  const [directoryUsers, setDirectoryUsers] = useState([])
  const [subjectOptions, setSubjectOptions] = useState([])
  const [projectOptions, setProjectOptions] = useState([])
  const [recipientSourceType, setRecipientSourceType] = useState('subject')
  const [recipientSourceId, setRecipientSourceId] = useState('')
  const [sourceLoading, setSourceLoading] = useState(false)
  const [sourceError, setSourceError] = useState('')
  const [directoryLoading, setDirectoryLoading] = useState(false)
  const [directoryError, setDirectoryError] = useState('')
  const [form, setForm] = useState({
    userIdsText: '',
    message: '',
    triggerMode: 'now',
    triggerAt: defaultTriggerAtValue(),
  })
  const selectedRecipientIds = useMemo(() => parseUserIds(form.userIdsText), [form.userIdsText])
  const searchableDirectoryUsers = useMemo(
    () => directoryUsers.filter((item) => item.id !== user?.id),
    [directoryUsers, user?.id],
  )
  const selectedDirectoryUsers = useMemo(
    () => searchableDirectoryUsers.filter((item) => selectedRecipientIds.includes(item.id)),
    [searchableDirectoryUsers, selectedRecipientIds],
  )
  const selectedUnknownIds = useMemo(
    () => unknownRecipientIds(selectedRecipientIds, searchableDirectoryUsers),
    [selectedRecipientIds, searchableDirectoryUsers],
  )

  useEffect(() => {
    const options = recipientSourceType === 'subject' ? subjectOptions : projectOptions
    if (!options.length) {
      setRecipientSourceId('')
      return
    }

    if (!options.some((item) => item.id === recipientSourceId)) {
      setRecipientSourceId(options[0].id)
    }
  }, [recipientSourceType, recipientSourceId, subjectOptions, projectOptions])

  async function loadNotifications() {
    const items = await api.listNotifications(session, user?.id)
    setNotifications(items)
  }

  async function loadScheduledNotifications() {
    if (!canManageNotifications) {
      setScheduledNotifications([])
      return
    }

    const items = await api.listScheduledNotifications(session)
    setScheduledNotifications(items)
  }

  async function loadPageData() {
    setLoading(true)
    setError('')
    try {
      await Promise.all([loadNotifications(), loadScheduledNotifications()])
    } catch (err) {
      setError(err.message || 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let unsubscribe = () => {}

    loadPageData().then(() => {
      unsubscribe = api.subscribeNotifications(session, {
        onMessage: (item) => {
          if (!item) return
          setNotifications((prev) => {
            const next = [item, ...prev.filter((entry) => entry.id !== item.id)]
            next.sort((left, right) => new Date(right.date || 0) - new Date(left.date || 0))
            return next
          })
          setError('')
          setLoading(false)
          if (canManageNotifications) {
            loadScheduledNotifications().catch(() => {})
          }
        },
        onError: (err) => {
          setError(err.message || 'Notification stream disconnected')
        },
      })
    })

    return () => unsubscribe()
  }, [token, user?.id, user?.role])

  async function handleMarkRead(notificationId) {
    setError('')
    try {
      await api.markNotificationRead(session, notificationId)
      await loadNotifications()
    } catch (err) {
      setError(err.message || 'Failed to mark notification as read')
    }
  }

  async function handleCreate() {
    setError('')
    setSuccess('')

    const userIds = parseUserIds(form.userIdsText)
    if (!userIds.length) {
      setError('Provide at least one recipient user ID')
      return
    }

    if (!form.message.trim()) {
      setError('Notification message is required')
      return
    }

    const payload = {
      user_ids: userIds,
      message: form.message.trim(),
      trigger_at:
        form.triggerMode === 'date' && form.triggerAt
          ? new Date(form.triggerAt).toISOString()
          : undefined,
    }

    try {
      const created = await api.createNotification(session, payload)
      const scheduledCount = created.filter((item) => !item.date).length
      const deliveredCount = created.length - scheduledCount

      setDialogOpen(false)
      setForm({
        userIdsText: '',
        message: '',
        triggerMode: 'now',
        triggerAt: defaultTriggerAtValue(),
      })

      await Promise.all([loadNotifications(), loadScheduledNotifications()])

      if (scheduledCount && deliveredCount) {
        setSuccess(
          `Created ${created.length} notifications: ${deliveredCount} sent now and ${scheduledCount} scheduled.`,
        )
      } else if (scheduledCount) {
        setSuccess(`Scheduled ${scheduledCount} notifications.`)
      } else {
        setSuccess(`Sent ${deliveredCount} notifications.`)
      }
    } catch (err) {
      setError(err.message || 'Failed to create notification')
    }
  }

  async function handleCancelScheduled(batchId) {
    setError('')
    setSuccess('')

    try {
      await api.cancelScheduledNotification(session, batchId)
      await loadScheduledNotifications()
      setSuccess('Scheduled notification batch cancelled.')
    } catch (err) {
      setError(err.message || 'Failed to cancel scheduled notification')
    }
  }

  function openRescheduleDialog(batch) {
    setRescheduleBatch(batch)
    setRescheduleTriggerAt(
      batch?.trigger_at ? new Date(batch.trigger_at).toISOString().slice(0, 16) : defaultTriggerAtValue(),
    )
    setRescheduleDialogOpen(true)
  }

  async function handleRescheduleScheduled() {
    setError('')
    setSuccess('')

    if (!rescheduleBatch?.batch_id) {
      setError('Select a scheduled notification batch first.')
      return
    }

    try {
      await api.rescheduleScheduledNotification(
        session,
        rescheduleBatch.batch_id,
        new Date(rescheduleTriggerAt).toISOString(),
      )
      setRescheduleDialogOpen(false)
      setRescheduleBatch(null)
      await loadScheduledNotifications()
      setSuccess('Scheduled notification batch rescheduled.')
    } catch (err) {
      setError(err.message || 'Failed to reschedule scheduled notification')
    }
  }

  async function loadRecipientSources() {
    setSourceLoading(true)
    setSourceError('')

    const [subjectsResult, projectsResult] = await Promise.allSettled([
      api.listSubjects(session),
      api.listProjects(session),
    ])

    const subjects = subjectsResult.status === 'fulfilled' ? subjectsResult.value : []
    const projects = projectsResult.status === 'fulfilled' ? projectsResult.value : []

    setSubjectOptions(subjects)
    setProjectOptions(projects)

    if (subjects.length) {
      setRecipientSourceType('subject')
      setRecipientSourceId((current) => current || subjects[0].id)
    } else if (projects.length) {
      setRecipientSourceType('project')
      setRecipientSourceId((current) => current || projects[0].id)
    } else {
      setRecipientSourceId('')
    }

    const errors = []
    if (subjectsResult.status === 'rejected') {
      errors.push(subjectsResult.reason?.message || 'Failed to load subjects')
    }
    if (projectsResult.status === 'rejected') {
      errors.push(projectsResult.reason?.message || 'Failed to load projects')
    }
    if (errors.length) {
      setSourceError(errors.join(' '))
    }

    setSourceLoading(false)
  }

  async function loadUserDirectory() {
    setDirectoryLoading(true)
    setDirectoryError('')
    try {
      const users = await api.listUsers(session)
      setDirectoryUsers(users)
    } catch (err) {
      setDirectoryError(err.message || 'Failed to load user directory')
    } finally {
      setDirectoryLoading(false)
    }
  }

  async function openComposeDialog() {
    setDialogOpen(true)
    setSourceError('')
    await Promise.all([
      (!subjectOptions.length && !projectOptions.length)
        ? loadRecipientSources()
        : Promise.resolve(),
      !directoryUsers.length ? loadUserDirectory() : Promise.resolve(),
    ])
  }

  async function handleAddRecipientsFromSource() {
    setSourceError('')
    setSuccess('')

    if (!recipientSourceId) {
      setSourceError(`Select a ${recipientSourceType} first.`)
      return
    }

    setSourceLoading(true)
    try {
      const userIds =
        recipientSourceType === 'subject'
          ? await api.getSubjectNotificationRecipients(session, recipientSourceId)
          : await api.getProjectNotificationRecipients(session, recipientSourceId)

      if (!userIds.length) {
        setSourceError(
          recipientSourceType === 'subject'
            ? 'No users were found for the selected subject.'
            : 'No users were found for the selected project.',
        )
        return
      }

      const existing = parseUserIds(form.userIdsText)
      const merged = [...new Set([...existing, ...userIds])]
      const addedCount = merged.length - existing.length

      setForm((prev) => ({ ...prev, userIdsText: merged.join(', ') }))
      setSuccess(
        addedCount > 0
          ? `Added ${addedCount} recipients from the selected ${recipientSourceType}.`
          : `All recipients from the selected ${recipientSourceType} are already included.`,
      )
    } catch (err) {
      setSourceError(err.message || `Failed to load users from the selected ${recipientSourceType}.`)
    } finally {
      setSourceLoading(false)
    }
  }

  function handleDirectorySelectionChange(_event, selectedUsers) {
    const unknownIds = selectedRecipientIds.filter(
      (id) => !searchableDirectoryUsers.some((userItem) => userItem.id === id),
    )
    const merged = [...new Set([...selectedUsers.map((item) => item.id), ...unknownIds])]
    setForm((prev) => ({ ...prev, userIdsText: merged.join(', ') }))
  }

  if (loading) return <LoadingState />

  return (
    <>
      <PageHeader
        eyebrow="Notifications"
        title="Notification centre"
        subtitle="Track delivered updates and, if you are a teacher or admin, schedule alerts for one or more recipients."
        actions={
          canManageNotifications ? (
            <Button
              variant="contained"
              startIcon={<AddAlertRoundedIcon />}
              onClick={openComposeDialog}
            >
              Compose notification
            </Button>
          ) : null
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      {canManageNotifications && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              spacing={2}
              sx={{ mb: scheduledNotifications.length ? 2.5 : 0 }}
            >
              <Box>
                <Typography variant="h5">Scheduled notifications</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  Pending notifications stay here until their trigger time. You can cancel them before delivery.
                </Typography>
              </Box>
              <Chip
                icon={<ScheduleRoundedIcon />}
                label={`${scheduledNotifications.length} pending`}
                color={scheduledNotifications.length ? 'primary' : 'default'}
                variant={scheduledNotifications.length ? 'filled' : 'outlined'}
              />
            </Stack>

            {!scheduledNotifications.length ? (
              <Typography variant="body2" color="text.secondary">
                No scheduled notifications are pending.
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {scheduledNotifications.map((notification) => (
                  <Card key={notification.batch_id} variant="outlined" sx={{ bgcolor: 'background.paper' }}>
                    <CardContent>
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        justifyContent="space-between"
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                        spacing={2}
                      >
                        <Stack spacing={0.75}>
                          <Typography variant="body1">{notification.message}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Recipients: {notification.user_ids.length}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Triggers at {formatDate(notification.trigger_at)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {notification.user_ids.join(', ')}
                          </Typography>
                        </Stack>
                        <Button
                          color="inherit"
                          startIcon={<EditCalendarRoundedIcon />}
                          onClick={() => openRescheduleDialog(notification)}
                        >
                          Reschedule
                        </Button>
                        <Button
                          color="inherit"
                          startIcon={<DeleteOutlineRoundedIcon />}
                          onClick={() => handleCancelScheduled(notification.batch_id)}
                        >
                          Cancel batch
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      {!notifications.length ? (
        <EmptyState
          title="No delivered notifications"
          description="You are up to date. Notifications will appear here once they are triggered."
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' },
            gap: 2.5,
          }}
        >
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              sx={{
                borderLeft: notification.read ? undefined : '4px solid',
                borderLeftColor: 'warning.main',
              }}
            >
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                  <Stack spacing={1.25}>
                    <Typography variant="body1">{notification.message}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Delivered {formatDate(notification.date)}
                    </Typography>
                    {notification.trigger_at && (
                      <Typography variant="body2" color="text.secondary">
                        Trigger time {formatDate(notification.trigger_at)}
                      </Typography>
                    )}
                  </Stack>
                  <Chip
                    label={notification.read ? 'Read' : 'Unread'}
                    color={notification.read ? 'default' : 'warning'}
                  />
                </Stack>
                {!notification.read && (
                  <Button
                    sx={{ mt: 2 }}
                    size="small"
                    startIcon={<MarkEmailReadRoundedIcon />}
                    onClick={() => handleMarkRead(notification.id)}
                  >
                    Mark as read
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Compose notification</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 3,
                border: '1px solid rgba(69,95,136,0.14)',
                bgcolor: 'rgba(247,250,252,0.9)',
              }}
            >
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">Recipient selection</Typography>
                <Typography variant="body2" color="text.secondary">
                  Build the recipient list from subjects, projects, or the user directory.
                </Typography>
                {sourceError && <Alert severity="warning">{sourceError}</Alert>}
                {directoryError && <Alert severity="warning">{directoryError}</Alert>}
                <TextField
                  select
                  label="Source type"
                  value={recipientSourceType}
                  onChange={(event) => setRecipientSourceType(event.target.value)}
                  disabled={sourceLoading || (!subjectOptions.length && !projectOptions.length)}
                >
                  <MenuItem value="subject" disabled={!subjectOptions.length}>
                    Subject
                  </MenuItem>
                  <MenuItem value="project" disabled={!projectOptions.length}>
                    Project
                  </MenuItem>
                </TextField>
                <TextField
                  select
                  label={recipientSourceType === 'subject' ? 'Subject' : 'Project'}
                  value={recipientSourceId}
                  onChange={(event) => setRecipientSourceId(event.target.value)}
                  disabled={
                    sourceLoading ||
                    !(recipientSourceType === 'subject' ? subjectOptions.length : projectOptions.length)
                  }
                  helperText={
                    recipientSourceType === 'subject'
                      ? 'Subjects use registered students and assigned teachers.'
                      : 'Projects use the project teacher and all current team members.'
                  }
                >
                  {(recipientSourceType === 'subject' ? subjectOptions : projectOptions).map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {'abbreviation' in item ? `${item.name} (${item.abbreviation})` : item.title}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="outlined"
                  onClick={handleAddRecipientsFromSource}
                  disabled={sourceLoading || !recipientSourceId}
                >
                  {sourceLoading ? 'Loading recipients...' : 'Add recipients from selection'}
                </Button>
                <Autocomplete
                  multiple
                  options={searchableDirectoryUsers}
                  value={selectedDirectoryUsers}
                  onChange={handleDirectorySelectionChange}
                  loading={directoryLoading}
                  filterSelectedOptions
                  getOptionLabel={(option) =>
                    `${userSearchLabel(option)} (${option.email || option.id})`
                  }
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Search users"
                      helperText="Search by name, email, or user ID and add matching recipients."
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Stack spacing={0.25}>
                        <Typography variant="body2">
                          {userSearchLabel(option)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.email} • {option.role} • {option.id}
                        </Typography>
                      </Stack>
                    </Box>
                  )}
                />
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2.5,
                    bgcolor: 'background.paper',
                    border: '1px solid rgba(167,180,186,0.22)',
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    spacing={1.5}
                  >
                    <Box>
                      <Typography variant="subtitle2">Selected recipients</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedRecipientIds.length
                          ? `${selectedRecipientIds.length} recipients selected`
                          : 'No recipients selected yet'}
                      </Typography>
                    </Box>
                    {selectedRecipientIds.length > 0 && (
                      <Button
                        size="small"
                        color="inherit"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, userIdsText: '' }))
                        }
                      >
                        Clear selection
                      </Button>
                    )}
                  </Stack>
                  {(selectedDirectoryUsers.length > 0 || selectedUnknownIds.length > 0) && (
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
                      {selectedDirectoryUsers.map((person) => (
                        <Chip
                          key={person.id}
                          label={`${userSearchLabel(person)} (${person.email})`}
                          variant="outlined"
                        />
                      ))}
                      {selectedUnknownIds.map((id) => (
                        <Chip key={id} label={id} variant="outlined" color="warning" />
                      ))}
                    </Stack>
                  )}
                </Box>
              </Stack>
            </Box>
            <TextField
              label="Message"
              multiline
              minRows={4}
              value={form.message}
              onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
            />
            <FormControl fullWidth>
              <InputLabel id="notification-trigger-mode-label">Trigger time</InputLabel>
              <Select
                labelId="notification-trigger-mode-label"
                label="Trigger time"
                value={form.triggerMode}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, triggerMode: event.target.value }))
                }
              >
                <MenuItem value="now">Now</MenuItem>
                <MenuItem value="date">Choose date</MenuItem>
              </Select>
            </FormControl>
            {form.triggerMode === 'date' && (
              <TextField
                label="Scheduled date"
                type="datetime-local"
                value={form.triggerAt}
                onChange={(event) => setForm((prev) => ({ ...prev, triggerAt: event.target.value }))}
                helperText="Choose when this notification batch should be triggered."
                InputLabelProps={{ shrink: true }}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained">
            Save notification
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={rescheduleDialogOpen}
        onClose={() => setRescheduleDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Reschedule notification batch</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {rescheduleBatch?.message || 'Update the trigger time for this scheduled batch.'}
            </Typography>
            <TextField
              label="New trigger time"
              type="datetime-local"
              value={rescheduleTriggerAt}
              onChange={(event) => setRescheduleTriggerAt(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRescheduleDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRescheduleScheduled} variant="contained">
            Save new time
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
