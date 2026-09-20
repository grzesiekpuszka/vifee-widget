import { useEffect, useMemo, useState } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { __, sprintf } from '@vifee/i18n';
import { getPageIdentity } from './core/page-identity';
import { observeNavigation } from './core/navigation-observer';
import type { FeedbackGateway } from './core/gateway';
import type { Bootstrap } from './core/types';
import { CommentForm } from './features/comments/comment-form';
import { collectTechnicalMetadata } from './features/comments/technical-info';
import { PickerOverlay } from './features/picker/picker-overlay';
import { PinLayer } from './features/pins/pin-layer';
import { FeedbackStore } from './state/feedback-store';
import { revealAnchor } from './anchors/reveal';
import { sessionRead, sessionRemove, sessionWrite } from './core/safe-storage';
import { IconButton } from './ui/icon-button';
import { Launcher } from './ui/launcher';

const PINS_HIDDEN_KEY = 'vifee:pins-hidden';

const CommentPopover = lazy(() => import('./features/comments/comment-popover').then((module) => ({ default: module.CommentPopover })));
const Sidebar = lazy(() => import('./features/sidebar/sidebar').then((module) => ({ default: module.Sidebar })));

interface AppProps {
  bootstrap: Bootstrap;
  gateway: FeedbackGateway;
}

export function App({ bootstrap, gateway }: AppProps) {
  const store = useMemo(() => new FeedbackStore(gateway), [gateway]);
  const [state, setState] = useState(store.snapshot());
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [sidebarMounted, setSidebarMounted] = useState(false);
  const [sidebarFeedbackUuid, setSidebarFeedbackUuid] = useState<string | null>(null);
  // Persisted per browser tab (not per page) so the choice survives normal
  // full-page navigation between pages of the reviewed site, where this
  // widget instance remounts from scratch on every load.
  const [pinsVisible, setPinsVisible] = useState(() => sessionRead(PINS_HIDDEN_KEY) !== '1');

  useEffect(() => store.subscribe(() => setState(store.snapshot())), [store]);
  useEffect(() => {
    void store.loadPage(getPageIdentity(window.location.href));
    const stopNavigation = observeNavigation((page) => void store.loadPage(page));
    return () => {
      stopNavigation();
      store.destroy();
    };
  }, [store]);
  useEffect(() => {
    if (toolbarOpen) void store.loadOtherPages();
  }, [store, toolbarOpen]);
  useEffect(() => {
    const pendingUuid = sessionRead('vifee:pending-feedback');
    if (pendingUuid && state.feedback.some((item) => item.uuid === pendingUuid)) {
      sessionRemove('vifee:pending-feedback');
      const anchor = state.feedback.find((item) => item.uuid === pendingUuid)?.anchor;
      if (anchor) revealAnchor(anchor);
      store.openFeedback(pendingUuid);
    }
  }, [state.feedback, store]);
  // The admin's "Open pin on the page" link carries the target uuid as a URL
  // parameter rather than sessionStorage, since it is a fresh top-level
  // navigation from wp-admin with no shared client state.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetUuid = params.get('vifee_feedback');
    if (!targetUuid) return;
    if (state.feedback.some((item) => item.uuid === targetUuid)) {
      // The URL is cleaned up first: history.replaceState() is wrapped by
      // observeNavigation() (see core/navigation-observer.ts) to reload the
      // page's feedback, which resets openFeedbackUuid to null as part of
      // that reload. Calling openFeedback() after, not before, is what makes
      // it win instead of being immediately undone.
      params.delete('vifee_feedback');
      params.delete('_wpnonce');
      const query = params.toString();
      const url = new URL(window.location.href);
      url.search = query ? `?${query}` : '';
      window.history.replaceState(window.history.state, '', url.toString());
      const anchor = state.feedback.find((item) => item.uuid === targetUuid)?.anchor;
      if (anchor) revealAnchor(anchor);
      store.openFeedback(targetUuid);
    }
  }, [state.feedback, store]);
  // Alt+Shift+V starts a new pin from anywhere on the page, mirroring the
  // launcher's "+" action, without competing with browser or OS shortcuts
  // (Ctrl+Alt is reserved for AltGr characters on many non-US keyboard
  // layouts, so it is avoided here).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return;
      if (event.key.toLowerCase() !== 'v') return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (state.mode !== 'idle') return;
      event.preventDefault();
      setToolbarOpen(false);
      store.beginPick();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [state.mode, store]);

  const togglePinsVisible = () => {
    setPinsVisible((visible) => {
      const next = !visible;
      sessionWrite(PINS_HIDDEN_KEY, next ? '0' : '1');
      if (!next) store.closeFeedback();
      return next;
    });
  };

  const opened = state.feedback.find((item) => item.uuid === state.openFeedbackUuid) ?? null;
  const currentPageNumbers = useMemo(
    () => new Map(state.feedback.map((item, index) => [item.uuid, index + 1])),
    [state.feedback],
  );
  const controlsHidden = state.mode !== 'idle' || opened !== null;
  const openSidebar = () => {
    setSidebarMounted(true);
    setToolbarOpen(true);
  };
  return (
    <>
      {pinsVisible && (
        <PinLayer
          feedback={state.feedback}
          openUuid={state.openFeedbackUuid}
          onOpen={(uuid) => store.openFeedback(uuid)}
        />
      )}
      {state.mode === 'picking' && <PickerOverlay onSelect={(anchor) => {
        store.setDraft({ metadata: collectTechnicalMetadata() });
        store.selectAnchor(anchor);
      }} onCancel={() => store.cancelPick()} />}
      {state.mode === 'composing' && (
        <CommentForm
          draft={state.draft}
          pending={Boolean(state.pendingUuid)}
          error={state.error}
          onChange={(changes) => store.setDraft(changes)}
          onSubmit={() => void store.createFeedback()}
          onCancel={() => store.cancelPick()}
          gateway={gateway}
          screenshotEnabled={Boolean(bootstrap.capabilities.viewport_screenshot)}
          regionScreenshotEnabled={Boolean(bootstrap.capabilities.region_screenshot)}
          imageUploadEnabled={Boolean(bootstrap.capabilities.image_upload)}
          attachmentLimit={bootstrap.limits.attachmentsPerMessage}
        />
      )}
      {opened && (
        <Suspense fallback={null}><CommentPopover
          feedback={opened}
          number={currentPageNumbers.get(opened.uuid)!}
          gateway={gateway}
          onUpdated={(feedback) => store.replaceFeedback(feedback)}
          onClose={() => store.closeFeedback()}
          onOpenDetails={() => {
            setSidebarFeedbackUuid(opened.uuid);
            openSidebar();
            store.closeFeedback();
          }}
        /></Suspense>
      )}
      {sidebarMounted && (
        <Suspense fallback={<div class="vifee-sidebar-loading">{__( 'Loading comments…', 'vifee-visual-feedback' )}</div>}>
          <Sidebar
            open={toolbarOpen}
            currentPageKey={state.page?.pageKey ?? ''}
            currentPageNumbers={currentPageNumbers}
            currentFeedback={state.feedback}
            allFeedback={state.allFeedback.length > 0 ? state.allFeedback : state.feedback}
            loadingOther={state.loadingOther}
            gateway={gateway}
            actorName={bootstrap.actor.displayName}
            initialExpandedUuid={sidebarFeedbackUuid}
            onAdd={() => {
              setToolbarOpen(false);
              store.beginPick();
            }}
            onLocate={(uuid) => {
              setSidebarFeedbackUuid(null);
              const anchor = state.feedback.find((item) => item.uuid === uuid)?.anchor;
              if (anchor) revealAnchor(anchor);
              store.openFeedback(uuid);
              setToolbarOpen(false);
            }}
            onNavigate={(url, uuid) => {
              sessionWrite('vifee:pending-feedback', uuid);
              window.location.assign(url);
            }}
            onClose={() => setToolbarOpen(false)}
            onUpdated={(feedback) => store.replaceFeedback(feedback)}
            onRemoved={(uuid) => store.removeFeedback(uuid)}
          />
        </Suspense>
      )}
      <IconButton
        hidden={controlsHidden}
        class="vifee-pin-toggle"
        label={pinsVisible ? __( 'Hide comment pins', 'vifee-visual-feedback' ) : __( 'Show comment pins', 'vifee-visual-feedback' )}
        icon={pinsVisible ? 'eye-off' : 'eye'}
        aria-pressed={!pinsVisible}
        onClick={togglePinsVisible}
      />
      <Launcher
        hidden={controlsHidden}
        class="vifee-launcher--sidebar"
        label={sprintf( __( 'Open feedback list — %s', 'vifee-visual-feedback' ), bootstrap.actor.displayName )}
        icon="message-circle"
        count={state.feedback.length}
        onClick={() => {
          if (toolbarOpen) setToolbarOpen(false);
          else openSidebar();
        }}
      />
      <Launcher
        hidden={controlsHidden}
        class="vifee-launcher--add"
        label={__( 'Add a new pin (Alt+Shift+V)', 'vifee-visual-feedback' )}
        symbol="+"
        onClick={() => {
          setToolbarOpen(false);
          store.beginPick();
        }}
      />
    </>
  );
}
