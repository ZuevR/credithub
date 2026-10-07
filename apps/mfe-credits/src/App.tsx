// Exposed by the federation plugin as 'mfe-credits/App'.
// Consumers render it lazily via `lazyProvider('mfe-credits', 'App')`.
export function App() {
  return (
    <section data-testid="mfe-credits">
      <h1>Hello from mfe-credits</h1>
    </section>
  );
}

export default App;
