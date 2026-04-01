import { alpha } from '@mui/material/styles'
import { Card, CardContent, Stack, Typography } from '@mui/material'

export default function StatCard({ icon, label, value, color = 'primary.main', detail }) {
  return (
    <Card
      sx={{
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(145deg, ${alpha('#ffffff', 0.96)} 0%, ${alpha(
            '#dce9f7',
            0.36,
          )} 100%)`,
        },
      }}
    >
      <CardContent sx={{ position: 'relative' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Stack spacing={0.9}>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="h4" sx={{ lineHeight: 1 }}>
              {value}
            </Typography>
            {detail && (
              <Typography variant="body2" color="text.secondary">
                {detail}
              </Typography>
            )}
          </Stack>
          <Stack
            sx={{
              width: 60,
              height: 60,
              borderRadius: 5,
              bgcolor: `${color}15`,
              color,
              boxShadow: `inset 0 0 0 1px ${alpha('#132033', 0.04)}`,
            }}
            alignItems="center"
            justifyContent="center"
          >
            {icon}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
