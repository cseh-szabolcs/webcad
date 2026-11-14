# Collaboration

Socket.IO server of the CAD editor: one **namespace per tenant** (its uuid), one **room per project**
(its id). So far it only tells who is in a room; it relays, stores and applies nothing.
The whole picture, the login and the token are in
[`docs/architecture/collaboration.md`](../../docs/architecture/collaboration.md).

Development runs the TypeScript sources directly (`node --watch src/index.ts`, Node strips the
types), which is why **an import names the `.ts` file it really means**; `tsc` rewrites them to `.js`
when it emits. The compose service `collaboration` runs `npm run start:dev-docker`.

```sh
npm install        # on the host, inside depts/collaboration/
npm run typecheck
npm test           # node --test, real sockets over socket.io-client
```

| Variable | Meaning |
|---|---|
| `COLLAB_AUTH_TOKEN` | secret shared with the backend, which signs the tokens (required) |
| `COLLAB_MAX_CLIENTS_PER_ROOM` | sockets one room admits, default 5 |
| `COLLAB_ALLOWED_ORIGIN` | only for a browser on another origin; the dev proxy needs none |
| `PORT` | default 8081 |

| Event | Direction | Carries |
|---|---|---|
| `app:join` | client → server, with ack | nothing → `{ clients, user, users }` |
| `app:joined` / `app:left` | server → room | who arrived or went, and how many are there |

Files: `SocketServer.ts` (namespaces, room limit, join/leave), `isGranted.ts` (the handshake check),
`token.ts` (signature and expiry), `types.ts` (the message shapes), `config.ts`, `index.ts`.
