/**
 * The demo cluster the hero draws: the one in the app's screenshots, with 28 pods running,
 * 3 with warnings, 5 failing and 2 completed, on four nodes.
 */
import type { Health } from '../../lib/icons'

export interface NodeInfo {
  name: string
  condition: string
  health: Health
  /** What the node uses of what it has; a node that stopped reporting has no usage. */
  usage?: { cpu: number; mem: number }
  /** Grid cell on the cluster plate: 0,0 is at the back. */
  gx: number
  gy: number
}

export const NODES: NodeInfo[] = [
  {
    name: 'control-plane-1',
    condition: 'Ready',
    health: 'healthy',
    usage: { cpu: 0.36, mem: 0.47 },
    gx: 0,
    gy: 0,
  },
  {
    name: 'worker-1',
    condition: 'Ready',
    health: 'healthy',
    usage: { cpu: 0.88, mem: 0.62 },
    gx: 1,
    gy: 0,
  },
  {
    name: 'worker-2',
    condition: 'MemoryPressure',
    health: 'warning',
    usage: { cpu: 0.48, mem: 0.86 },
    gx: 1,
    gy: 1,
  },
  { name: 'worker-3', condition: 'NotReady', health: 'critical', gx: 0, gy: 1 },
]

/** Pods on worker-2, where memory is short: the ones OOM kills pick from. */
export const MEMORY_PRESSURE_NODE = 2

/** No node at all: the pod is waiting to be scheduled. */
export const UNSCHEDULED = -1

export interface PodSeed {
  name: string
  ns: string
  node: number
  health: Health
  label: string
  restarts?: number
  /** How many restarts end in another crash before one finally works. */
  crashLoops?: number
}

const pod = (
  name: string,
  ns: string,
  node: number,
  health: Health = 'healthy',
  label = 'Running',
  restarts?: number,
  crashLoops?: number,
): PodSeed => ({ name, ns, node, health, label, restarts, crashLoops })

export const PODS: PodSeed[] = [
  pod('etcd-control-plane-1', 'kube-system', 0),
  pod('kube-apiserver-control-plane-1', 'kube-system', 0),
  pod('kube-controller-manager-control-plane-1', 'kube-system', 0),
  pod('kube-scheduler-control-plane-1', 'kube-system', 0),
  pod('kube-proxy-7xkqp', 'kube-system', 0),
  pod('coredns-74jk5h7nlk-2tvb9', 'kube-system', 0),
  pod('node-exporter-m2v9d', 'monitoring', 0),
  pod('coredns-74jk5h7nlk-9dxdn', 'kube-system', 0),

  pod('kube-proxy-r5n8c', 'kube-system', 1),
  pod('db-migrate-2r5n5', 'batch', 1, 'critical', 'Error'),
  pod('node-exporter-h7tq4', 'monitoring', 1),
  pod('checkout-jzhdh6j29h-lnk52', 'shop', 1),
  pod('cart-t7b6nffcc9-xtqff', 'shop', 1),
  pod('storefront-cjt7gd2jtx-75pbc', 'shop', 1),
  pod('db-migrate-d6rml', 'batch', 1, 'critical', 'Error'),
  pod('storefront-cjt7gd2jtx-w9r4t', 'shop', 1),
  pod('prometheus-6f8d5c7b9-tq2zn', 'monitoring', 1),
  pod('postgres-0', 'data', 1),
  pod('reindex-8xk2f', 'batch', 1),
  pod('debug-shell', 'default', 1),

  pod('kube-proxy-b8d4w', 'kube-system', 2),
  pod('checkout-jzhdh6j29h-hqnnn', 'shop', 2, 'critical', 'CrashLoopBackOff', 14, 1),
  pod('node-exporter-x5p7j', 'monitoring', 2),
  pod('metrics-server-6d94bc8694-zt4wn', 'kube-system', 2),
  pod('recommendations-mcbt654b8h-bpp5n', 'shop', 2, 'critical', 'ImagePullBackOff'),
  pod('cart-t7b6nffcc9-llfmz', 'shop', 2),
  pod('checkout-jzhdh6j29h-pwkd2', 'shop', 2, 'critical', 'CrashLoopBackOff', 13, 1),
  pod('storefront-cjt7gd2jtx-pq6zd', 'shop', 2),
  pod('grafana-5b8c9d7f6-ljx4s', 'monitoring', 2),
  pod('stuck-terminating', 'default', 2, 'warning', 'Terminating'),
  pod('redis-0', 'data', 2),
  pod('postgres-1', 'data', 2),
  pod('nightly-reports-29309520-x7k2p', 'batch', 2, 'neutral', 'Completed'),

  pod('kube-proxy-n3j6s', 'kube-system', 3),
  pod('node-exporter-wxjlc', 'monitoring', 3, 'warning', 'Not ready'),
  pod('postgres-2', 'data', 3),
  pod('hello-29309755-ab12c', 'default', 3, 'neutral', 'Completed'),

  // redis-1 can't be scheduled, so it waits above the plate.
  pod('redis-1', 'data', UNSCHEDULED, 'warning', 'Unschedulable'),
]

/** What the scheduler says about redis-1. */
export const UNSCHEDULABLE_REASON =
  '0/4 nodes are available: 1 node(s) were not ready, 3 Insufficient memory.'

/** Slots fill from the middle of a node outwards, so a half-full node still looks settled. */
export const SLOT_ORDER = [5, 6, 9, 10, 1, 2, 4, 8, 7, 11, 13, 14, 0, 3, 12, 15]
