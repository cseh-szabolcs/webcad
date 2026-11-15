Collaboration: server, room and login
=====================================

Several people can have the same project open. The collaboration server (`depts/collaboration/`,
Socket.IO on Node, compose service `collaboration`) is the meeting point; later the editor's commands
travel over it from one tab to the others. **It knows who is there** (login, `app:joined`,
`app:left`, a room limit, a colour per collaborator) **and passes on the pointers, the selections and
the changes of the document**; nothing is stored or applied there. It has no database and no session,
and of what a client sends it only checks the outline (types, sizes), never the meaning.

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
ask the lock yet.

Changes
-------

What one editor does to the document, the others get. **Not the command travels but its effect**, a
`DocumentPatch` (`depts/editor/src/cad/editor/commands/DocumentPatch.ts`): the vertices, elements
and groups that are new or changed, as they are afterwards, the ids of those removed, and the
elements to draw anew. A command object holds functions and what it found on its first run, and
replaying it would need the same document on both sides to the last digit; a patch only needs the
things it names. It also makes an undo, a redo and LINIE's "Zurück" travel like anything else: each
is just another change of the document.

| Event | Direction | Carries |
|---|---|---|
| `app:change` | client → server | `patch` |
| `app:change` | server → room (not the sender) | `userId, patch` |

The rules this follows:

- **The server says who it was.** The author is the collaborator id the server knows for the socket;
  anything a client writes about the author is not looked at. In the editor it arrives as the
  `origin` of the `HistoryChange` (`null`: done here), which is how every listener tells an own
  action from somebody else's.
- **A received change is no step here.** `DocumentHistory.applyRemote` replaces the document and
  tells the listeners, and touches neither the undo nor the redo stack: undo only ever takes back
  what was done here. Only changes with `origin` null are sent, so nothing echoes.
- **One place sends, one applies.** `CadCanvas` subscribes to the history (`diffDocuments` of the
  document before and after) and hands incoming patches to it (`applyDocumentPatch`); no command and
  no tool knows about the collaboration.
- **Ids come from the author.** New vertices and elements carry the ids the author's command made,
  so both sides name the same thing; nothing is renumbered.
- **Checked before applied.** A patch for another plan (the room is the project, `planId` says which
  plan) is passed over. One after which an element would use a vertex or a group that is not there is
  left out as a whole with a warning in the console: the documents have drifted apart, and a document
  the renderer cannot draw would be worse. The shape of the things in a patch is trusted: they come
  from the same editor code, behind the login.
- **Reliable and in order.** Unlike the pointers: Socket.IO delivers the changes of one connection in
  the order sent, and the server passes them on as they come.
- **Bounded.** A patch may name `CHANGE_LIMIT` things (the same number on both sides); the editor does
  not send a larger one and warns, the server would ignore it. The server takes messages up to
  `MAX_MESSAGE_BYTES`.
- **The order of elements and of layers** is kept: a new one says which one it follows (`after`).
  Layers are in a patch (`layers`, `removedLayerIds`); one after which an element would be on a
  layer that is not there, or a layer on a floor that is not there, is left out like the others.
  Floors and styles are not in a patch, as no command changes them yet. The current layer is
  editor state per user and never sent.

**What this does not solve yet** (the editors can drift apart, and nothing repairs it):

- *Joining late or reconnecting.* Changes are not saved to the backend and the server keeps none, so
  somebody who opens the plan later, or was offline for a moment, loads the stored plan without what
  the others did meanwhile. Later patches that build on that are left out there (see above). This
  ends with saving: a joiner then loads the current draft, and a revision number per plan lets a
  client see that it missed something and load anew.
- *Undo across people.* A local undo restores what the command remembered; if somebody else changed
  the same things since, their change is lost on both sides (`SubtractCommand` puts whole lists back).
  The selection lock keeps this rare while both are there, but an undo reaches back further.
- *A command in progress.* A tool keeps the document it started with for what it has selected; the
  lock keeps the others off those elements, but a neighbour that shared a vertex may have left it.

Still to come
-------------

Saving and with it the repair of drift (revision per plan, loading anew); undo across people;
announcing a publish or discard; a push from the backend.
