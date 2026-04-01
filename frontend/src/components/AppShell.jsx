import {
  Alert,
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded'
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded'
import KeyRoundedIcon from '@mui/icons-material/KeyRounded'
import { useTheme } from '@mui/material/styles'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'

const drawerWidth = 256

function navItems(role, unreadCount) {
  const items = [
    {
      label: 'Dashboard',
      subtitle: 'Overview',
      path: '/dashboard',
      icon: <DashboardRoundedIcon />,
    },
    {
      label: 'Subjects',
      subtitle: 'Catalogue',
      path: '/subjects',
      icon: <MenuBookRoundedIcon />,
    },
    {
      label: 'Projects',
      subtitle: 'Submission',
      path: '/projects',
      icon: <UploadFileRoundedIcon />,
    },
    {
      label: 'Notifications',
      subtitle: 'Updates',
      path: '/notifications',
      icon: <NotificationsRoundedIcon />,
      badge: unreadCount,
    },
  ]

  if (role === 'admin') {
    items.push({
      label: 'Administration',
      subtitle: 'Users',
      path: '/admin/users',
      icon: <AdminPanelSettingsRoundedIcon />,
    })
  }

  return items
}

export default function AppShell() {
  const theme = useTheme()
  const mobile = useMediaQuery(theme.breakpoints.down('lg'))
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, user, token } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [accountAnchorEl, setAccountAnchorEl] = useState(null)
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })

  useEffect(() => {
    let active = true

    async function loadNotifications() {
      if (!user) return
      try {
        const items = await api.listNotifications({ token, user }, user.id)
        if (active) {
          setUnreadCount(items.filter((item) => !item.read).length)
        }
      } catch {
        if (active) setUnreadCount(0)
      }
    }

    loadNotifications()
    return () => {
      active = false
    }
  }, [token, user, location.pathname])

  const items = useMemo(() => navItems(user?.role, unreadCount), [user?.role, unreadCount])
  const current = items.find((item) => item.path === location.pathname) || items[0]
  const accountMenuOpen = Boolean(accountAnchorEl)

  function resetPasswordForm() {
    setPasswordForm({
      current_password: '',
      new_password: '',
      confirm_password: '',
    })
  }

  function openProfileDialog() {
    setProfileDialogOpen(true)
    setProfileError('')
    setProfileSuccess('')
    resetPasswordForm()
    setAccountAnchorEl(null)
  }

  async function handlePasswordChange() {
    setProfileError('')
    setProfileSuccess('')

    if (!passwordForm.current_password || !passwordForm.new_password) {
      setProfileError('Current password and new password are required.')
      return
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setProfileError('New password confirmation does not match.')
      return
    }

    setSavingPassword(true)
    try {
      await api.changePassword({ token, user }, {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      })
      setProfileSuccess('Password updated successfully.')
      resetPasswordForm()
    } catch (error) {
      setProfileError(error.message || 'Failed to update password')
    } finally {
      setSavingPassword(false)
    }
  }

  const drawerContent = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        p: 2,
        gap: 2,
        fontFamily: 'Manrope, sans-serif',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 1, pt: 1 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <SchoolRoundedIcon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontSize: 18, lineHeight: 1.1, color: '#1e3a5f' }}>
            Scholarly Curator
          </Typography>
          <Typography
            variant="caption"
            sx={{ textTransform: 'uppercase', letterSpacing: '0.18em', color: 'text.secondary' }}
          >
            {user?.role || 'workspace'}
          </Typography>
        </Box>
      </Stack>

      <List sx={{ px: 0, py: 0 }}>
        {items.map((item) => {
          const active = location.pathname === item.path
          return (
            <ListItemButton
              key={item.path}
              onClick={() => {
                navigate(item.path)
                setDrawerOpen(false)
              }}
              sx={{
                gap: 1.5,
                borderRadius: 2,
                mb: 0.5,
                px: 1.5,
                py: 1.2,
                color: active ? '#1e3a5f' : '#546166',
                bgcolor: active ? 'rgba(214, 227, 255, 0.7)' : 'transparent',
                '&:hover': {
                  bgcolor: active ? 'rgba(214, 227, 255, 0.86)' : 'rgba(239, 244, 247, 0.9)',
                  transform: 'translateX(4px)',
                },
                transition: 'background-color 0.2s ease, transform 0.2s ease',
              }}
            >
              <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
                {item.badge ? (
                  <Badge color="error" badgeContent={item.badge}>
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                secondary={item.subtitle}
                primaryTypographyProps={{ fontWeight: active ? 700 : 600, fontSize: 14 }}
                secondaryTypographyProps={{ fontSize: 12, color: 'inherit', opacity: 0.75 }}
              />
            </ListItemButton>
          )
        })}
      </List>

      <Box
        sx={{
          mt: 'auto',
          p: 2,
          borderRadius: 3,
          bgcolor: '#eff4f7',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
          QUICK HELP
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.7 }}>
          Use the dashboard for overall status, then move into project submission for detailed work.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Tooltip title="Help">
            <IconButton size="small">
              <HelpOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Sign out">
            <IconButton
              size="small"
              onClick={async () => {
                await logout()
                navigate('/login')
              }}
            >
              <LogoutRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Drawer
        variant={mobile ? 'temporary' : 'permanent'}
        open={mobile ? drawerOpen : true}
        onClose={() => setDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid rgba(167, 180, 186, 0.18)',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box sx={{ ml: { lg: `${drawerWidth}px` }, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AppBar position="sticky" elevation={0}>
          <Toolbar sx={{ px: { xs: 2, md: 4 }, minHeight: '64px !important' }}>
            {mobile && (
              <IconButton edge="start" onClick={() => setDrawerOpen(true)} sx={{ mr: 1 }}>
                <MenuRoundedIcon />
              </IconButton>
            )}
            <Stack direction="row" spacing={4} alignItems="center" sx={{ flexGrow: 1 }}>
              <Typography variant="h6" sx={{ fontSize: 20, color: '#455f88' }}>
                Scholarly Curator
              </Typography>
              <Stack
                direction="row"
                spacing={3}
                sx={{ display: { xs: 'none', md: 'flex' }, fontFamily: 'Manrope, sans-serif' }}
              >
                {items.slice(0, 4).map((item) => {
                  const active = location.pathname === item.path
                  return (
                    <Box
                      key={item.path}
                      component="button"
                      onClick={() => navigate(item.path)}
                      sx={{
                        background: 'transparent',
                        border: 0,
                        cursor: 'pointer',
                        pb: 0.75,
                        color: active ? '#455f88' : '#546166',
                        borderBottom: active ? '2px solid #455f88' : '2px solid transparent',
                        fontWeight: active ? 700 : 500,
                        fontFamily: 'inherit',
                      }}
                    >
                      {item.label}
                    </Box>
                  )
                })}
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1.5} alignItems="center">
              <Tooltip title="Notifications">
                <IconButton>
                  <Badge color="error" badgeContent={unreadCount}>
                    <NotificationsRoundedIcon sx={{ color: 'text.secondary' }} />
                  </Badge>
                </IconButton>
              </Tooltip>
              <Tooltip title="Account">
                <IconButton onClick={(event) => setAccountAnchorEl(event.currentTarget)}>
                  <Avatar
                    sx={{
                      width: 34,
                      height: 34,
                      bgcolor: 'rgba(214, 227, 255, 0.9)',
                      color: 'primary.main',
                      border: '2px solid rgba(214, 227, 255, 1)',
                    }}
                  >
                    {user?.firstname?.[0] || 'U'}
                  </Avatar>
                </IconButton>
              </Tooltip>
            </Stack>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ flex: 1, px: { xs: 2, md: 5 }, py: { xs: 3, md: 5 } }}>
          <Box sx={{ maxWidth: '1200px', mx: 'auto', width: '100%' }}>
            <Outlet context={{ currentSection: current }} />
          </Box>
        </Box>
      </Box>

      <Menu
        anchorEl={accountAnchorEl}
        open={accountMenuOpen}
        onClose={() => setAccountAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={openProfileDialog}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <AccountCircleRoundedIcon fontSize="small" />
            <Typography variant="body2">Info</Typography>
          </Stack>
        </MenuItem>
        <MenuItem
          onClick={async () => {
            setAccountAnchorEl(null)
            await logout()
            navigate('/login')
          }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center">
            <LogoutRoundedIcon fontSize="small" />
            <Typography variant="body2">Logout</Typography>
          </Stack>
        </MenuItem>
      </Menu>

      <Dialog open={profileDialogOpen} onClose={() => setProfileDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Account info</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Signed-in user
              </Typography>
              <Typography variant="h6" sx={{ mt: 0.5 }}>
                {user?.firstname} {user?.lastname}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.email}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Role: {user?.role}
              </Typography>
            </Box>

            <Box
              sx={{
                p: 2,
                borderRadius: 3,
                border: '1px solid rgba(69,95,136,0.14)',
                bgcolor: 'rgba(247,250,252,0.9)',
              }}
            >
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
                <KeyRoundedIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2">Change password</Typography>
              </Stack>
              {profileError && <Alert severity="error" sx={{ mb: 2 }}>{profileError}</Alert>}
              {profileSuccess && <Alert severity="success" sx={{ mb: 2 }}>{profileSuccess}</Alert>}
              <Stack spacing={2}>
                <TextField
                  label="Current password"
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, current_password: event.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  label="New password"
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, new_password: event.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  label="Confirm new password"
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({ ...prev, confirm_password: event.target.value }))
                  }
                  fullWidth
                />
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProfileDialogOpen(false)}>Close</Button>
          <Button onClick={handlePasswordChange} variant="contained" disabled={savingPassword}>
            {savingPassword ? 'Saving...' : 'Save password'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
