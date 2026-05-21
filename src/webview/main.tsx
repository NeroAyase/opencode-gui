import { render } from 'solid-js/web';
import App from './App';
import { CodeFreeOProvider } from './hooks/useOpenCode';
import { SyncProvider } from './state/sync';
import './App.css';

try {
  render(
    () => (
      <CodeFreeOProvider>
        <SyncProvider>
          <App />
        </SyncProvider>
      </CodeFreeOProvider>
    ),
    document.getElementById('root')!
  );
} catch (error) {
  console.error('[CodeFree-O] Error rendering webview:', error);
}
