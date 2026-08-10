/** iGEO-aligned palette for Share of Voice segments — soft but distinct. */
export const SOV_COLORS = [
  '#5B8DEF',
  '#3DBEAB',
  '#F07167',
  '#F5A623',
  '#9B7BF7',
  '#4ECDC4',
  '#E879A9',
  '#6BCB77',
  '#8892B0',
  '#FFB347',
  '#7C9CFF',
] as const

export const SOV_CHART = {
  width: 400,
  height: 348,
  donutSize: 200,
  /** Fraction of half-width for pie outerRadius. */
  outerRadiusPct: 0.84,
  innerRadiusPct: 0.62,
  logoOrbit: 132,
  centerHub: 100,
} as const

export function sovChartCenter() {
  return { cx: SOV_CHART.width / 2, cy: SOV_CHART.height / 2 }
}

export function sovDonutOuterRadius() {
  return (SOV_CHART.donutSize / 2) * SOV_CHART.outerRadiusPct
}
