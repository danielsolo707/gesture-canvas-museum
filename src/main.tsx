import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { logger } from './utils/logging';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

logger.info('Gesture Canvas mounting...');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
