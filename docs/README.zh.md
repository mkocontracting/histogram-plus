# Histogram+

**🌐 其他语言：** [English](../README.md) · [Nederlands](README.nl.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md)

适用于数值分布的 Power BI 自定义视觉对象，专为质量、过程和实验室分析而设计。Histogram+ 提供手动区间控制、正态曲线叠加、上下规格限（LSL/USL）与目标线、Cp/Cpk 以及可选的 sigma 等级 + DPMO 和 Anderson-Darling 正态性检验、参考线层（均值、中位数、±N 标准差）。

## 功能

- 三种区间模式：**Auto（Sturges）**、**区间数量**、**区间宽度**，使用标准 `[x)` 区间。
- 可选**自定义 X 轴范围**，排除范围外的数据。
- **频次（计数）**度量，用于已分组或整数数据的正确分箱。
- **正态曲线**叠加层。
- **规格限**：下规格限、上规格限、目标线和过程能力读数：
  - **Cp / Cpk**
  - **Sigma 等级 + DPMO**（Six Sigma 术语下的过程能力）
  - **Anderson-Darling p 值**（正态性检验）
- **Q-Q 图**叠加层，用于快速正态性评估。
- 直方图下方的**箱线图**条带。
- 均值、中位数和 ±1/±2/±3 标准差带的**参考线**。
- 工具提示中的**迷你图**。
- Power BI **高亮 / 交叉高亮**。
- 键盘导航、主题适配的焦点环、悬停十字线、平滑的进入动画。
- 高对比度模式与 `prefers-reduced-motion`。
- **6 种语言**：英语、荷兰语、德语、法语、西班牙语、简体中文。

## 使用

1. 在 Power BI Desktop 通过**可视化效果 → 导入视觉对象 → 从文件**添加 Histogram+。
2. 将数字列拖到**数值（数字）**。
3. 对于**重复或整数值**（如年龄、分数、含重复的测量值），将同一列同时添加到**频次（计数）**并将聚合设置为「计数」。Power BI 在将分类值传递给自定义视觉对象之前会先分组；频次度量提供每个柱形的正确计数。
4. 打开**格式**面板，调整区间模式、坐标轴范围、规格限、参考线和过程能力读数。

## 隐私

Histogram+ 不存储数据，不发送遥测，不进行任何外部网络调用。完全在 Power BI 沙箱内运行。`capabilities.json` 声明 `privileges: []`。

## 支持

Bug 与功能请求：https://github.com/mkocontracting/histogram-plus/issues

## 许可

MIT。
