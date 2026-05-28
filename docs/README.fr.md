# Histogram+

**🌐 Autres langues :** [English](../README.md) · [Nederlands](README.nl.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [简体中文](README.zh.md)

Visuel personnalisé Power BI pour les distributions numériques, conçu pour l'analyse qualité, process et laboratoire. Histogram+ apporte un contrôle manuel des bins, une courbe normale superposée, des limites de spécification LSI/LSS avec ligne cible, Cp/Cpk plus en option le niveau sigma + DPMO et un test de normalité Anderson-Darling, et une couche claire de lignes de référence (moyenne, médiane, ±N écart-type).

## Fonctionnalités

- Trois modes de binning : **Auto (Sturges)**, **Nombre de bins**, **Largeur de bin**, avec intervalles `[x)`.
- **Plage X personnalisée** optionnelle excluant les valeurs hors plage du décompte.
- Mesure **Fréquence (Nombre)** pour le binning correct des données pré-groupées ou entières.
- Superposition de **courbe normale**.
- **Limites de spécification** : LSI, LSS, ligne cible et lecture de capabilité :
  - **Cp / Cpk**
  - **Niveau sigma + DPMO** (capabilité process en langage Six Sigma)
  - **p-valeur Anderson-Darling** (test de normalité)
- Superposition **Q-Q plot** pour évaluation rapide de la normalité.
- Bande **boxplot** sous l'histogramme.
- **Lignes de référence** pour moyenne, médiane et bandes ±1/±2/±3 ET.
- **Mini-graphique** dans les info-bulles.
- Power BI **mise en évidence / surbrillance croisée**.
- Navigation clavier, anneau de focus thématique, croix de survol, animation d'entrée fluide.
- Mode contraste élevé et `prefers-reduced-motion`.
- **6 langues** : anglais, néerlandais, allemand, français, espagnol, chinois simplifié.

## Utilisation

1. Ajoutez Histogram+ via **Visualisations → Importer un visuel → à partir d'un fichier**.
2. Glissez une colonne numérique dans **Valeurs (numériques)**.
3. Pour **valeurs répétées ou entières** (âge, score, mesures avec répétitions), ajoutez la même colonne à **Fréquence (Nombre)** avec agrégation Nombre. Power BI regroupe les valeurs catégorielles avant de les transmettre au visuel personnalisé ; la mesure Fréquence fournit le bon décompte par barre.
4. Ouvrez **Format** pour ajuster mode de bin, plage d'axe, limites de spec, lignes de référence et lecture de capabilité.

## Confidentialité

Histogram+ ne stocke aucune donnée, n'envoie aucune télémétrie et ne fait aucun appel réseau externe. Fonctionne entièrement dans la sandbox Power BI. `capabilities.json` déclare `privileges: []`.

## Support

Bugs et demandes de fonctionnalités : https://github.com/mkocontracting/histogram-plus/issues

## Licence

MIT.
