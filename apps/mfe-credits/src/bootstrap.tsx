import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { createAppTheme } from '@credithub/ui';
import { App } from './App';
import { StandaloneQueryProvider } from './query-client';

// Standalone entry point. CreditsApp brings its own ThemeProvider (so it also
// renders correctly as a remote), but global element styling - body margin,
// background, font metrics - is the job of the application root, which is here.
// This keeps CssBaseline out of the shell when the remote is hosted.
function Standalone() {
  const theme = useMemo(() => createAppTheme(), []);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* В hosted-режиме клиента даёт shell, здесь его нет - создаём свой. */}
      <StandaloneQueryProvider>
        <App />
      </StandaloneQueryProvider>
    </ThemeProvider>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('#root element not found');

createRoot(container).render(
  <StrictMode>
    <Standalone />
  </StrictMode>
);
