# Histogram+

**🌐 Andere talen:** [English](../README.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [简体中文](README.zh.md)

Een Power BI custom visual voor numerieke verdelingen, gemaakt voor kwaliteits-, proces- en laboratoriumanalyse. Histogram+ geeft handmatige bin-controle, een normaalkromme-overlay, LSL/USL-specificatiegrenzen met doellijn, Cp/Cpk plus optioneel sigmaniveau + DPMO en een Anderson-Darling normaliteitstoets, en een nette laag referentielijnen (gemiddelde, mediaan, ±N SD).

## Functionaliteit

- Drie binning-modi: **Auto (Sturges)**, **Aantal bins** en **Binbreedte**, met standaard `[x)`-intervallen en de laatste bin rechts gesloten.
- Optioneel **aangepast x-asbereik** dat waarden buiten het zichtbare bereik uitsluit van de telling.
- **Frequentie (Aantal)**-maat voor correcte binning van herhalende of voorgegroepeerde data.
- **Normaalkromme** aangepast aan gemiddelde en standaarddeviatie.
- **Specificatiegrenzen**: LSL, USL, doellijn en een capaciteits-uitlezing:
  - **Cp / Cpk**
  - **Sigmaniveau + DPMO** (procescapaciteit in Six Sigma-terminologie)
  - **Anderson-Darling p-waarde** (normaliteitstoets)
- **Q-Q-grafiek** overlay voor snelle visuele normaliteitscontrole.
- **Boxplot-strip** onder het histogram met IQR, mediaan en 1,5·IQR-grenzen.
- **Referentielijnen** voor gemiddelde, mediaan en ±1/±2/±3 SD-banden.
- **Mini-grafiek** in tooltips (Unicode-blokschets van alle bins).
- Power BI **highlight / cross-highlight** wanneer het rapport highlight-waarden meegeeft.
- Toetsenbordnavigatie (Pijl / Home / End / Enter / Esc), focusring met thema, hover-crosshair, vloeiende enter-animatie.
- Ondersteuning voor hoog contrast en `prefers-reduced-motion`.
- Mobiele weergave: bij smalle viewports vallen astitels weg en krimpen marges.
- **6 talen**: Engels, Nederlands, Duits, Frans, Spaans, Vereenvoudigd Chinees.

## Gebruik

1. Voeg Histogram+ toe via **Visualisaties → Een visual importeren → uit een bestand**.
2. Sleep een numerieke kolom naar **Waarden (numeriek)**.
3. Bij **herhalende of integer-gegroepeerde waarden** (leeftijd, score, een kolom waarin dezelfde waarde vaak voorkomt) sleep dezelfde kolom ook naar **Frequentie (Aantal)** en zet de aggregatie op **Aantal**. Power BI groepeert categorische waarden voordat ze naar een custom visual gaan; de Frequentie-maat draagt de telling per waarde zodat balken correct worden geschaald.
4. Open het **Opmaak**-paneel om binmodus, asbereik, speclimits, referentielijnen en de capaciteits-uitlezing aan te passen.

## Privacy

Histogram+ slaat geen data op, stuurt geen telemetrie, en maakt geen externe netwerkaanroepen. Draait volledig in de Power BI sandbox. `capabilities.json` verklaart `privileges: []`.

## Ondersteuning

Bugs en feature requests: https://github.com/mkocontracting/histogram-plus/issues

## Licentie

MIT.
