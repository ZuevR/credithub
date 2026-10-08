import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { Calculator } from './app/calculator';

// Standalone entry: serves the same component the host renders through
// ./mount, so the app can be developed and inspected on its own (port 8104).
bootstrapApplication(Calculator, appConfig).catch((err) => console.error(err));
