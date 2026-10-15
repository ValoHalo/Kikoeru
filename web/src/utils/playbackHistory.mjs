let pendingWrite = Promise.resolve()

export function playbackSignature (data) {
  const state = data?.state
  return JSON.stringify([data?.work_id, state?.queue?.[state.index]?.hash, Math.floor(state?.seconds || 0)])
}

export function readPlaybackRecovery (storage, user) {
  if (!user) return null
  try {
    const saved = storage.getItem(`playback-recovery:${user}`)
    if (!saved?.data?.state?.queue?.length || Date.now() - saved.savedAt > 30 * 86400000) return null
    return saved
  } catch { return null }
}

export function cachePlaybackRecovery (storage, user, data) {
  if (!user) return
  try {
    const old = readPlaybackRecovery(storage, user)
    storage.set(`playback-recovery:${user}`, { data, savedAt: Date.now(), syncedSignature: old?.syncedSignature || '' })
  } catch { /* Playback continues when browser storage is unavailable. */ }
}

export function acknowledgePlaybackRecovery (storage, user, data) {
  try {
    const saved = readPlaybackRecovery(storage, user)
    if (saved) storage.set(`playback-recovery:${user}`, { ...saved, syncedSignature: playbackSignature(data) })
  } catch { /* The server has already saved this position. */ }
}

export function discardPlaybackRecovery (storage, user) {
  try { storage.remove(`playback-recovery:${user}`) } catch { /* Storage may be disabled. */ }
}

export function savePlaybackHistory (axios, data) {
  const request = pendingWrite.then(() => axios.put('/api/histroy', data))
  pendingWrite = request.catch(() => {})
  return request
}

export function clearPlaybackHistory (axios) {
  const request = pendingWrite.then(() => axios.delete('/api/histroy/all'))
  pendingWrite = request.catch(() => {})
  return request
}
