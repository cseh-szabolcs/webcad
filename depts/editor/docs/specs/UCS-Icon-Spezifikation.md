# UCS Icon – Spezifikation (AutoCAD-Style)

## Überblick

Das **UCS-Icon** (User Coordinate System Icon) visualisiert die Ausrichtung und den Ursprung des aktuellen Benutzerkoordinatensystems.

Es ist **nicht rein dekorativ**. Das zugrunde liegende Koordinatensystem steuert:

- Richtung der X- und Y-Achse (und damit was „horizontal“ / „vertikal“ ist)
- Ursprung (0,0)
- Ausrichtung von Ortho-Modus, Polar-Tracking und Objektfang-Tracking
- Raster-Ausrichtung und -Winkel
- Ausrichtung von Text, Bemaßungen und Schraffuren
- Arbeitsebene (XY-Ebene) bei 2D/3D-Operationen

Das Icon selbst dient primär der Visualisierung und kann (optional) interaktiv sein.

---

## Visuelle Darstellung (2D-Stil – wie im Screenshot)

### Grundaufbau

```
        Y
        |
        |
   [■]──┴────── X
```

- **X-Achse**: horizontal nach rechts (positive X-Richtung)
- **Y-Achse**: vertikal nach oben (positive Y-Richtung)
- **Ursprung**: Kreuzungspunkt der beiden Achsen
- **Quadrat am Ursprung**: zeigt an, dass das aktuelle UCS mit dem **World Coordinate System (WCS)** übereinstimmt

### Farb- und Stilvorgaben (Referenz)

| Element          | Beschreibung                          |
|------------------|---------------------------------------|
| Linien           | Dünn, hell (z. B. weiß oder hellgrau) |
| Hintergrund      | Dunkel (wie im Screenshot)            |
| Quadrat          | Kleines, gefülltes oder umrandetes Quadrat am Ursprung |
| Achsenlabels     | „X“ und „Y“ an den jeweiligen Achsenenden |
| Linienstärke     | Konsistent, dünn                      |

### Wichtige visuelle Zustände

| Zustand                          | Visuelles Merkmal                          | Bedeutung                                      |
|----------------------------------|--------------------------------------------|------------------------------------------------|
| **WCS aktiv**                    | Quadrat am Ursprung vorhanden              | UCS = World Coordinate System                  |
| **Custom UCS aktiv**             | Kein Quadrat                               | UCS wurde verschoben oder gedreht              |
| **Icon am Ursprung**             | Icon sitzt auf (0,0)                       | Ursprung ist sichtbar                          |
| **Icon in Ecke**                 | Icon unten links im Viewport               | Ursprung ist außerhalb des sichtbaren Bereichs |
| **Blick von oben**               | Quadrat sichtbar (bei WCS)                 | Positive Z-Richtung zeigt zum Betrachter       |
| **Blick von unten**              | Quadrat fehlt                              | Negative Z-Richtung zeigt zum Betrachter       |
| **Blick parallel zur XY-Ebene**  | „Broken Pencil“ Icon                       | Zeichnen mit Maus ist visuell mehrdeutig       |

---

## Positionierung

- **Standard (Origin-Modus)**: Icon wird am Ursprung (0,0) des aktuellen UCS angezeigt, sofern dieser im Viewport sichtbar und nicht zu nah am Rand ist.
- **Fallback**: Wenn der Ursprung außerhalb des Viewports liegt → Icon wird unten links im Viewport angezeigt.
- **NoOrigin-Modus**: Icon bleibt immer unten links (unabhängig vom Ursprung).

---

## Interaktivität (optional, aber empfohlen)

Das Icon kann selektierbar sein und Griffe anbieten:

| Griff / Aktion       | Funktion                                      |
|----------------------|-----------------------------------------------|
| Icon anklicken       | UCS selektieren                               |
| Move-Griff           | Ursprung verschieben                          |
| Rotate-Griff (X/Y)   | Achsen drehen                                 |
| Rechtsklick          | Kontextmenü (World, Origin, Properties etc.)  |

Systemvariable-Äquivalent: `UCSSELECTMODE` steuert, ob das Icon selektierbar ist.

---

## Funktionale Auswirkungen des UCS

Wenn das UCS geändert wird (z. B. durch Interaktion mit dem Icon), wirken sich folgende Dinge aus:

1. **Koordinaten-Eingabe**
   - Absolute Koordinaten beziehen sich auf den neuen Ursprung
   - Relative Koordinaten und Winkel beziehen sich auf die neue Achsenausrichtung

2. **Zeichenhilfen**
   - Ortho-Modus sperrt auf die aktuellen X/Y-Achsen
   - Polar-Tracking und Object Snap Tracking orientieren sich am UCS
   - Winkel 0° liegt immer auf der positiven X-Achse des UCS

3. **Darstellung**
   - Raster richtet sich am UCS aus
   - Text, Bemaßungen und Schraffuren können sich am UCS orientieren

4. **3D (falls relevant)**
   - XY-Ebene definiert die aktuelle Arbeitsebene
   - Z-Achse zeigt die positive Tiefenrichtung

---

## 3D-Variante (optional)

Falls das Projekt auch 3D unterstützt:

- Drei Achsen: **X (rot)**, **Y (grün)**, **Z (blau)**
- RGB = XYZ als Farbkodierung
- Quadrat nur sichtbar, wenn UCS = WCS **und** von oben betrachtet wird
- Z-Achse durchgezogen (von oben) bzw. gestrichelt (von unten)

---

## Implementierungsempfehlungen

### Minimal (nur Darstellung)
- Icon zeichnen mit X/Y-Achsen + Quadrat bei WCS
- Position: unten links oder am Ursprung
- Keine Interaktion

### Empfohlen
- Icon zeichnen wie oben
- Quadrat ein-/ausblenden je nach WCS/Custom-UCS
- Position dynamisch (Origin vs. Corner)
- Optional: Selektierbar machen und Griffe für Move/Rotate anbieten

### Datenmodell (Vorschlag)

```ts
interface UCSState {
  origin: { x: number; y: number };     // aktueller Ursprung
  rotation: number;                      // Drehung der X-Achse in Grad
  isWCS: boolean;                        // true = Quadrat anzeigen
  showAtOrigin: boolean;                 // true = am Ursprung, false = Ecke
  selectable: boolean;
}
```

---

## Referenz-Verhalten (AutoCAD)

| Feature                    | Verhalten                                      |
|----------------------------|------------------------------------------------|
| Quadrat                    | Nur bei WCS sichtbar                           |
| „W“-Buchstabe              | Ältere 2D-Icons zeigen „W“ bei WCS             |
| Broken Pencil              | Bei Blick parallel zur XY-Ebene                |
| Icon-Größe                 | Skaliert mit Viewport (ca. 5–10 % der Höhe)    |
| Farbe                      | Anpassbar (Standard: hell auf dunkel)          |

---

## Quellen / Referenz

- AutoCAD UCSICON Command
- AutoCAD Help: „The UCS Icon“
- CADTutor: UCS Icon Tutorial
- Das Quadrat am Ursprung ist der zuverlässigste visuelle Indikator für WCS vs. Custom UCS

---

*Spezifikation erstellt für die Implementierung eines AutoCAD-ähnlichen UCS-Icons.*
