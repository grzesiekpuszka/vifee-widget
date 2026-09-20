import type { ComponentType } from 'preact';
import type { Bootstrap, FeedbackPriority, FeedbackStatus } from './types';

export interface MentionCandidate {
  id: string;
  label: string;
}

export interface WorkflowEditorProps {
  statuses: ReadonlyArray<{ key: FeedbackStatus; label: string }>;
  priorities: ReadonlyArray<{ key: FeedbackPriority; label: string }>;
}

export interface AssigneePickerProps {
  feedbackUuid: string;
  value: string | null;
  onChange(value: string | null): void;
}

/**
 * Every slot is paired with the capability that must be enabled for it to
 * render. The pairing lives here so the widget can never show a control the
 * server would refuse — the same capability also guards the REST endpoint.
 */
const slotCapabilities = {
  workflowEditor: 'custom_workflow',
  mentionProvider: 'mentions',
  assigneePicker: 'assignees',
  brandingTokens: 'white_label',
} as const;

export type ExtensionSlot = keyof typeof slotCapabilities;

export interface VifeeExtension {
  id: string;
  workflowEditor?: ComponentType<WorkflowEditorProps>;
  mentionProvider?: (query: string) => Promise<MentionCandidate[]>;
  assigneePicker?: ComponentType<AssigneePickerProps>;
  brandingTokens?: Record<string, string>;
}

interface RegistryState {
  extensions: VifeeExtension[];
  sealed: boolean;
  capabilities: Record<string, boolean>;
}

const state: RegistryState = { extensions: [], sealed: false, capabilities: {} };

const knownSlots = Object.keys(slotCapabilities) as ExtensionSlot[];

/**
 * Registers an add-on. Must be called before the widget mounts: the core reads
 * the registry once while building its tree, so a late registration would
 * silently do nothing. Warning loudly is better than a control that never
 * appears and cannot be debugged.
 */
export function registerExtension(extension: VifeeExtension): void {
  if (state.sealed) {
    console.warn(
      `[vifee] Extension "${extension?.id ?? 'unknown'}" was registered after the widget mounted and will be ignored. ` +
        'Load extension modules with a dependency on the "vifee-widget" module.',
    );
    return;
  }
  if (!extension || typeof extension.id !== 'string' || extension.id === '') {
    console.warn('[vifee] Ignoring an extension without a string id.');
    return;
  }
  if (state.extensions.some((candidate) => candidate.id === extension.id)) {
    console.warn(`[vifee] Extension "${extension.id}" is already registered; ignoring the duplicate.`);
    return;
  }
  // Unknown keys are dropped rather than stored, so a typo fails visibly here
  // instead of looking registered but never rendering.
  const accepted: VifeeExtension = { id: extension.id };
  const target = accepted as unknown as Record<string, unknown>;
  for (const slot of knownSlots) {
    if (extension[slot] !== undefined) {
      target[slot] = extension[slot];
    }
  }
  state.extensions.push(accepted);
}

/** Publishes the registry and freezes registration once the widget mounts. */
export function openRegistry(bootstrap: Pick<Bootstrap, 'capabilities'>): void {
  state.capabilities = bootstrap.capabilities ?? {};
  state.sealed = false;
}

export function sealRegistry(): void {
  state.sealed = true;
}

export function resetRegistry(): void {
  state.extensions = [];
  state.sealed = false;
  state.capabilities = {};
}

/**
 * Returns the first contribution for a slot, or undefined when no add-on
 * provides one or the capability behind it is disabled.
 */
export function extensionSlot<TSlot extends ExtensionSlot>(slot: TSlot): VifeeExtension[TSlot] | undefined {
  if (!state.capabilities[slotCapabilities[slot]]) return undefined;
  for (const extension of state.extensions) {
    const value = extension[slot];
    if (value !== undefined) return value;
  }
  return undefined;
}

export function registeredExtensionIds(): string[] {
  return state.extensions.map((extension) => extension.id);
}

declare global {
  interface Window {
    vifee?: { registerExtension(extension: VifeeExtension): void };
  }
}

/** Exposes the registration entry point add-on modules call. */
export function publishRegistry(): void {
  if (typeof window === 'undefined') return;
  window.vifee = { ...(window.vifee ?? {}), registerExtension };
}
