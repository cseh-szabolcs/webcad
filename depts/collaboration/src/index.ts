import SocketServer from './SocketServer.ts'
import config from './config.ts'

const server = new SocketServer({
  port: config.port,
  // The editor reaches the server through its own dev proxy (same origin); set the variable when
  // a browser connects from another origin.
  allowedOrigin: process.env['COLLAB_ALLOWED_ORIGIN'],
  maxClientsPerRoom: config.maxClientsPerRoom,
  secret: process.env['COLLAB_AUTH_TOKEN'],
  log: config.isDevMode,
})

server.listen()

console.log(`[collaboration] listening on ${config.port}`)
