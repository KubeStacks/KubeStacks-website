/** Light and dark side by side: the slider moves the line between the two screenshots. */
export function mountCompare(root: HTMLElement) {
  const input = root.querySelector('input')!
  const update = () => root.style.setProperty('--split', `${input.value}%`)
  input.addEventListener('input', update)
  update()
}

document.querySelectorAll<HTMLElement>('[data-compare]').forEach(mountCompare)
