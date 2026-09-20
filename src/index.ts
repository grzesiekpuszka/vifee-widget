/**
 * Public API of the host-agnostic widget core.
 *
 * A host adapter (see `src/adapters/`) supplies a `FeedbackGateway`
 * implementation and, optionally, a `Translator`, then calls `mountVifee()`.
 * Nothing exported from here knows about WordPress, REST nonces or any other
 * backend detail.
 */
export { mountVifee, type RuntimeConfig, type WidgetHandle } from './mount';
export {
	GatewayError,
	type AttachmentSource,
	type FeedbackGateway,
	type GatewayErrorKind,
} from './core/gateway';
export { setTranslator, TEXT_DOMAIN, type Translator } from './core/i18n';
export { getPageIdentity } from './core/page-identity';
export type * from './core/types';
