# Histogram+

**🌐 Andere Sprachen:** [English](../README.md) · [Nederlands](README.nl.md) · [Français](README.fr.md) · [Español](README.es.md) · [简体中文](README.zh.md)

Ein Power BI Custom-Visual für numerische Verteilungen, gebaut für Qualitäts-, Prozess- und Laboranalyse. Histogram+ bietet manuelle Bin-Steuerung, eine Normalkurve-Überlagerung, USG/OSG-Spezifikationsgrenzen mit Zielwert, Cp/Cpk plus optionales Sigma-Niveau + DPMO und einen Anderson-Darling-Normalitätstest, sowie eine saubere Referenzlinien-Schicht (Mittelwert, Median, ±N SD).

## Funktionen

- Drei Bin-Modi: **Auto (Sturges)**, **Anzahl Bins**, **Bin-Breite**, mit `[x)`-Intervallen.
- Optionaler **benutzerdefinierter X-Achsen-Bereich** mit Ausschluss von Werten außerhalb der Sichtbarkeit.
- **Häufigkeit (Anzahl)**-Measure für korrekte Binning bei wiederholten oder vorgruppierten Daten.
- **Normalkurve**-Überlagerung.
- **Spezifikationsgrenzen**: USG, OSG, Zielwertlinie und Capability-Anzeige:
  - **Cp / Cpk**
  - **Sigma-Niveau + DPMO** (Prozessfähigkeit in Six-Sigma-Sprache)
  - **Anderson-Darling p-Wert** (Normalitätstest)
- **Q-Q-Diagramm**-Überlagerung für schnelle visuelle Normalitätsprüfung.
- **Boxplot-Streifen** unter dem Histogramm.
- **Referenzlinien** für Mittelwert, Median und ±1/±2/±3 SD-Bänder.
- **Mini-Diagramm** in Tooltips.
- Power BI **Highlight / Cross-Highlight**.
- Tastaturnavigation, themengerechter Fokusring, Hover-Fadenkreuz, sanfte Eintritts-Animation.
- Hoher Kontrast und `prefers-reduced-motion` unterstützt.
- **6 Sprachen**: Englisch, Niederländisch, Deutsch, Französisch, Spanisch, Vereinfachtes Chinesisch.

## Verwendung

1. Histogram+ in Power BI Desktop über **Visualisierungen → Visual importieren → aus Datei** hinzufügen.
2. Numerische Spalte in **Werte (numerisch)** ziehen.
3. Bei **wiederholten oder ganzzahligen Werten** (Alter, Score, Messwerte mit Häufigkeit) dieselbe Spalte zusätzlich zu **Häufigkeit (Anzahl)** hinzufügen und Aggregation auf Anzahl setzen. Power BI gruppiert kategorische Werte vor Übergabe an das Custom-Visual; das Häufigkeits-Measure liefert die korrekte Balkenhöhe.
4. Im **Formatieren**-Bereich Bin-Modus, Achsenbereich, Spezifikationsgrenzen, Referenzlinien und Capability-Anzeige feinjustieren.

## Datenschutz

Histogram+ speichert keine Daten, sendet keine Telemetrie, ruft keine externen Endpunkte auf. Läuft vollständig in der Power BI Sandbox. `capabilities.json` deklariert `privileges: []`.

## Support

Fehler und Funktionswünsche: https://github.com/mkocontracting/histogram-plus/issues

## Lizenz

MIT.
