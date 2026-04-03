import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded'
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import { useEffect, useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'

const initialForm = {
  firstname: '',
  lastname: '',
  email: '',
  password: '',
  role: 'student',
}

export default function AdminUsersPage() {
  const { token, user } = useAuth()
  const session = useMemo(() => ({ token, user }), [token, user])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [form, setForm] = useState(initialForm)

  async function loadUsers() {
    setError('')
    const data = await api.listUsers(session)
    setUsers(data)
  }

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const data = await api.listUsers(session)
        if (active) setUsers(data)
      } catch (err) {
        if (active) setError(err.message || 'Failed to load users')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [token, user])

  function openCreateDialog() {
    setEditingUser(null)
    setForm(initialForm)
    setDialogOpen(true)
  }

  function openEditDialog(targetUser) {
    setEditingUser(targetUser)
    setForm({
      firstname: targetUser.firstname || '',
      lastname: targetUser.lastname || '',
      email: targetUser.email || '',
      password: '',
      role: targetUser.role || 'student',
    })
    setDialogOpen(true)
  }

  async function handleSubmitUser() {
    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      const saved = editingUser
        ? await api.updateUser(session, {
            user_id: editingUser.id,
            firstname: form.firstname,
            lastname: form.lastname,
            email: form.email,
            role: form.role,
          })
        : await api.createUser(session, form)
      setDialogOpen(false)
      setEditingUser(null)
      setForm(initialForm)
      await loadUsers()
      setSuccess(
        editingUser
          ? `Updated user ${saved.firstname} ${saved.lastname}.`
          : `Created user ${saved.firstname} ${saved.lastname}.`,
      )
    } catch (err) {
      setError(err.message || (editingUser ? 'Failed to update user' : 'Failed to create user'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingState />

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="User management"
        subtitle="Review registered users and create new accounts for students, teachers, and admins."
        actions={
          <Button
            variant="contained"
            startIcon={<PersonAddAlt1RoundedIcon />}
            onClick={openCreateDialog}
          >
            Create user
          </Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

      {!users.length ? (
        <EmptyState
          title="No users available"
          description="No user records were returned by the backend or mock layer."
          actionLabel="Create user"
          onAction={openCreateDialog}
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' },
            gap: 2.5,
          }}
        >
          {users.map((item) => (
            <Card key={item.id}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <ManageAccountsRoundedIcon />
                  </Avatar>
                  <Stack sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" noWrap>
                      {item.firstname} {item.lastname}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {item.email}
                    </Typography>
                  </Stack>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 2 }} useFlexGap flexWrap="wrap">
                  <Chip label={item.role} color="secondary" />
                  <Chip label={item.id} variant="outlined" />
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<EditRoundedIcon />}
                    onClick={() => openEditDialog(item)}
                  >
                    Edit
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingUser ? 'Edit user' : 'Create user'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="First name"
              value={form.firstname}
              onChange={(event) => setForm((prev) => ({ ...prev, firstname: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Last name"
              value={form.lastname}
              onChange={(event) => setForm((prev) => ({ ...prev, lastname: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              fullWidth
            />
            {!editingUser && (
              <TextField
                label="Password"
                type="password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                fullWidth
              />
            )}
            <TextField
              select
              label="Role"
              value={form.role}
              onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
              fullWidth
            >
              <MenuItem value="student">Student</MenuItem>
              <MenuItem value="teacher">Teacher</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmitUser} variant="contained" disabled={submitting}>
            {submitting ? (editingUser ? 'Saving...' : 'Creating...') : (editingUser ? 'Save changes' : 'Create user')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
