export function labelFromFileName(fileName: string, index: number): string {
  const base = fileName.replace(/\.(gpx|kml)$/i, '')
  const dayMatch = base.match(/day[\s_-]*(\d+)/i)
  if (dayMatch) return `Day ${dayMatch[1]}`
  if (/^\d+$/.test(base.trim())) return `Day ${base.trim()}`
  return `Day ${index + 1}`
}
