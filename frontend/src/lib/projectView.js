export function displayUserName(user) {
  if (!user) return 'Unknown user'
  const name = `${user.firstname || ''} ${user.lastname || ''}`.trim()
  return name || user.email || user.id || 'Unknown user'
}

export function formatFileSize(bytes) {
  const value = Number(bytes || 0)
  if (!Number.isFinite(value) || value <= 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  let unitIndex = 0
  let size = value
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`
}

export function ownTeamForUser(teams, userId) {
  return teams.find((team) => (team.student_ids || []).includes(userId)) || null
}
