import {
  Alert,
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
import { useCallback, useEffect, useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/LoadingState'
import PageHeader from '../components/PageHeader'
import UserAvatar from '../components/UserAvatar'
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
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [form, setForm] = useState(initialForm)

  const loadUsers = useCallback(async () => {
    setError('')
    const data = await api.listUsers(session)
    setUsers(data)
  }, [session])

  useEffect(() => {
    let active = true

    async function load() {
      try {
        await loadUsers()
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
  }, [loadUsers])

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

  function isSelfRoleChange() {
    return editingUser?.id === user?.id && form.role !== user?.role
  }

  function validateUserForm() {
    const firstname = form.firstname.trim()
    const lastname = form.lastname.trim()
    const email = form.email.trim()
    if (!firstname) return 'First name is required.'
    if (!lastname) return 'Last name is required.'
    if (!email) return 'Email is required.'
    // RFC 5322 simplified: local@domain with dot in domain
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Email format is invalid.'
    }
    if (!editingUser && !form.password) return 'Password is required.'
    if (!editingUser && form.password.length < 8) {
      return 'Password must be at least 8 characters.'
    }
    return ''
  }

  async function submitUser() {
    setError('')
    setSuccess('')

    const validationError = validateUserForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    try {
      const saved = editingUser
        ? await api.updateUser(session, {
            user_id: editingUser.id,
            firstname: form.firstname.trim(),
            lastname: form.lastname.trim(),
            email: form.email.trim(),
            role: form.role,
          })
        : await api.createUser(session, {
            ...form,
            firstname: form.firstname.trim(),
            lastname: form.lastname.trim(),
            email: form.email.trim(),
          })
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

  function handleSubmitUser() {
    if (isSelfRoleChange()) {
      setConfirmDialogOpen(true)
      return
    }

    submitUser()
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
                <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="flex-start">
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                    <UserAvatar userId={item.id} sx={{ bgcolor: 'primary.main' }}>
                      <ManageAccountsRoundedIcon />
                    </UserAvatar>
                    <Stack sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle1" noWrap>
                        {item.firstname} {item.lastname}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {item.email}
                      </Typography>
                    </Stack>
                  </Stack>
                  <Stack alignItems="flex-end" sx={{ flexShrink: 0 }}>
                    <Chip label={item.role} color="secondary" />
                  </Stack>
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
              required
              label="First name"
              value={form.firstname}
              onChange={(event) => setForm((prev) => ({ ...prev, firstname: event.target.value }))}
              fullWidth
            />
            <TextField
              required
              label="Last name"
              value={form.lastname}
              onChange={(event) => setForm((prev) => ({ ...prev, lastname: event.target.value }))}
              fullWidth
            />
            <TextField
              required
              label="Email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              fullWidth
            />
            {!editingUser && (
              <TextField
                required
                label="Password"
                type="password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                helperText="At least 8 characters."
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

      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Confirm role change</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            You are changing your own role from admin to {form.role}. After saving, you will lose
            access to administration features.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button
            color="warning"
            variant="contained"
            onClick={() => {
              setConfirmDialogOpen(false)
              submitUser()
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
