# Histogram+

**🌐 Otros idiomas:** [English](../README.md) · [Nederlands](README.nl.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [简体中文](README.zh.md)

Visualización personalizada de Power BI para distribuciones numéricas, diseñada para análisis de calidad, procesos y laboratorio. Histogram+ ofrece control manual de bins, superposición de curva normal, límites de especificación LEI/LES con línea objetivo, Cp/Cpk más opcionalmente nivel sigma + DPMO y un test de normalidad Anderson-Darling, y una capa limpia de líneas de referencia (media, mediana, ±N DE).

## Funciones

- Tres modos de binning: **Auto (Sturges)**, **Número de bins**, **Ancho de bin**, con intervalos `[x)`.
- **Rango X personalizado** opcional que excluye valores fuera del rango.
- Medida de **Frecuencia (Recuento)** para binning correcto de datos pre-agrupados o enteros.
- Superposición de **curva normal**.
- **Límites de especificación**: LEI, LES, línea objetivo y lectura de capacidad:
  - **Cp / Cpk**
  - **Nivel sigma + DPMO** (capacidad de proceso en lenguaje Six Sigma)
  - **p-valor Anderson-Darling** (test de normalidad)
- Superposición **Q-Q** para evaluación rápida de normalidad.
- Tira **boxplot** debajo del histograma.
- **Líneas de referencia** para media, mediana y bandas ±1/±2/±3 DE.
- **Mini-gráfico** en tooltips.
- Power BI **resaltado / resaltado cruzado**.
- Navegación con teclado, anillo de foco con tema, cruz al pasar el ratón, animación de entrada suave.
- Modo alto contraste y `prefers-reduced-motion`.
- **6 idiomas**: inglés, neerlandés, alemán, francés, español, chino simplificado.

## Uso

1. Añade Histogram+ vía **Visualizaciones → Importar una visualización → desde un archivo**.
2. Arrastra una columna numérica a **Valores (numéricos)**.
3. Para **valores repetidos o enteros** (edad, puntuación, mediciones), añade la misma columna a **Frecuencia (Recuento)** con agregación Recuento. Power BI agrupa los valores categóricos antes de pasarlos a la visualización; la medida Frecuencia transporta el recuento correcto por barra.
4. Abre **Formato** para ajustar modo de bin, rango del eje, límites de spec, líneas de referencia y lectura de capacidad.

## Privacidad

Histogram+ no almacena datos, no envía telemetría y no realiza llamadas de red externas. Funciona completamente dentro del sandbox de Power BI. `capabilities.json` declara `privileges: []`.

## Soporte

Errores y solicitudes de funciones: https://github.com/mkocontracting/histogram-plus/issues

## Licencia

MIT.
