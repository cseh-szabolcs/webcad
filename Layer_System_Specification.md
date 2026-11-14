# Layer-System für WebCAD (AutoCAD-kompatibel)

## Überblick

Implementiere ein Layer-System, das sich so weit wie möglich wie in AutoCAD verhält. Layer steuern Sichtbarkeit, Darstellung und Performance von Objekten. Alle neuen Objekte werden standardmäßig auf dem aktuellen Layer erstellt und erben dessen Eigenschaften (ByLayer).

## Datenmodell

### Layer-Objekt

```typescript
interface Layer {
  id: string;                    // eindeutige ID
  name: string;                  // Layer-Name (unique, case-insensitive empfohlen)
  isOn: boolean;                 // true = Ein, false = Aus
  isFrozen: boolean;             // true = Gefroren
  color: string | number;        // Hex-Farbe oder ACI-Index (z.B. "#FF0000" oder 1)
  linetype: string;              // z.B. "Continuous", "Dashed", "Center", "Hidden"
  transparency: number;          // 0 (opak) bis 90 (max. transparent)
  description: string;           // optionale Beschreibung
  // optional für später:
  // isLocked?: boolean;
  // isPlottable?: boolean;
}
```

### Standardwerte beim Erstellen eines neuen Layers

- `isOn`: `true`
- `isFrozen`: `false`
- `color`: `7` oder `"#FFFFFF"` (weiß/schwarz je nach Hintergrund)
- `linetype`: `"Continuous"`
- `transparency`: `0`
- `description`: `""`

### Standard-Layer

Es muss immer mindestens der Layer `"0"` existieren. Dieser kann nicht gelöscht werden.

### Current Layer

- Es gibt immer genau einen **Current Layer**.
- Neue Objekte werden auf dem Current Layer erstellt.
- Der Current Layer kann nicht **ausgeschaltet** oder **gefroren** werden (oder er wird automatisch wieder eingeschaltet/aufgetaut).
- Visuell markieren (z.B. grünes Häkchen oder fett).

## Eigenschaften im Detail

### 1. Name

- Eindeutig (case-insensitive empfohlen).
- Erlaubt: Buchstaben, Zahlen, Bindestrich, Unterstrich.
- Max. Länge z.B. 255 Zeichen.
- Layer `"0"` darf nicht umbenannt werden.

### 2. Ein / Aus (`isOn`)

**Verhalten:**
- **Aus**: Objekte des Layers werden **nicht dargestellt**.
- Die Objekte bleiben im Speicher und werden bei Regenerierungen (Zoom, Pan, Redraw) weiterhin berücksichtigt.
- Schnelles Ein-/Ausschalten ohne Regenerierungskosten.
- Objekte auf ausgeschalteten Layern sind **nicht direkt anklickbar**, können aber über "Select All" oder andere globale Selektionen erfasst werden (empfohlenes Verhalten).

**Empfehlung:** Für temporäres Ausblenden nutzen.

### 3. Frieren / Auftauen (`isFrozen`)

**Verhalten:**
- **Gefroren**: Objekte werden **nicht dargestellt** und **nicht regeneriert**.
- Verbessert die Performance bei komplexen Zeichnungen deutlich.
- Objekte auf gefrorenen Layern sind **vollständig unsichtbar und nicht selektierbar**.
- Beim Auftauen muss eine Regenerierung stattfinden.

**Unterschied zu Ein/Aus:**

| Eigenschaft              | Aus (Off)              | Gefroren (Frozen)          |
|--------------------------|------------------------|----------------------------|
| Sichtbarkeit             | Unsichtbar             | Unsichtbar                 |
| Regenerierung            | Wird regeneriert       | Wird nicht regeneriert     |
| Performance              | Normal                 | Besser bei großen Drawings |
| Selektion (Select All)   | Möglich                | Nicht möglich              |
| Current Layer möglich?   | Ja (Warnung)           | Nein                       |
| Empfohlener Einsatz      | Temporär               | Langfristig ausblenden     |

**Empfehlung:** Layer, die längere Zeit nicht benötigt werden, frieren.

### 4. Farbe

- Wird allen Objekten zugewiesen, deren Farbe auf **ByLayer** steht.
- Unterstütze:
  - ACI-Farben 1–255 (AutoCAD Color Index)
  - True Color (Hex, RGB)
- Standardfarbe für Layer 0: 7 (Weiß/Schwarz).

### 5. Linientyp (Linetype)

- Wird allen Objekten mit Linetype = **ByLayer** zugewiesen.
- Mindestens unterstützen:
  - `Continuous`
  - `Dashed`
  - `Hidden`
  - `Center`
  - `Dot`
  - `DashDot`
- Linetypes können später aus einer Linetype-Tabelle geladen werden.
- Darstellung über Canvas-Stroke-Dasharray oder entsprechende WebGL-Logik.

### 6. Transparenz

- Wert zwischen **0** und **90**.
- 0 = vollständig opak
- 90 = maximale Transparenz
- Wird auf ByLayer-Objekte angewendet.
- In Canvas: `globalAlpha` oder entsprechendes WebGL-Blending.

### 7. Beschreibung

- Freitextfeld.
- Kein Einfluss auf Darstellung oder Verhalten.
- Nur zur Dokumentation (z.B. "Wände – tragend", "Hilfslinien").

## Objekt-Eigenschaften (ByLayer)

Jedes Zeichnungsobjekt (Linie, Kreis, Polylinie etc.) besitzt:

```typescript
interface Entity {
  // ...
  layerId: string;
  color: string | "ByLayer";
  linetype: string | "ByLayer";
  transparency: number | "ByLayer";
  // lineweight optional
}
```

**Rendering-Logik:**

```
if (entity.color === "ByLayer") {
  use layer.color
} else {
  use entity.color
}
```

Gleiches gilt für Linetype und Transparenz.

## UI – Layer Properties Manager

Erstelle ein Dialog-/Panel mit einer Tabelle:

| Spalte          | Typ          | Beschreibung                          |
|-----------------|--------------|---------------------------------------|
| Current         | Icon         | Aktuellen Layer setzen                |
| Name            | Text         | Bearbeitbar                           |
| Ein/Aus         | Icon (Glühbirne) | Toggle                             |
| Frieren         | Icon (Sonne/Schneeflocke) | Toggle                    |
| Farbe           | Farbfeld     | Color Picker öffnen                   |
| Linientyp       | Dropdown     | Linetype auswählen                    |
| Transparenz     | Zahl / Slider| 0–90                                  |
| Beschreibung    | Text         | Bearbeitbar                           |

**Funktionen:**
- Neuen Layer erstellen
- Layer umbenennen
- Layer löschen (nur wenn keine Objekte darauf liegen und nicht Layer 0)
- Current Layer setzen
- Sortierung nach Name
- Suche / Filter (optional)

## Weitere wichtige Regeln

1. **Layer 0** kann nicht gelöscht oder umbenannt werden.
2. Ein Layer, auf dem Objekte liegen, kann nicht gelöscht werden (oder nur nach Bestätigung + Verschieben der Objekte).
3. Der Current Layer darf nicht gefroren werden.
4. Beim Ausschalten des Current Layers: Warnung anzeigen.
5. Änderungen an Layer-Eigenschaften müssen sofort die Darstellung aktualisieren (für sichtbare Layer).
6. Beim Frieren/Auftauen: Regenerierung der gesamten Zeichnung auslösen.
7. Alle Layer-Operationen müssen undo/redo-fähig sein.

## Empfohlene Implementierungsschritte

1. Datenstruktur `Layer` + Layer-Manager (CRUD)
2. Current Layer Konzept
3. Rendering-Logik (ByLayer + Sichtbarkeit On/Off + Frozen)
4. Layer Properties Manager UI
5. Integration in Objekt-Erstellung (neue Objekte auf Current Layer)
6. Selektion beachten (Off vs Frozen)
7. Undo/Redo
8. Persistenz (Speichern/Laden der Layer-Definitionen)

## Hinweise für die Darstellung

- **Off**: Objekte nicht zeichnen, aber Bounding Box / Extents berücksichtigen.
- **Frozen**: Objekte komplett ignorieren (auch bei Extents, Selektion, Regenerierung).
- Linetype: Über `setLineDash()` in Canvas oder entsprechendes Material in WebGL.
- Transparenz: Alpha-Kanal der Farbe anpassen.

---

**Ziel:** Das Layer-System soll sich für den Benutzer so natürlich wie in AutoCAD anfühlen. Priorisiere korrekte Sichtbarkeits- und Performance-Unterschiede zwischen **Ein/Aus** und **Frieren**.
