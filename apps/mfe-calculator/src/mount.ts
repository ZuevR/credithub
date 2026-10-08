import { createComponent } from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { Calculator } from './app/calculator';

/**
 * Contract between this remote and any host (including the React shell).
 *
 * The host owns layout and routing, so it hands over a DOM element and this
 * function owns everything Angular from there: it creates an application
 * environment, renders `Calculator` into that element and returns a teardown
 * function. The host never touches Angular APIs, which keeps the shell
 * framework-agnostic for future remotes.
 */
export async function mount(element: Element): Promise<() => void> {
  const appRef = await createApplication(appConfig);
  const componentRef = createComponent(Calculator, {
    environmentInjector: appRef.injector,
    hostElement: element,
  });
  appRef.attachView(componentRef.hostView);

  return () => {
    componentRef.destroy();
    appRef.destroy();
    // Angular destroys the view but deliberately leaves the host element and
    // the nodes the component created, so clear them explicitly - otherwise
    // the host's markup stays in the DOM after unmount.
    element.replaceChildren();
  };
}

export { Calculator };
export default mount;
