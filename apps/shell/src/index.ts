// Indirection required by Module Federation: the federation runtime must boot
// before any shared dependency (React, react-dom) is evaluated. src/main.tsx
// keeps the static React imports, so it must stay behind this dynamic import.
import('./main');
export {};
