/**
 * The demo cluster the page shows: the same one as in the app's screenshots, so the hero,
 * the feature demos and the screenshots tell one story.
 */
export const DEMO_CLUSTER = {
  name: 'demo',
  kubernetes: 'v1.37.1',
  nodes: 4,
}

/** Other clusters in the demo kubeconfig, as the command palette lists them. */
export const OTHER_CLUSTERS = [
  { name: 'staging-eu', kubernetes: 'v1.36.4' },
  { name: 'prod-us-east', kubernetes: 'v1.36.4' },
]
