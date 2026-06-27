/**
 * Minimal RFC-4180-ish CSV parser shared by the server-side file parser and
 * the client-side upload validation. Handles quoted fields containing commas,
 * escaped quotes ("") and embedded newlines. Pure module — safe to import in
 * both server and browser bundles.
 */
export function parseCsvRows(text: string): string[][] {
  // Pass 1: split into logical lines, respecting quotes (a quoted field may
  // contain newlines). Quote characters are kept so pass 2 can see them.
  const lines: string[] = []
  let currentLine = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentLine += '""'
        i++
      } else {
        inQuotes = !inQuotes
        currentLine += '"'
      }
    } else if (char === '\n' || char === '\r') {
      if (!inQuotes) {
        if (currentLine.trim()) {
          lines.push(currentLine)
          currentLine = ''
        }
        if (char === '\r' && nextChar === '\n') i++
      } else {
        currentLine += char
      }
    } else {
      currentLine += char
    }
  }
  if (currentLine.trim()) lines.push(currentLine)

  // Pass 2: split each line into fields.
  return lines.map((line) => {
    const fields: string[] = []
    let currentField = ''
    let inFieldQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inFieldQuotes && line[i + 1] === '"') {
          currentField += '"'
          i++
        } else {
          inFieldQuotes = !inFieldQuotes
        }
      } else if (char === ',' && !inFieldQuotes) {
        fields.push(currentField.trim())
        currentField = ''
      } else {
        currentField += char
      }
    }
    fields.push(currentField.trim())
    return fields
  })
}
