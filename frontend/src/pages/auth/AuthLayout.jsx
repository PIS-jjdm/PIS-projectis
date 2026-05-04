import {
  Box,
  Card,
  CardContent,
  Container,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import { useThemeMode } from '../../contexts/ThemeModeContext'

export default function AuthLayout({ title, subtitle, children }) {
  const { mode, toggleMode } = useThemeMode()
  const isDark = mode === 'dark'
  return (
    <Box
      sx={(theme) => ({
        position: 'relative',
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: isDark
          ? `radial-gradient(circle at top left, rgba(21,101,192,0.18), transparent 42%), radial-gradient(circle at bottom right, rgba(0,137,123,0.18), transparent 36%), ${theme.palette.background.default}`
          : 'radial-gradient(circle at top left, rgba(21,101,192,0.14), transparent 42%), radial-gradient(circle at bottom right, rgba(0,137,123,0.14), transparent 36%), #f4f7fb',
        py: 4,
      })}
    >
      <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
        <IconButton
          onClick={toggleMode}
          aria-label="toggle theme"
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            color: isDark ? 'common.white' : 'text.primary',
          }}
        >
          {isDark ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
        </IconButton>
      </Tooltip>
      <Container maxWidth="md">
        <Card sx={{ overflow: 'hidden' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1.1fr 0.9fr' },
              minHeight: { md: 640 },
            }}
          >
            <Box
              sx={{
                p: { xs: 4, md: 5 },
                background:
                  'linear-gradient(135deg, rgba(21,101,192,1) 0%, rgba(0,137,123,1) 100%)',
                color: 'common.white',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Stack spacing={2}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <AssignmentTurnedInRoundedIcon sx={{ fontSize: 34 }} />
                  <Typography variant="h5">Scholarly Curator</Typography>
                </Stack>
                <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                  Manage subjects, projects, teams, and notifications.
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.92, maxWidth: 520 }}>
                  A single interface for students, teachers, and admins to handle the complete registration workflow.
                </Typography>
              </Stack>
              <Stack spacing={1.25} sx={{ mt: 6 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Included workflows
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.92 }}>
                  • Student registration and team creation
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.92 }}>
                  • Teacher project monitoring and notifications
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.92 }}>
                  • Admin subject and user oversight
                </Typography>
              </Stack>
            </Box>
            <CardContent sx={{ p: { xs: 3, sm: 4, md: 5 } }}>
              <Typography variant="h4">{title}</Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1, mb: 4 }}>
                {subtitle}
              </Typography>
              {children}
            </CardContent>
          </Box>
        </Card>
      </Container>
    </Box>
  )
}
