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
  const [creating, setCreating] = useState(false)
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

  async function handleCreateUser() {
    setError('')
    setSuccess('')
    setCreating(true)

    try {
      const created = await api.createUser(session, form)
      setDialogOpen(false)
      setForm(initialForm)
      await loadUsers()
      setSuccess(`Created user ${created.firstname} ${created.lastname}.`)
    } catch (err) {
      setError(err.message || 'Failed to create user')
    } finally {
      setCreating(false)
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
            onClick={() => {
              setForm(initialForm)
              setDialogOpen(true)
            }}
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
          onAction={() => {
            setForm(initialForm)
            setDialogOpen(true)
          }}
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
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create user</DialogTitle>
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
            <TextField
              label="Password"
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              fullWidth
            />
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
          <Button onClick={handleCreateUser} variant="contained" disabled={creating}>
            {creating ? 'Creating...' : 'Create user'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
