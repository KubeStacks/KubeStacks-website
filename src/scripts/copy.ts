/**
 * Copy buttons: they copy their target's text and say so. Where the clipboard is refused,
 * the text is selected instead, ready for ⌘C.
 */
export function mountCopy(button: HTMLButtonElement) {
  const source = document.querySelector(button.dataset.copy!)!
  const label = button.getAttribute('aria-label')!
  let reset = 0
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(source.textContent!)
      button.toggleAttribute('data-done', true)
      button.setAttribute('aria-label', 'Copied')
      window.clearTimeout(reset)
      reset = window.setTimeout(() => {
        button.toggleAttribute('data-done', false)
        button.setAttribute('aria-label', label)
      }, 1600)
    } catch {
      window.getSelection()!.selectAllChildren(source)
    }
  })
}

document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach(mountCopy)
