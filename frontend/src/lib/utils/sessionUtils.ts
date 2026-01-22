export const generateSessionId = (userId?: string | null) => {
  const base = userId ? `session-${userId}` : "session"
  return `${base}-${Date.now()}`
}

export const getAuthToken = (token?: string | null) => {
  return token || null
}

export const getCurrentUserId = (userId?: string | null) => {
  return userId || null
}
