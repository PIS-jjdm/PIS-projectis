import { Box, Stack, Typography } from '@mui/material'

export default function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', md: 'center' }}
      spacing={2}
      sx={{ mb: 5 }}
    >
      <Box sx={{ maxWidth: 760 }}>
        {eyebrow && (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
            <Typography
              variant="overline"
              color="primary.main"
              sx={{ letterSpacing: 2, fontWeight: 700 }}
            >
              {eyebrow}
            </Typography>
            <Box sx={{ width: 44, height: 1, bgcolor: 'rgba(69,95,136,0.3)' }} />
          </Stack>
        )}
        <Typography variant="h3" sx={{ mt: 0.5, fontSize: { xs: '2rem', md: '2.9rem' } }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mt: 1.5, maxWidth: 680, lineHeight: 1.7 }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions}
    </Stack>
  )
}
