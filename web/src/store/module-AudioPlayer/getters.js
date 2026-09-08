const getters = {
  hideNsfwCovers: (state) => state.contentDisplayMode === 'blur',
  sfwOnly: (state) => state.contentDisplayMode === 'sfw',
  shouldBlurCover: (state) => (workId) => state.contentDisplayMode === 'blur' && state.workNsfw[workId] !== false,
  coverUrl: (state, getters) => (workId, type = 'main', customUrl = '') => {
    if (!workId) return ''
    const coverPath = `/api/cover/${workId}?${new URLSearchParams({ type })}`
    if (!getters.shouldBlurCover(workId)) return customUrl || coverPath
    const url = new URL(customUrl || coverPath, window.location.origin)
    const localCover = url.pathname === `/api/cover/${workId}`
      || new RegExp(`^/api/media/(download|stream)/${Number(workId)}/[0-9]+$`).test(url.pathname)
    if (url.origin !== window.location.origin || !localCover) {
      return `${coverPath}&blurNsfw=1`
    }
    url.searchParams.delete('hideNsfw')
    url.searchParams.set('blurNsfw', '1')
    return `${url.pathname}${url.search}`
  },

  currentPlayingFile: (state) => {
    return state.queue[state.queueIndex] || {
      hash: '',
      title: '',
      workTitle: ''
    }
  },

  isCurrentPlayingFileVideo: (state) => {
    const title = (state.queue[state.queueIndex] || {title: ''}).title;
    return title.endsWith("mp4");
  },

  resumeHistroyDone: (state) => {
    return state.resumeHistroySeconds < 0
  },

  isQueueEmpty: (state) => {
    return state.queue.length == 0
  },

  transcodeBitRate: (state) => {
    return {
      'aac 128': 128,
      'aac 320': 320,
      off: 0,
    }[state.transcodeOption] || 0
  },
}

export default getters
