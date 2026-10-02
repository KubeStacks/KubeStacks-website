/**
 * The docs, at docs.kubestacks.com, by the pages this site links to. Paths are the docs' own
 * (their files in KubeStacks/KubeStacks-docs), and titles are what each page is called there,
 * so a link reads like the page it opens. Name a page by its path, and the compiler catches
 * any that isn't here.
 */
export const DOCS_URL = 'https://docs.kubestacks.com'

export const PAGES = {
  'get-started/desktop': 'Install the desktop app',
  'get-started/in-your-cluster': 'Run KubeStacks in your cluster',
  'get-started/tour': 'A quick tour',
  'get-started/sign-in': 'Signing in to your team’s KubeStacks',
  'clusters/connect': 'Connect your clusters',
  'explore/overview': 'Overview',
  'explore/workloads': 'Workloads',
  'explore/pods': 'Pods',
  'explore/health': 'Health and status',
  'explore/finding-things': 'Finding things',
  'changes/safely': 'Changing things safely',
  'changes/yaml': 'Edit YAML',
  'changes/bulk': 'Several at once',
  'changes/read-only': 'Read-only mode',
  'changes/undo-and-activity': 'Undo and activity',
  'debug/logs': 'Logs',
  'debug/shell': 'Shells and debug containers',
  'debug/port-forwarding': 'Port forwarding',
  'metrics/live-usage': 'Live usage',
  'metrics/usage-history': 'Usage history',
  'helm/releases': 'Helm releases',
  'helm/upgrade-and-rollback': 'Upgrade, roll back and uninstall',
  'helm/install': 'Install a chart',
  'custom-resources/overview': 'Custom resources',
  'custom-resources/built-in-views': 'Built-in views',
  'custom-resources/write-a-view': 'Write a view',
  'server/overview': 'KubeStacks in your cluster',
  'server/install': 'Install KubeStacks in your cluster',
  'server/expose': 'Give KubeStacks an address',
  'server/auth/tokens': 'Sign in with a token',
  'server/auth/single-sign-on': 'Sign in with single sign-on',
  'server/auth/proxy': 'Sign in through an authenticating proxy',
  'server/security': 'Security in your cluster',
  'server/docker': 'Run it without Kubernetes',
  'server/helm-values': 'Helm values',
  'reference/keyboard-shortcuts': 'Keyboard shortcuts',
  'reference/view-format': 'View format',
  'reference/troubleshooting': 'Troubleshooting',
  'reference/faq': 'Frequently asked questions',
  'reference/build-from-source': 'Build from source and contribute',
  changelog: 'Changelog',
} as const

export type DocPath = keyof typeof PAGES

/** A page's address, at one of its headings when `section` is given. */
export const doc = (path?: DocPath, section?: string) =>
  `${DOCS_URL}${path ? `/${path}` : ''}${section ? `#${section}` : ''}`
