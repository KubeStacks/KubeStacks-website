const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }

/** Text made safe to put inside HTML markup or a double-quoted attribute. */
export const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ENTITIES[c]!)
