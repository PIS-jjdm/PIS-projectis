export function avatarUrl(userId, version = '') {
  if (!userId) return ''
  const url = `/static/avatar/${encodeURIComponent(userId)}.png`
  return version ? `${url}?v=${encodeURIComponent(version)}` : url
}
