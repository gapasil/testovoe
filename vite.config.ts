import react from '@vitejs/plugin-react'
import https from 'node:https'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'

function greenApiProxy(): Plugin {
  return {
    name: 'green-api-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/__green__/')) return next()

        const raw = req.url.slice('/__green__/'.length)
        const slash = raw.indexOf('/')
        if (slash <= 0) {
          res.statusCode = 400
          res.end('Bad proxy path')
          return
        }

        const host = decodeURIComponent(raw.slice(0, slash))
        const pathAndQuery = raw.slice(slash)
        const lib = https

        const chunks: Buffer[] = []
        req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        req.on('end', () => {
          const body = chunks.length ? Buffer.concat(chunks) : undefined

          const upstream = lib.request(
            {
              hostname: host,
              path: pathAndQuery,
              method: req.method,
              headers: {
                Accept: 'application/json',
                Host: host,
                ...(body
                  ? {
                      'Content-Type':
                        req.headers['content-type'] || 'application/json',
                      'Content-Length': String(body.length),
                    }
                  : {}),
              },
              timeout: 70_000,
            },
            (upRes) => {
              const parts: Buffer[] = []
              upRes.on('data', (c) => parts.push(Buffer.from(c)))
              upRes.on('end', () => {
                const buf = Buffer.concat(parts)
                res.statusCode = upRes.statusCode || 502
                const ct = upRes.headers['content-type']
                if (ct) res.setHeader('Content-Type', ct)
                res.setHeader('Cache-Control', 'no-store')
                res.end(buf)
              })
            },
          )

          upstream.on('timeout', () => {
            upstream.destroy()
            if (!res.headersSent) {
              res.statusCode = 504
              res.end('Upstream timeout')
            }
          })

          upstream.on('error', (err) => {
            if (!res.headersSent) {
              res.statusCode = 502
              res.end(err.message)
            }
          })

          if (body) upstream.write(body)
          upstream.end()
        })

        req.on('error', (err) => {
          if (!res.headersSent) {
            res.statusCode = 500
            res.end(err.message)
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), greenApiProxy()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
