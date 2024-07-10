/* eslint-disable no-console */
import { defineConfig, loadEnv, createLogger } from 'vite'
import dns from 'dns'
import vue from '@vitejs/plugin-vue'
import svgLoader from 'vite-svg-loader'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { visualizer } from 'rollup-plugin-visualizer'

const path = require('path');

function mutateCookieAttributes(proxy) {
  proxy.on('proxyRes', function (proxyRes, req, res) {
    if (proxyRes.headers['set-cookie']) {
      proxyRes.headers['set-cookie'] = (proxyRes.headers['set-cookie']).map(h => {
        return h.replace(/Domain=.*;/, 'Domain=localhost; Secure;')
      })
    }
  })
}

function setHostHeader(proxy) {
  const host = new URL(process.env.VITE_PORTAL_API_URL).hostname

  proxy.on('proxyReq', function (proxyRes) {
    proxyRes.setHeader('host', host)
  })
}

/**
 * Create a custom logger to ignore `vite:css` errors (from postcss) for imported packages
 */
function createCustomLogger() {
  const logger = createLogger()
  const loggerWarn = logger.warn
  // Create array of partial message strings to ignore
  const ignoredWarnings = [
    'end value has mixed support'
  ]

  logger.warn = (msg, options) => {
    // if the msg includes `vite:css` and one of the `ignoredWarnings`, ignore and do not log
    if (msg.includes('vite:css') && ignoredWarnings.some((partialMsg) => msg.includes(partialMsg))) return
    loggerWarn(msg, options)
  }

  return logger
}

export default defineConfig(({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) }

  // Include the rollup-plugin-visualizer if the BUILD_VISUALIZER env var is set to "true"
  const buildVisualizerPlugin = process.env.BUILD_VISUALIZER === 'true' && visualizer({
    filename: path.resolve(__dirname, 'bundle-analyzer/stats-treemap.html'),
    template: 'treemap', // sunburst|treemap|network
    sourcemap: true,
    gzipSize: true
  })

  let portalApiUrl = process.env.VITE_PORTAL_API_URL
  if (!portalApiUrl.endsWith('/')) {
    portalApiUrl += '/'
  }

  // Sets VITE_INDEX_API_URL which is templated in index.html if PREVIEW_LOCAL=true
  process.env.VITE_INDEX_API_URL = mode === 'development' || process.env.PREVIEW_LOCAL === 'true' ? '/' : portalApiUrl

  // Defaults locale to en
  process.env.VITE_LOCALE = process.env.VITE_LOCALE || 'en'

  const subdomainR = /http:\/\/(.*)localhost/
  if (subdomainR.test(portalApiUrl)) {
    portalApiUrl = 'http://localhost' + portalApiUrl.replace(subdomainR, '')
  }

// const proxy = {
//   '^/api': {
//     target: portalApiUrl,
//     changeOrigin: true,
//     headers: {
//       'Access-Control-Allow-Origin': '*', // Adjust based on your security requirements
//       'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
//       'Access-Control-Allow-Headers': 'Content-Type, Authorization'
//     },
//     onProxyRes: (proxyRes) => {
//       if (proxyRes.headers['set-cookie']) {
//         proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(cookie => {
//           return cookie.replace(/Domain=.*;/, 'Domain=localhost; Secure;')
//         });
//       }
//     }
//   }
// };


  // required to prevent localhost from being rendered as 127.0.0.1
  dns.setDefaultResultOrder('verbatim')

  return {
    logLevel: 'info',
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vue: ['vue', 'vue-router'],
            kongponents: ['@kong/kongponents'],
            kongAuthelements: ['@kong/kong-auth-elements'],
            specRenderer: ['@kong-ui-public/spec-renderer']
          }
        },
        plugins: [
          buildVisualizerPlugin
        ]
      }
    },
    plugins: [
      vue({
        template: {
          transformAssetUrls: {
            includeAbsolute: false
          }
        }
      }),
      vueJsx(),
      svgLoader()
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      },
      preserveSymlinks: true,
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
    },
    preview: {
      proxy
    },
    // server: {
    //   cors: {
    //     origin: '*', 
    //     credentials: true,
    //     methods: ['GET', 'POST', 'OPTIONS'], // Include OPTIONS for preflight requests
    //     allowedHeaders: ['Content-Type', 'Authorization'],
    //     exposedHeaders: ['Content-Length'],
    //     maxAge: 3600,
    //     optionsPassthrough: true,
    //     preflightContinue: true,
    //     // Set custom CORS headers in the response
    //     responseHeaders: {
    //       'Access-Control-Allow-Origin': '*',
    //       'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', // Include OPTIONS for preflight requests
    //       'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    //     }
    //   },
    //   proxy
    // },
    customLogger: createCustomLogger()
  }
})
