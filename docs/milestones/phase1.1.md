Der Editor lädt den Plan jetzt über GET /api/plans/{id}/document. Im Backend liest der Handler vorerst die JSON-Fixture. PHPUnit (8 Tests), Vitest (34), Build, Lint und php-cs-fixer laufen sauber. Im Browser rendert der Plan wie vorher, und ?plan=<unbekannte UUID> zeigt eine 404-Meldung.

Backend
- GetPlanDocumentQuery, PlanDocumentDTO und GetPlanDocumentHandler folgen dem Muster von GetProjectQuery.
- Der Handler liest fixtures/plans/{uuid}.json. Fehlt die Datei, gibt er null zurück, und der Controller antwortet mit 404. Später wird nur dieser Handler durch eine DBAL-Abfrage auf PlanVersion ersetzt.
- Das DTO hält das Dokument als JSON-String. Ein PHP-Array würde {} und [] vermischen.
- Api\PlanDocumentController antwortet mit dem Dokument-JSON und ETag: "1". Bei passendem If-None-Match kommt 304. Ist die id keine UUID, greift die Route gar nicht.
- PlanDocumentControllerTest deckt 200 mit ETag und Body, 404 für unbekannte und für Nicht-UUID-ids sowie 304 ab.

Frontend
- vite.config.ts: Ein Proxy leitet /api an http://nginx weiter, also same-origin ohne CORS. Für npm run dev auf dem Host setzt man API_PROXY_TARGET=http://localhost:8080.
- CadApiClient.loadPlanDocument() schickt die Antwort durch parseDocument und liest die Revision aus dem ETag. Fehler kommen als CadApiError mit HTTP-Status. Getestet ist der Client mit einem nachgebauten fetch.
- App.tsx nimmt die Plan-id aus ?plan=. Im Dev-Modus ist ohne Parameter die Fixture-UUID voreingestellt. Es gibt Zustände für Laden und Fehler.

Fixture doppelt: Die Frontend-Fixture hat jetzt dieselbe UUID als id und ist byte-identisch mit der Backend-Kopie. Sie wird aber nur noch von den Unit-Tests benutzt. Dass beide gleich bleiben müssen, steht in CLAUDE.md, automatisch geprüft wird es nicht.