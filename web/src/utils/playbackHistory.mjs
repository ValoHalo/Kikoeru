let pendingWrite = Promise.resolve()

function withStorage (fn, fallback) {
  try { return fn() } catch { return fallback }
}

export function playbackSignature (data) {
  const state = data?.state
  return JSON.stringify([data?.work_id, state?.queue?.[state.index]?.hash, Math.floor(state?.seconds || 0)])
}

export function readPlaybackRecovery (storage, user) {
  if (!user) return null
  return withStorage(() => {
    const saved = storage.getItem(`playback-recovery:${user}`)
    if (!saved?.data?.state?.queue?.length || Date.now() - saved.savedAt > 30 * 86400000) return null
    return saved
  }, null)
}

export function shouldOfferPlaybackRecovery (saved, work) {
  if (!saved?.data?.state?.queue?.length) return false
  const signature = playbackSignature(saved.data)
  if (signature === saved.syncedSignature || signature === saved.dismissedSignature) return false
  if (signature === playbackSignature({ work_id: work?.id, state: work?.state })) return false
  if (!work?.state) return true
  return saved.savedAt > Date.parse(work.play_updated_at_full)
}

export function dismissPlaybackRecovery (storage, user, data) {
  withStorage(() => {
    const saved = readPlaybackRecovery(storage, user)
    const signature = playbackSignature(data)
    if (saved && playbackSignature(saved.data) === signature) {
      storage.set(`playback-recovery:${user}`, { ...saved, dismissedSignature: signature })
    }
  })
}

export function cachePlaybackRecovery (storage, user, data) {
  if (!user) return
  withStorage(() => {
    const old = readPlaybackRecovery(storage, user)
    const unchanged = old && playbackSignature(old.data) === playbackSignature(data)
    storage.set(`playback-recovery:${user}`, { ...old, data, savedAt: unchanged ? old.savedAt : Date.now(), syncedSignature: old?.syncedSignature || '' })
  })
}

export function acknowledgePlaybackRecovery (storage, user, data) {
  withStorage(() => {
    const saved = readPlaybackRecovery(storage, user)
    if (saved) storage.set(`playback-recovery:${user}`, { ...saved, syncedSignature: playbackSignature(data) })
  })
}

export function discardPlaybackRecovery (storage, user) {
  withStorage(() => storage.remove(`playback-recovery:${user}`))
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
