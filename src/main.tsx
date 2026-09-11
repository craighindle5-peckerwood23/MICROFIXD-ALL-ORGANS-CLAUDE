import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import MicrofixedOS from './os/MicrofixedOS.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MicrofixedOS />
  </StrictMode>,
);
