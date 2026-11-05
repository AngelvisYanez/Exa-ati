const path = require('path')
const fs = require('fs')

process.env.NODE_ENV = 'production'
process.env.PORT = process.env.PORT || 3000
process.env.HOSTNAME = process.env.HOSTNAME || 'localhost'

const serverFile = path.join(__dirname, 'server.js')
const standaloneServer = path.join(__dirname, '.next', 'standalone', 'server.js')

if (fs.existsSync(serverFile)) {
  console.log('> Starting Next.js Standalone via root server.js')
  require(serverFile)
} else if (fs.existsSync(standaloneServer)) {
  console.log('> Starting Next.js Standalone via .next/standalone/server.js')
  process.chdir(path.join(__dirname, '.next', 'standalone'))
  module.paths.unshift(path.join(__dirname, '.next', 'standalone', 'node_modules'))
  require(standaloneServer)
} else {
  console.log('> Starting Next.js Custom Server')
  const { createServer } = require('http')
  const { parse } = require('url')
  const next = require('next')

  const app = next({ dev: false, hostname: process.env.HOSTNAME, port: process.env.PORT })
  const handle = app.getRequestHandler()

  app.prepare().then(() => {
    createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true)
        await handle(req, res, parsedUrl)
      } catch (err) {
        console.error('Error occurred handling', req.url, err)
        res.statusCode = 500
        res.end('internal server error')
      }
    })
      .once('error', (err) => {
        console.error(err)
        process.exit(1)
      })
      .listen(process.env.PORT, () => {
        console.log(`> Ready on http://${process.env.HOSTNAME}:${process.env.PORT}`)
      })
  }).catch((err) => {
    console.error('Error in app.prepare:', err)
    process.exit(1)
  })
}
