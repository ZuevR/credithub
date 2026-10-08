import { CreditsApp } from './credits-app';

// Standalone entry for this provider (see src/bootstrap.tsx). The shell never
// renders this - it loads the exposed './CreditsApp' directly - so keep the two
// in sync by delegating rather than duplicating markup.
export function App() {
  return (
    <main>
      <CreditsApp />
    </main>
  );
}

export default App;
