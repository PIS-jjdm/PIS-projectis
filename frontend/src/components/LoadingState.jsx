import { Box, CircularProgress, Paper, Stack, Typography } from '@mui/material'

export default function LoadingState() {
  return (
    <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}>
      <Paper
        sx={{
          px: 4,
          py: 3,
          borderRadius: 3,
          minWidth: 220,
          textAlign: 'center',
          boxShadow: 'none',
        }}
      >
        <Stack spacing={1.5} alignItems="center">
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            Loading workspace
          </Typography>
        </Stack>
      </Paper>
    </Box>
  )
}
