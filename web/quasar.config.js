import { defineConfig } from '#q-app/wrappers'

export default defineConfig(function () {
  const apiTarget = process.env.KIKOERU_DEV_API || 'http://127.0.0.1:8888'
  return {
    boot: [
      'store',
      'axios',
      'socket.io'
    ],

    css: [
      'app.scss'
    ],

    extras: [
      'roboto-font',
      'material-icons'
    ],

    build: {
      vueRouterMode: 'history',
      sourcemap: true
    },

    devServer: {
      port: 8080,
      open: false,
      proxy: {
        '/api': {
          target: apiTarget
        },
        '/socket.io': {
          target: apiTarget,
          ws: true
        },
        '/workbox': {
          target: apiTarget
        }
      }
    },

    framework: {
      config: {
        dark: 'auto'
      },
      plugins: [
        'LocalStorage',
        'SessionStorage',
        'Notify',
        'Dialog'
      ]
    },

    animations: [],

    pwa: {
      workboxMode: 'GenerateSW',
      injectPwaMetaTags: true,
      swFilename: 'service-worker.js',
      manifestFilename: 'manifest.json',
      extendGenerateSWOptions (options) {
        options.globIgnores = [
          ...(options.globIgnores || []),
          'manifest.json',
          '**/*.map'
        ]
        options.navigateFallbackDenylist = [
          ...(options.navigateFallbackDenylist || []),
          /^\/api\//,
          /\/media\//
        ]
      }
    }
  }
})
