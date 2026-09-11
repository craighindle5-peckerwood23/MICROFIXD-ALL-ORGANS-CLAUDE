// src/os/shell/MissionGraph.tsx
//
// React Flow mapped directly onto real StepRecord data from the actual
// run being polled -- each node is one real planned/executed step, laid
// out left-to-right by sequence. No synthetic nodes are added; an empty
// plan renders an empty graph, not a decorative placeholder.

import { useMemo } from 'react';
import { ReactFlow, Background, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { StepRecord } from '../../autonomy/types.ts';

const STATUS_COLOR: Record<string, string> = {
  pending: '#475569',
  running: '#22d3ee',
  succeeded: '#2dd4bf',
  blocked: '#fbbf24',
  denied: '#f87171',
  failed: '#f87171',
};

export function MissionGraph({ steps }: { steps: StepRecord[] }) {
  const { nodes, edges } = useMemo(() => {
    const sorted = [...steps].sort((a, b) => a.sequence - b.sequence);
    const nodes: Node[] = sorted.map((step, i) => ({
      id: step.id,
      position: { x: i * 180, y: 0 },
      data: { label: `#${step.sequence} ${step.action?.kind ?? 'action'}` },
      style: {
        background: 'rgba(0,0,0,0.6)',
        border: `1px solid ${STATUS_COLOR[step.status] ?? '#475569'}`,
        color: STATUS_COLOR[step.status] ?? '#94a3b8',
        fontSize: 10,
        fontFamily: 'monospace',
        borderRadius: 6,
        padding: 8,
      },
    }));
    const edges: Edge[] = sorted.slice(1).map((step, i) => ({
      id: `${sorted[i].id}-${step.id}`,
      source: sorted[i].id,
      target: step.id,
      animated: step.status === 'running',
      style: { stroke: '#0891b2' },
    }));
    return { nodes, edges };
  }, [steps]);

  if (nodes.length === 0) {
    return <div className="flex h-full items-center justify-center text-xs text-slate-600">No steps reported yet.</div>;
  }

  return (
    <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
      <Background color="#0891b2" gap={20} size={1} />
    </ReactFlow>
  );
}
