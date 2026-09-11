// src/os/workspaces/WorkspaceRouter.tsx
import { useOS } from '../state/os-context.tsx';
import { MissionWorkspace } from './MissionWorkspace.tsx';
import { IntelligenceWorkspace } from './IntelligenceWorkspace.tsx';
import { AgentsWorkspace } from './AgentsWorkspace.tsx';
import { LaboratoryWorkspace } from './LaboratoryWorkspace.tsx';
import { SystemWorkspace } from './SystemWorkspace.tsx';

export function WorkspaceRouter() {
  const { workspace } = useOS();
  switch (workspace) {
    case 'mission': return <MissionWorkspace />;
    case 'intelligence': return <IntelligenceWorkspace />;
    case 'agents': return <AgentsWorkspace />;
    case 'laboratory': return <LaboratoryWorkspace />;
    case 'system': return <SystemWorkspace />;
    default: return null;
  }
}
