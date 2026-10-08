import {
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  type ApplicationConfig,
} from '@angular/core';

/**
 * Configuration for the application environment created by src/mount.ts.
 *
 * No router: the host owns routing, this remote only renders one widget. The
 * zoneless provider is stated explicitly rather than relied upon implicitly -
 * there is no zone.js in this app.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
  ],
};
