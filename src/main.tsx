import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { isLocalStorageAvailable } from './lib/storage';
import { useAppStore } from './store/useAppStore';

// Run the localStorage probe before React renders so the first render already
// has the correct persistenceWorking flag. Avoids a flash of the
// persistence-off banner in Chrome (where storage works fine).
const storageOk = isLocalStorageAvailable();
useAppStore.setState({ persistenceWorking: storageOk });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
