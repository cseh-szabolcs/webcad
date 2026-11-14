Collaboration: server, room and login
=====================================

Several people can have the same project open. The collaboration server (`depts/collaboration/`,
Socket.IO on Node, compose service `collaboration`) is the meeting point; later the editor's commands
travel over it from one tab to the others. **So far it only knows who is there** (login, `app:joined`,
`app:left`, a room limit); nothing is relayed, stored or applied. It has no database and no session,
and it never looks inside what a client sends. The design follows the reference project
(`depts/collaboration-example/`, git-ignored, read only).

| Part | Is |
|---|---|
| namespace | the uuid of the tenant (`app_main.tenant.uuid`), `/<uuid>`; the server accepts any uuid-shaped namespace, the token decides |
| room | the id of the project (`Project.id`, a uuid): everybody with a plan of the project open meets, whichever plan |
| collaborator | one socket (a second tab is a second collaborator); its id (`nanoid(8)`) is minted by the server |

Login
-----

1. The editor has loaded a plan and asks `GET /api/plans/{id}/collaboration`
   (`GetPlanCollaborationController` → `GetPlanCollaborationQuery`, answered with
   `CollaborationAccessDto`: `namespace`, `room`, `userName`, `token`). The tenant cookie is httpOnly, so the
   editor learns tenant and project only here.
2. The token is signed by the backend (`App\Core\Collaboration\CollaborationTokenIssuer`):
   `base64url(json{ns, room, sub, name, exp}).base64url(hmac-sha256)` with the secret
   `COLLAB_AUTH_TOKEN` (`.env.dev`/`.env.test`; the compose service of the server has the same value).
   It lives 60 seconds, as it is only needed for the handshake, so a reconnect asks again.
3. The editor connects to `/<namespace>` with `auth: { token }`. `isGranted` (the one place to change
   the authentication) checks signature and expiry **and** that the token's `ns` is the namespace
   it connected to, so a token of one tenant is worth nothing in another. Room, user name and
   user id come from the token, never from the client.
4. The client emits `app:join` with an acknowledgement and gets `{ clients, user, users }`; the others
   in the room get `app:joined`. `app:left` is sent when a socket goes (`disconnecting`).
5. A room admits `COLLAB_MAX_CLIENTS_PER_ROOM` sockets (5). The next is refused in the handshake with a
   `connect_error` whose `data` is `{ code: 'room-full', limit, users }`; it does not retry on its own.

`src/types.ts` (server) and `depts/editor/src/collaboration/types.ts` declare the shapes by hand: no
codegen, no shared package.

How the browser reaches it
--------------------------

The server is only exposed inside the compose network (`collaboration:8081`). The browser always
connects **same-origin**, to `/socket.io` of the page it is on, so there is no CORS and no second
host, port or certificate (`COLLAB_ALLOWED_ORIGIN` is only for a browser on another origin):

- the editor's Vite dev server (`:8081`) proxies `/socket.io` (`ws: true`, `COLLAB_PROXY_TARGET` on the
  host);
- nginx (`:8080`, `docker/map/nginx.default.conf`) does the same for the pages of the app, i.e.
  for the built editor once it is embedded in Twig: `location /socket.io/` with the WebSocket
  upgrade headers, a long `proxy_read_timeout` (Socket.IO pings every 25 s) and the upstream as a
  variable, so nginx also starts while the collaboration container is down.

nginx only passes the bytes of the connection through; the work per message (parsing, finding the room,
sending it on) is done by the Node server, which is where load would show up first. If it ever does,
the editor needs no change: put a web server of its own in front of `/socket.io`, or let the backend
send the server's URL in `CollaborationAccessDto`.

Still to come
-------------

Relaying the editor's commands (`app:interaction`) with the rule that a received command changes
only the receiving store (no undo entry, no save); presence in the drawing; announcing a
publish or discard; a push from the backend. For the cursor: throttle it (one position per frame),
send it only while somebody else is in the room and as `volatile` in a message of its own, never in
the packet of a command (a `volatile` packet queued behind a reliable one is dropped).
