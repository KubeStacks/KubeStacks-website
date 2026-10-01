/**
 * "Every change shows its kubectl": the app's Scale dialog. The command follows the
 * stepper, and scaling shows a notification you can undo, as in the app.
 */
const MAX_REPLICAS = 20

const replicas = (n: number) => `${n} replica${n === 1 ? '' : 's'}`

export function mountScale(root: HTMLElement) {
  const output = root.querySelector('output')!
  const command = root.querySelector('[data-cmd]')!
  const now = root.querySelector('[data-now]')!
  const apply = root.querySelector<HTMLButtonElement>('[data-apply]')!
  const toast = root.querySelector<HTMLElement>('[data-toast]')!
  const toastText = root.querySelector('[data-toast-text]')!
  const undo = root.querySelector<HTMLButtonElement>('[data-undo]')!
  let current = 3
  let wanted = 3
  let previous = 3
  let hideToast = 0

  function render() {
    output.textContent = String(wanted)
    command.innerHTML = `kubectl scale deployment/checkout <span class="arg">--replicas=${wanted}</span> -n shop --context demo`
    apply.disabled = wanted === current
    now.textContent = `Now ${current}`
  }

  function notify(text: string, canUndo: boolean) {
    toastText.textContent = text
    undo.hidden = !canUndo
    // Shown afresh, so it animates in again.
    toast.hidden = true
    void toast.offsetWidth
    toast.hidden = false
    window.clearTimeout(hideToast)
    hideToast = window.setTimeout(() => (toast.hidden = true), 5000)
  }

  root.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((button) =>
    button.addEventListener('click', () => {
      wanted = Math.min(MAX_REPLICAS, Math.max(0, wanted + Number(button.dataset.step)))
      render()
    }),
  )
  root.querySelector('[data-cancel]')!.addEventListener('click', () => {
    wanted = current
    render()
  })
  apply.addEventListener('click', () => {
    previous = current
    current = wanted
    render()
    notify(`Scaled checkout to ${replicas(current)}`, true)
  })
  undo.addEventListener('click', () => {
    current = wanted = previous
    render()
    notify(`Scaled checkout back to ${replicas(current)}`, false)
  })
  render()
}

document.querySelectorAll<HTMLElement>('[data-scale]').forEach(mountScale)
