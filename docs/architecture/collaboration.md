Collaboration: server, room and login
=====================================

Several people can have the same project open. The collaboration server (`depts/collaboration/`,
Socket.IO on Node, compose service `collaboration`) is the meeting point; later the editor's commands
travel over it from one tab to the others. **So far it knows who is there** (login, `app:joined`,
`app:left`, a room limit, a colour per collaborator) **and passes the pointers and the selections on**; no command is relayed,
and nothing is stored or applied. It has no database and no session,
and it never looks inside what a client sends.

| Part | Is |
|---|---|
| namespace | the uuid of the tenant (`app_main.tenant.uuid`), `/<uuid>`; the server accepts any uuid-shaped namespace, the token decides |
| room | the id of the project (`Project.id`, a uuid): everybody with a plan of the project open meets, whichever plan |
| collaborator | one socket (a second tab is a second collaborator); its id (`nanoid(8)`) is minted by the server |
| colour | `Collaborator.color`, an index 0–4 (`COLLABORATOR_COLORS`): the server gives the lowest one nobody in the room has, so five people always differ; a room above five repeats them. The editor maps the index to `--collab-color-*` (`index.css`, one set per theme) |

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

Pointers
--------

Each editor tells the others where its crosshair is, and draws theirs (`ui/RemoteCursors.ts`: a small
dashed cross in the collaborator's colour, their name up and to the right, faint, under the own
crosshair, never taking input).

| Event | Direction | Carries |
|---|---|---|
| `app:cursor` | client → server | `x, y` in **model coordinates** (mm), rounded to a thousandth: two numbers, not an object, and independent of anyone's zoom or pan |
| `app:cursor` | server → room (not the sender) | `userId, x, y`; the server puts in the id it knows, ignores anything that is not two finite numbers, stores nothing |
| `app:cursor-gone` | client → server → room | nothing → `userId`: the crosshair left the drawing (also while panning) |

What keeps the traffic small (`createCollaboration`, `CURSOR_INTERVAL_MS`):

- **Throttled:** at most one position per interval; the first goes at once, the latest one is sent when
  the interval is over, so the final position always arrives.
- **Only when somebody listens:** nothing is sent while alone in the room. When somebody joins, the
  current position goes out again, so the newcomer sees it without waiting for a move.
- **Volatile:** `app:cursor` goes `socket.volatile.emit` (and the server relays it `volatile` as well), so
  a position that cannot be delivered right away is dropped instead of queued; the next replaces it.
  `app:cursor-gone` is reliable: a lost one would leave a pointer standing where nobody is.
- **Never with a command:** a `volatile` message queued behind a reliable one is dropped, so commands
  (later) travel as messages of their own.

The pointers are not in `CollaborationState` but in a channel of their own (`CursorChannel`:
`sendCursor`, `getCursors`, `subscribeCursors`): they change up to 20 times a second per person and
must not render the editor's React tree. `CadCanvas` shows and sends them directly.

Selections
----------

What somebody has selected or is editing is locked for the others. Each editor tells the room the
elements it shows as selected (`SelectionSnapshot.highlighted`: the pickfirst selection, a command's
selection, what a tool works on), and treats what the others told it as taken.

| Event | Direction | Carries |
|---|---|---|
| `app:selection` | client → server | `ids`: the ids of **all** elements selected now (none: `[]`), not a difference |
| `app:selection` | server → room (not the sender) | `userId, ids`; the server ignores what is not a list of at most `SELECTION_LIMIT` strings of at most `SELECTION_ID_LENGTH` characters, and stores nothing |

- **Reliable, not throttled:** a selection changes with a click. It is only sent when it differs from
  what the room last got, and only while somebody else is there.
- **The server keeps none:** when somebody joins, everybody sends theirs again (as with the pointer);
  a selection goes with its collaborator on `app:left`, and all of them on a disconnect.
- **Two at once:** nothing orders two picks of the same element, so the editors agree by a rule: it
  stays with the smaller collaborator id. `createCollaboration` leaves it out of the other's selection
  for the one who keeps it; the other finds it locked, drops it and says so with its next
  `app:selection`.
- **Above the limit** (`SELECTION_LIMIT`, the same number on both sides, well under Socket.IO's
  message size) only the first ids are sent: the rest is not locked for the others.
- **No pointer meanwhile:** while an editor has elements selected it sends `app:cursor-gone` instead
  of positions; the name on the elements says where that person works.

In the editor (`SelectionChannel` of the `Collaboration`: `sendSelection`, `getSelections`,
`subscribeSelections`; like the pointers not in `CollaborationState`): `CadCanvas` hands the ids to
`SelectionEditor.setSelectedByOthers` (not picked by click or area, out of the own selection, the
snapshot's `blocked` while the cursor is on one) and to `PaperRenderer.setSelectedByOthers` (drawn
faintly), and `ui/RemoteSelections.ts` puts the collaborator's name over each element. **It is editor
state by element id, not a field of the element:** the element types are the API schema, and the
document, its history and what is saved later must not know who looks at it. Undo and redo do not
ask the lock yet; that comes with relaying the commands.

Still to come
-------------

Relaying the editor's commands (`app:interaction`) with the rule that a received command changes
only the receiving store (no undo entry, no save); presence in the drawing; announcing a
publish or discard; a push from the backend.
