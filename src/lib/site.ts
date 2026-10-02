/** Where the project lives. Downloads come from its latest GitHub release (see releases.ts). */
export const site = {
  repo: 'https://github.com/KubeStacks/KubeStacks',
  releases: 'https://github.com/KubeStacks/KubeStacks/releases',
  /** Running KubeStacks in a cluster: signing in, ingress, security and every setting. */
  serverDocs: 'https://github.com/KubeStacks/KubeStacks/blob/main/docs/server.md',
  author: { name: 'Peter Kota', url: 'https://github.com/kotapeter' },
  sevalla: 'https://sevalla.com/?utm_source=kubestacks&utm_medium=referral&utm_campaign=website',
}

/** The image and the Helm chart, released with the app under the same version. */
export const server = {
  image: 'ghcr.io/kubestacks/kubestacks',
  chart: 'oci://ghcr.io/kubestacks/charts/kubestacks',
}
