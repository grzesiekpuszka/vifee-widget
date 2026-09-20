import { useEffect, useRef, useState } from 'preact/hooks';
import { __ } from '@vifee/i18n';
import { Icon } from './icons';

export interface ActionMenuItem {
  label: string;
  tone?: 'danger';
  onSelect(): void;
}

export function ActionMenu({ label = __( 'More actions', 'vifee-visual-feedback' ), items }: { label?: string; items: ActionMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (root.current && !event.composedPath().includes(root.current)) setOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);
  useEffect(() => {
    // Scoped to the menu's own subtree (not `document`) and stops
    // propagation: a popover/sidebar ancestor also closes on Escape, and
    // without this, Escape would close that ancestor instead of just this
    // menu, because the ancestor's listener sits closer to `document` in the
    // bubble path than this one would if it lived there too.
    if (!open || !root.current) return;
    const container = root.current;
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
    };
    container.addEventListener('keydown', closeEscape);
    return () => container.removeEventListener('keydown', closeEscape);
  }, [open]);
  if (items.length === 0) return null;
  return (
    <div class="vifee-action-menu" ref={root}>
      <button type="button" class="vifee-icon-button" aria-label={label} title={label} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}>
        <Icon name="ellipsis" />
      </button>
      {open && <div class="vifee-action-menu__panel" role="menu">
        {items.map((item) => <button type="button" role="menuitem" class={item.tone === 'danger' ? 'is-danger' : ''} onClick={() => { setOpen(false); item.onSelect(); }}>
          <span>{item.label}</span>
        </button>)}
      </div>}
    </div>
  );
}
