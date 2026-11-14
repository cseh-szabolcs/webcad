/**
 * Everything the server reads from its environment, read once at boot. `compose.yml` sets these
 * for development; a deployment sets its own.
 */

// A missing or unusable COLLAB_MAX_CLIENTS_PER_ROOM falls back to this rather than stopping the
// boot, and never to "unlimited", which is what a NaN would quietly mean.
const DEFAULT_MAX_CLIENTS_PER_ROOM = 5
const configuredMaxClients = Number(process.env['COLLAB_MAX_CLIENTS_PER_ROOM'])

export default {
  /** Where Socket.IO listens, inside the container. */
  port: Number(process.env['PORT'] ?? 8081),
  /** How many sockets one room admits; the next one is refused in the handshake. */
  maxClientsPerRoom:
    Number.isInteger(configuredMaxClients) && configuredMaxClients > 0
      ? configuredMaxClients
      : DEFAULT_MAX_CLIENTS_PER_ROOM,
  /** Logs every connection and join — too chatty for production. */
  isDevMode: process.env['NODE_ENV'] === 'development',
}
