The Phase 1 viewer is working. The sample room shows at http://localhost:8081 and renders upright, with model Y pointing up. Wheel zoom, drag-to-pan and the Fit button all work in the browser. The browser console showed no errors or warnings, the 29 unit tests pass, and build and lint are clean.

What's new in depts/editor/src/:
- cad/model/: the document types from setup.md, plus DocumentIndex for looking things up by id. The index is computed, never saved.
- cad/persistence/CadSerializer.ts: parseDocument checks a loaded plan and rejects anything broken (wrong schema version, unknown element type, references to missing vertices, layers, groups or styles, duplicate ids, invalid numbers). The error says where the problem is, e.g. $.elements[2]: unknown vertex "nope". It drops properties it doesn't know.
- cad/renderer/:
  - Viewport: converts between model coordinates (mm, Y up) and screen pixels; also handles zoom-at-cursor and fit.
  - PaperRenderer: keeps one Paper.js item per element and one Paper layer per CAD layer, and can update single elements.
  - ElementRenderer: draws each element type and applies its style.
  - PanZoomController: mouse wheel and drag handling.
- ui/CadCanvas.tsx and App.tsx: a full-screen canvas with a toolbar showing a Fit button and the on-screen scale as 1:N (assuming 96 dpi).
- sample/sample-plan.json: walls, a door whose leaf and swing share a vertex and form a group, a window, furniture with fill, a dashed style, and one element with no layer or style.

Where it differs from the plan:
- Extra file: I split the geometry into its own PathSpec.ts, which doesn't depend on Paper.js, so circle and Bézier shapes can be unit-tested without a canvas.
- No removeElements(): updateElements(doc, ids) removes an element when it's no longer in the document, so one method covers both.
- Config changes: tsconfig.app.json now has resolveJsonModule and a paths entry for the app/* alias. The alias only existed in Vite, so TypeScript couldn't resolve it.
- Template cleanup: I also deleted public/icons.svg and set the page title to "WebCAD Editor".
- CLAUDE.md: updated with the editor's current state, npm test, and the "mm, Y up" rule.

Bug fixed during the browser check: Paper.js re-centres the view whenever the canvas is resized, which pushed the fitted drawing off-centre. PaperRenderer.resize() now re-applies the current viewport after resizing.

Worth knowing:
- The bundle is 472 kB because paper loads the full build. Importing only the core build would make it smaller.
- Vitest is installed on the host only. The dev server in the editor container doesn't need it.
- Line widths are in screen pixels for now, so they don't grow when you zoom in. Model versus print units is still an open decision.
- Nothing is committed yet.
