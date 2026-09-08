import io from 'socket.io-client'
import { watch } from 'vue'
import { i18n } from './i18n'

const socket = io('', {
  autoConnect: false
})

watch(i18n.global.locale, locale => {
  socket.io.opts.query = { ...socket.io.opts.query, locale }
  if (socket.connected) {
    socket.disconnect()
    socket.connect()
  }
}, { immediate: true, flush: 'sync' })

export default socket
