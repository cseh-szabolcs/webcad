# AutoCAD Raster (Grid) – Funktionen und Einstellungen

## Übersicht

Das **Raster** (engl. *Grid*) in AutoCAD ist ein rechteckiges Muster aus Linien oder Punkten im Zeichenbereich. Es dient hauptsächlich der visuellen Orientierung und kann in Kombination mit dem **Rasterfang** (Grid Snap) die Cursorbewegung präzise einschränken.

- Das Raster wird **nicht** geplottet.
- Es liegt immer auf der XY-Ebene des aktuellen Benutzerkoordinatensystems (BKS).
- Vergleichbar mit Millimeterpapier unter der Zeichnung.

## Hauptfunktionen

### 1. Visuelle Orientierung
- Hilft beim Abschätzen von Abständen und Proportionen.
- Erleichtert das Ausrichten von Objekten.
- Macht die räumliche Lage im Zeichenbereich besser erkennbar.
- Besonders nützlich bei freihändigem Skizzieren oder grobem Layout.

### 2. Rasterfang (Grid Snap)
- Beschränkt die Bewegung des Fadenkreuzes auf definierte Intervalle.
- Der Cursor „rastet“ an Rasterpunkten oder am eingestellten Fangabstand ein.
- Erhöht die Präzision und Geschwindigkeit beim Setzen von Punkten.
- Unabhängig vom reinen Raster ein- und ausschaltbar.

### 3. Weitere unterstützende Funktionen
- Kann mit dem BKS-Winkel gedreht werden (für schräge Ausrichtungen).
- Unterstützt isometrische Darstellungen (isometrischer Fangstil).
- Anzeigegrenzen können über die Zeichnungslimiten gesteuert werden.
- Adaptive Darstellung: Bei starkem Herauszoomen werden Hauptlinien hervorgehoben, bei Hineinzoomen werden zusätzliche Linien eingeblendet.

## Ein- und Ausschalten

| Aktion              | Methode                                      | Tastenkürzel / Variable      |
|---------------------|----------------------------------------------|------------------------------|
| Raster ein/aus      | Statusleiste → Raster-Symbol                | `F7` / `GRIDMODE`            |
| Fang ein/aus        | Statusleiste → Fang-Symbol                  | `F9` / `SNAPMODE`            |
| Dialog öffnen       | Rechtsklick auf Raster- oder Fang-Symbol → Einstellungen | `DSETTINGS` oder `OSNAP` |

## Wichtige Einstellungen

Die Einstellungen befinden sich im Dialog **Entwurfseinstellungen** (Registerkarte **Fang und Raster**).

### Raster-Einstellungen

| Einstellung              | Beschreibung                                      | Systemvariable   | Typische Werte          |
|--------------------------|---------------------------------------------------|------------------|-------------------------|
| Raster ein              | Aktiviert/deaktiviert die Anzeige                | `GRIDMODE`       | 0 / 1                   |
| Rasterabstand X         | Abstand der Rasterlinien in X-Richtung            | `GRIDUNIT` (X)   | 10 (metrisch) / 0.5 (imperial) |
| Rasterabstand Y         | Abstand der Rasterlinien in Y-Richtung            | `GRIDUNIT` (Y)   | wie X oder separat      |
| Hauptlinien alle        | Alle wievielten Linien werden hervorgehoben       | `GRIDMAJOR`      | 5 (Standard)            |
| Rasterstil              | Linien oder Punkte                                | `GRIDSTYLE`      | 0 = Linien, 1 = Punkte  |
| Rasterverhalten         | Adaptive Rasterung, Anzeige außerhalb Limiten etc.| `GRIDDISPLAY`    | verschiedene Bitwerte   |

**Hinweise zum Rasterabstand:**
- Bei `GRIDUNIT` = 0 übernimmt das Raster den Fangabstand.
- Bei starkem Herauszoomen wird das Raster automatisch gröber dargestellt, damit es nicht zu dicht wird.

### Fang-Einstellungen (Rasterfang)

| Einstellung              | Beschreibung                                      | Systemvariable   | Hinweise                      |
|--------------------------|---------------------------------------------------|------------------|-------------------------------|
| Fang ein                | Aktiviert den Rasterfang                          | `SNAPMODE`       | 0 / 1                         |
| Fangabstand X           | Abstand der Fangpunkte in X                       | `SNAPUNIT` (X)   | oft gleich oder feiner als Raster |
| Fangabstand Y           | Abstand der Fangpunkte in Y                       | `SNAPUNIT` (Y)   | separat einstellbar           |
| Fangtyp                 | Rasterfang oder Polarfang                         | `SNAPTYPE`       | 0 = Raster, 1 = Polar         |
| Fangstil                | Rechteckig oder Isometrisch                       | `SNAPSTYL`       | 0 = Standard, 1 = Isometrisch |
| Polarer Abstand         | Abstand bei Polarfang                             | `POLARDIST`      | nur bei Polarfang relevant    |

**Wichtige Hinweise:**
- Rasterabstand und Fangabstand müssen **nicht** übereinstimmen.
- Typisches Szenario: gröberes Raster zur Orientierung + feinerer Fang für Präzision.
- Bei aktiviertem Fang rastet der Cursor nur ein, wenn ein Zeichenbefehl aktiv ist (moderne Einstellung) oder permanent (Legacy-Verhalten).

### Weitere relevante Einstellungen

| Einstellung              | Beschreibung                                      | Befehl / Variable     |
|--------------------------|---------------------------------------------------|-----------------------|
| Limiten                  | Begrenzt den Bereich, in dem das Raster angezeigt wird | `LIMITS`             |
| Rasteranzeige-Bereich    | Steuert, ob Raster nur innerhalb der Limiten oder überall angezeigt wird | `GRIDDISPLAY`     |
| BKS-Winkel               | Dreht Raster und Fang mit dem Benutzerkoordinatensystem | `UCS`                |
| Farbe der Rasterlinien   | Anpassbar in den Optionen → Anzeige → Farben      | `OPTIONS`             |

## Befehle (Kurzreferenz)

| Befehl       | Beschreibung                                      |
|--------------|---------------------------------------------------|
| `GRID`       | Raster ein-/ausschalten und Abstand einstellen    |
| `SNAP`       | Fang ein-/ausschalten und Abstand einstellen      |
| `DSETTINGS`  | Öffnet die Entwurfseinstellungen                  |
| `LIMITS`     | Setzt die Zeichnungslimiten                       |
| `GRIDMODE`   | Systemvariable für Raster an/aus                  |
| `SNAPMODE`   | Systemvariable für Fang an/aus                    |

## Typische Konfigurationen

### Metrische Zeichnung (empfohlen)
- Rasterabstand: 10 × 10
- Fangabstand: 1 × 1 oder 5 × 5
- Hauptlinien: alle 5
- Stil: Linien

### Imperiale Zeichnung
- Rasterabstand: 0.5 × 0.5
- Fangabstand: 0.1 × 0.1 oder 0.25 × 0.25
- Hauptlinien: alle 5

### Isometrische Darstellung
- Fangstil: Isometrisch
- Raster folgt dem isometrischen Raster (30°/150°)

## Implementierungshinweise (für Claude Code)

Beim Nachbau eines ähnlichen Systems sollten folgende Aspekte berücksichtigt werden:

1. **Visuelle Ebene**  
   Raster als separate, nicht druckbare Overlay-Ebene rendern. Unterstützung für adaptive Dichte (weniger Linien bei weitem Zoom).

2. **Fang-Logik**  
   Cursor-Position beim Setzen von Punkten auf das nächste Vielfache des Fangabstands runden (separat für X und Y).

3. **Unabhängigkeit**  
   Rasteranzeige und Fang müssen getrennt steuerbar sein.

4. **Koordinatenbezug**  
   Raster und Fang am aktuellen Koordinatensystem (Ursprung + Rotation) ausrichten.

5. **Performance**  
   Bei großen Abständen oder starkem Zoom nur sichtbare Linien berechnen/rendern.

6. **Konfiguration**  
   Alle Werte (Abstände, Hauptlinien-Intervall, Stil, Farben) als einstellbare Parameter bereitstellen.

## Zusammenfassung

| Aspekt              | Funktion                          | Wird geplottet? | Beeinflusst Cursor? |
|---------------------|-----------------------------------|-----------------|---------------------|
| Raster (Anzeige)    | Visuelle Orientierung             | Nein            | Nein                |
| Rasterfang          | Präzise Punktplatzierung          | –               | Ja                  |
| Kombination         | Orientierung + Präzision          | Nein            | Ja                  |

Das Raster ist primär ein Hilfsmittel zur Orientierung. Die eigentliche funktionale Einschränkung der Cursorbewegung übernimmt der **Rasterfang**.
