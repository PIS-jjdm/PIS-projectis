import {
  Alert,
  AppBar,
  Badge,
  Box,
  Button,
  ButtonBase,
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
  Snackbar,
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
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded'
import KeyRoundedIcon from '@mui/icons-material/KeyRounded'
import { alpha, useTheme } from '@mui/material/styles'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useThemeMode } from '../contexts/ThemeModeContext'
import { api } from '../lib/api'
import UserAvatar from './UserAvatar'

const drawerWidth = 256
const SUPPORTED_AVATAR_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/bmp',
])

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
      subtitle: 'My work',
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

function notificationToastMessage(notification) {
  const firstLine = String(notification?.message || '').split(/\r?\n/, 1)[0]?.trim()
  return firstLine || 'New notification received.'
}

function notificationSenderLabel(notification) {
  if (notification?.creator_user_id === 'system') {
    return 'System'
  }

  const sender = notification?.sender
  if (!sender) {
    return notification?.creator_user_id || 'Unknown sender'
  }

  return `${sender.firstname || ''} ${sender.lastname || ''}`.trim() || sender.email || sender.id
}

function renderNotificationMessage(message) {
  const [firstLine = '', ...restLines] = String(message || '').split(/\r?\n/)
  const remainingText = restLines.join('\n')

  return (
    <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
      <Box component="span" sx={{ fontWeight: 700 }}>
        {firstLine}
      </Box>
      {remainingText ? `\n${remainingText}` : ''}
    </Typography>
  )
}

export default function AppShell() {
  const theme = useTheme()
  const mobile = useMediaQuery(theme.breakpoints.down('lg'))
  const location = useLocation()
  const navigate = useNavigate()
  const { logout, user, token } = useAuth()
  const { mode, toggleMode } = useThemeMode()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [accountAnchorEl, setAccountAnchorEl] = useState(null)
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [avatarVersion, setAvatarVersion] = useState(() => Date.now().toString())
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null)
  const [pendingAvatarPreviewUrl, setPendingAvatarPreviewUrl] = useState('')
  const [latestStreamedNotification, setLatestStreamedNotification] = useState(null)
  const [detailNotification, setDetailNotification] = useState(null)
  const [lastReadNotificationId, setLastReadNotificationId] = useState('')
  const [notificationToast, setNotificationToast] = useState({
    open: false,
    notification: null,
    message: '',
  })
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const avatarInputRef = useRef(null)

  useEffect(() => {
    let active = true

    async function loadNotifications() {
      if (!user) return
      try {
        const items = await api.listNotifications({ token, user })
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

  useEffect(() => {
    if (!token || !user?.id) {
      setLatestStreamedNotification(null)
      return undefined
    }

    return api.subscribeNotifications(
      { token, user },
      {
        onMessage: (item) => {
          if (!item) return

          setLatestStreamedNotification(item)
          if (!item.read) {
            setUnreadCount((current) => current + 1)
          }
          setNotificationToast({
            open: true,
            notification: item,
            message: notificationToastMessage(item),
          })
        },
      },
    )
  }, [token, user])

  useEffect(() => {
    if (!pendingAvatarFile) {
      setPendingAvatarPreviewUrl('')
      return
    }

    const previewUrl = URL.createObjectURL(pendingAvatarFile)
    setPendingAvatarPreviewUrl(previewUrl)

    return () => {
      URL.revokeObjectURL(previewUrl)
    }
  }, [pendingAvatarFile])

  const items = useMemo(() => navItems(user?.role, unreadCount), [user?.role, unreadCount])
  const current =
    items.find(
      (item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`),
    ) || items[0]
  const accountMenuOpen = Boolean(accountAnchorEl)
  const accountAvatarSrc = pendingAvatarPreviewUrl || ''

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
    setPendingAvatarFile(null)
    resetPasswordForm()
    setAccountAnchorEl(null)
  }

  async function handleLogout() {
    setAccountAnchorEl(null)
    await logout()
    navigate('/login')
  }

  function handleNotificationRead() {
    setUnreadCount((current) => Math.max(current - 1, 0))
  }

  async function markNotificationAsRead(notification) {
    if (!notification?.id || notification.read) {
      return
    }

    await api.markNotificationRead({ token, user }, notification.id)
    handleNotificationRead()
    setLastReadNotificationId(notification.id)
    setDetailNotification((current) =>
      current?.id === notification.id ? { ...current, read: true } : current,
    )
    setLatestStreamedNotification((current) =>
      current?.id === notification.id ? { ...current, read: true } : current,
    )
    setNotificationToast((current) =>
      current.notification?.id === notification.id
        ? {
            ...current,
            notification: { ...current.notification, read: true },
          }
        : current,
    )
  }

  async function openNotificationDetail(notification) {
    if (!notification) {
      return
    }

    setNotificationToast((current) => ({ ...current, open: false }))
    setDetailNotification(notification)

    try {
      await markNotificationAsRead(notification)
    } catch {
      // Keep the detail dialog open even if marking as read fails.
    }
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

  async function handleAvatarSelected(event) {
    const file = event.target.files?.[0]
    if (!file) {
      event.target.value = ''
      return
    }

    setProfileError('')
    setProfileSuccess('')

    if (file.size <= 0) {
      setProfileError('Selected file is empty.')
      event.target.value = ''
      return
    }

    if (file.type && !SUPPORTED_AVATAR_TYPES.has(file.type)) {
      setProfileError('Unsupported image format. Use PNG, JPEG, WebP, GIF, or BMP.')
      event.target.value = ''
      return
    }

    setPendingAvatarFile(file)
    setProfileSuccess(`Selected avatar: ${file.name}`)
    event.target.value = ''
  }

  async function handleAvatarApply() {
    if (!pendingAvatarFile || !user?.id || !token) {
      return
    }

    setProfileError('')
    setProfileSuccess('')
    setSavingAvatar(true)

    try {
      await api.setUserAvatar(
        { token, user },
        {
          user_id: user.id,
          image_data: new Uint8Array(await pendingAvatarFile.arrayBuffer()),
        },
      )
      setPendingAvatarFile(null)
      setAvatarVersion(Date.now().toString())
      setProfileSuccess('Avatar updated successfully.')
    } catch (error) {
      setProfileError(error.message || 'Failed to update avatar')
    } finally {
      setSavingAvatar(false)
    }
  }

  async function handleAvatarReset() {
    if (!user?.id || !token) {
      return
    }

    setProfileError('')
    setProfileSuccess('')
    setPendingAvatarFile(null)
    setSavingAvatar(true)

    try {
      await api.setUserAvatar(
        { token, user },
        {
          user_id: user.id,
          image_data: new Uint8Array(),
        },
      )
      setAvatarVersion(Date.now().toString())
      setProfileSuccess('Avatar reset to default.')
    } catch (error) {
      setProfileError(error.message || 'Failed to reset avatar')
    } finally {
      setSavingAvatar(false)
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
          <Typography variant="h6" sx={{ fontSize: 18, lineHeight: 1.1, color: 'text.primary' }}>
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
          const active =
            location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
          return (
            <ListItemButton
              key={item.path}
              onClick={() => {
                navigate(item.path)
                setDrawerOpen(false)
              }}
              sx={(theme) => ({
                gap: 1.5,
                borderRadius: 2,
                mb: 0.5,
                px: 1.5,
                py: 1.2,
                color: active ? theme.palette.primary.main : theme.palette.text.secondary,
                bgcolor: active
                  ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.22 : 0.12)
                  : 'transparent',
                '&:hover': {
                  bgcolor: alpha(
                    theme.palette.primary.main,
                    active ? (theme.palette.mode === 'dark' ? 0.3 : 0.18) : 0.08,
                  ),
                  transform: 'translateX(4px)',
                },
                transition: 'background-color 0.2s ease, transform 0.2s ease',
              })}
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
        sx={(theme) => ({
          mt: 'auto',
          p: 2,
          borderRadius: 3,
          bgcolor:
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.common.white, 0.04)
              : '#eff4f7',
          fontFamily: 'Inter, sans-serif',
        })}
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
              onClick={handleLogout}
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
              <Typography variant="h6" sx={{ fontSize: 20, color: 'primary.main' }}>
                Scholarly Curator
              </Typography>
              <Stack
                direction="row"
                spacing={3}
                sx={{ display: { xs: 'none', md: 'flex' }, fontFamily: 'Manrope, sans-serif' }}
              >
                {items.slice(0, 4).map((item) => {
                  const active =
                    location.pathname === item.path ||
                    location.pathname.startsWith(`${item.path}/`)
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
                        color: active ? 'primary.main' : 'text.secondary',
                        borderBottom: (theme) =>
                          `2px solid ${active ? theme.palette.primary.main : 'transparent'}`,
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
              <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
                <IconButton onClick={toggleMode} aria-label="Toggle theme">
                  {mode === 'dark' ? (
                    <LightModeRoundedIcon sx={{ color: 'text.secondary' }} />
                  ) : (
                    <DarkModeRoundedIcon sx={{ color: 'text.secondary' }} />
                  )}
                </IconButton>
              </Tooltip>
              <Tooltip title="Notifications">
                <IconButton onClick={() => navigate('/notifications')}>
                  <Badge color="error" badgeContent={unreadCount}>
                    <NotificationsRoundedIcon sx={{ color: 'text.secondary' }} />
                  </Badge>
                </IconButton>
              </Tooltip>
              <Tooltip title="Account">
                <IconButton onClick={(event) => setAccountAnchorEl(event.currentTarget)}>
                  <UserAvatar
                    userId={user?.id}
                    version={avatarVersion}
                    size={34}
                    sx={{
                      bgcolor: 'rgba(214, 227, 255, 0.9)',
                      color: 'primary.main',
                      border: '2px solid rgba(214, 227, 255, 1)',
                    }}
                  >
                    {user?.firstname?.[0] || 'U'}
                  </UserAvatar>
                </IconButton>
              </Tooltip>
            </Stack>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ flex: 1, px: { xs: 2, md: 5 }, py: { xs: 3, md: 5 } }}>
          <Box sx={{ maxWidth: '1200px', mx: 'auto', width: '100%' }}>
            <Outlet
              context={{
                currentSection: current,
                latestStreamedNotification,
                lastReadNotificationId,
                onNotificationRead: handleNotificationRead,
              }}
            />
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
          onClick={handleLogout}
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
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Box>
                  <ButtonBase
                    onClick={() => {
                      if (!savingAvatar) {
                        avatarInputRef.current?.click()
                      }
                    }}
                    sx={{ borderRadius: '50%' }}
                  >
                    <UserAvatar
                      userId={user?.id}
                      version={avatarVersion}
                      src={accountAvatarSrc}
                      size={88}
                      sx={{
                        bgcolor: 'rgba(214, 227, 255, 0.9)',
                        color: 'primary.main',
                        cursor: savingAvatar ? 'progress' : 'pointer',
                        border: pendingAvatarFile ? '2px solid rgba(25, 118, 210, 0.45)' : 'none',
                      }}
                    >
                      {user?.firstname?.[0] || 'U'}
                    </UserAvatar>
                  </ButtonBase>
                </Box>
                <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="contained"
                    disabled={savingAvatar || !pendingAvatarFile}
                    onClick={handleAvatarApply}
                    sx={{
                      '&.Mui-disabled': {
                        bgcolor: 'rgba(160, 174, 192, 0.45)',
                        color: 'rgba(57, 70, 86, 0.82)',
                      },
                    }}
                  >
                    {savingAvatar ? 'Saving...' : 'Set avatar'}
                  </Button>
                  <Button
                    variant="text"
                    color="inherit"
                    disabled={savingAvatar}
                    onClick={handleAvatarReset}
                  >
                    Reset avatar
                  </Button>
                </Stack>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
                  hidden
                  onChange={handleAvatarSelected}
                />
              </Stack>
              {pendingAvatarFile && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Previewing: {pendingAvatarFile.name}
                </Typography>
              )}
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

      <Dialog
        open={Boolean(detailNotification)}
        onClose={() => setDetailNotification(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Notification details</DialogTitle>
        <DialogContent>
          {detailNotification && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                spacing={1.5}
                sx={{ minWidth: 0 }}
              >
                <Typography variant="body2" color="text.secondary" noWrap sx={{ minWidth: 0, flex: 1 }}>
                  From{' '}
                  <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    {notificationSenderLabel(detailNotification)}
                  </Box>
                </Typography>
                {detailNotification.date && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                  >
                    {new Date(detailNotification.date).toLocaleString()}
                  </Typography>
                )}
              </Stack>
              {renderNotificationMessage(detailNotification.message)}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailNotification(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={notificationToast.open}
        autoHideDuration={4000}
        onClose={() => setNotificationToast((current) => ({ ...current, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity="info"
          variant="filled"
          onClick={() => openNotificationDetail(notificationToast.notification)}
          onClose={() => setNotificationToast((current) => ({ ...current, open: false }))}
          sx={{ width: '100%', cursor: notificationToast.notification ? 'pointer' : 'default' }}
        >
          <Typography variant="body2" sx={{ opacity: 0.84 }}>
            {notificationSenderLabel(notificationToast.notification)}
          </Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {notificationToast.message}
          </Typography>
        </Alert>
      </Snackbar>
    </Box>
  )
}
