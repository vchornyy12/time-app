const MAX_HTML = 200_000

const ENTITIES: Record<string, string> = { nbsp: ' ', lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6});/gi, (match, entity: string) => {
    if (entity[0] !== '#') return ENTITIES[entity.toLowerCase()] ?? match
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10)
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
  })
}

/**
 * Reduce an HTML email body to readable text. The result is only ever sent to
 * the model as untrusted data; it is never rendered, so this is not a sanitizer.
 */
export function htmlToText(html: string): string {
  return decodeEntities(html.slice(0, MAX_HTML)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|head|title)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6]|blockquote|table)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' '))
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
