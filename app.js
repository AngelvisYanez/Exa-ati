const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

// Forzamos modo producción porque en Plesk a veces NODE_ENV viene como 'development' por defecto
// y arranca múltiples instancias de 'next dev' causando bloqueos.
const dev = false
const hostname = 'localhost'
const port = process.env.PORT || 3000

// When using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port })
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
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
    })
})
