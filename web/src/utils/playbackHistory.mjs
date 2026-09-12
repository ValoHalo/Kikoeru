let pendingWrite = Promise.resolve()

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
