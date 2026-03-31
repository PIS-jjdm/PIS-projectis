export const config = {
  apiMode: (import.meta.env.VITE_API_MODE || 'hybrid').toLowerCase(),
}

export function isMockMode() {
  return config.apiMode === 'mock'
}

export function isHybridMode() {
  return config.apiMode === 'hybrid'
}
