// src/os/MicrofixedOS.tsx
//
// New OS entry point. Deliberately does not replace or delete
// src/MicrofixedOS.tsx (the existing, working boot+chat+voice
// component) -- that stays intact and reachable. This is the
// persistent-shell / five-workspace experience described in the
// implementation directive, built additively.
//
// Wiring this in as the active entry (main.tsx) is a one-line swap once
// you've confirmed it against a live backend; left as an explicit,
// separate step rather than silently done, per "the existing application
// is the source of truth."

import { OSProvider } from './state/os-context.tsx';
import { OSShell } from './shell/OSShell.tsx';

export default function MicrofixedOSApp() {
  return (
    <OSProvider>
      <OSShell />
    </OSProvider>
  );
}
