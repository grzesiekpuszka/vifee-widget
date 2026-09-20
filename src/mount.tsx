import { render } from 'preact';
import { App } from './app';
import { loadBootstrap } from './core/bootstrap';
import { initWorkflow } from './core/workflow';
import { openRegistry, publishRegistry, sealRegistry } from './core/extension-registry';
import { installErrorCollector } from './core/error-collector';
import type { FeedbackGateway } from './core/gateway';
import styles from './styles/index.scss?inline';
import { ReviewActivation } from './features/review/review-activation';
import type { ReviewActivationResult } from './core/types';

export interface RuntimeConfig {
  gateway: FeedbackGateway;
  activationToken?: string;
  onActivated?(result: ReviewActivationResult): FeedbackGateway;
}

export interface WidgetHandle {
  destroy(): void;
}

publishRegistry();
// Installed at module scope rather than at mount: an error that happens while
// the bootstrap request is still in flight is exactly the kind worth reporting.
if (typeof window !== 'undefined') installErrorCollector();

const hostId = 'vifee-widget-root';
let activeHandle: WidgetHandle | null = null;
let mounting: Promise<WidgetHandle> | null = null;

export function mountVifee(config: RuntimeConfig): Promise<WidgetHandle> {
  if (activeHandle) return Promise.resolve(activeHandle);
  if (mounting) return mounting;

  mounting = createWidget(config).finally(() => {
    mounting = null;
  });
  return mounting;
}

/**
 * Builds the widget's shadow host and registers it as the active handle.
 *
 * Both mount paths — the full widget and the activation prompt shown to a
 * guest who has not claimed their review link yet — need byte-identical
 * isolation: same host id, same `mode: 'open'` shadow root, same inlined
 * stylesheet, same teardown. Keeping two copies of that meant a change to the
 * isolation (a style attribute, the stale-host sweep) could land in one path
 * and not the other, and only one of them is exercised on a typical page.
 */
function createShadowHost(): { root: HTMLDivElement; handle: WidgetHandle } {
  document.getElementById(hostId)?.remove();

  const host = document.createElement('div');
  host.id = hostId;
  host.dataset.vifeeOwned = 'true';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.dataset.vifeeStyles = 'true';
  style.textContent = styles;
  const root = document.createElement('div');
  root.id = 'vifee-app';
  shadow.append(style, root);
  document.documentElement.append(host);

  const handle: WidgetHandle = {
    destroy() {
      render(null, root);
      host.remove();
      if (activeHandle === handle) activeHandle = null;
    },
  };
  activeHandle = handle;
  return { root, handle };
}

async function createWidget(config: RuntimeConfig): Promise<WidgetHandle> {
  const bootstrap = await loadBootstrap(config.gateway);
  if (!bootstrap) {
    if (config.activationToken && config.gateway.activateReview) return createActivationWidget(config);
    return { destroy: () => undefined };
  }

  // Statuses and priorities come from the server so the widget, the REST
  // schema and the admin panel can never disagree about which values exist.
  initWorkflow(bootstrap);
  // Add-on modules declare a dependency on `vifee-widget`, so they execute
  // between these two calls: after the registry is open, before it is sealed.
  openRegistry(bootstrap);

  const { root, handle } = createShadowHost();
  sealRegistry();
  render(<App bootstrap={bootstrap} gateway={config.gateway} />, root);
  return handle;
}

function createActivationWidget(config: RuntimeConfig): WidgetHandle {
  const { root, handle } = createShadowHost();
  render(
    <ReviewActivation
      gateway={config.gateway}
      token={config.activationToken ?? ''}
      onActivated={(result) => {
        const nextGateway = config.onActivated?.(result) ?? config.gateway;
        handle.destroy();
        removeActivationToken();
        void mountVifee({ gateway: nextGateway });
      }}
    />,
    root,
  );
  return handle;
}

function removeActivationToken(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('vifee_token');
  window.history.replaceState(window.history.state, '', url.toString());
}
