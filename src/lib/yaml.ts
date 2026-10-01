import { escapeHtml } from './html'

/**
 * A small YAML highlighter for the views sample: quoted strings and keys get a class each.
 * It knows just enough YAML for that sample, which is all it's used for.
 */
export function highlightYaml(yaml: string): string {
  return escapeHtml(yaml)
    .replace(/'[^'\n]*'/g, '<span class="q">$&</span>')
    .replace(/(^|[\s{,-])([A-Za-z]\w*)(?=:)/gm, '$1<span class="k">$2</span>')
}
