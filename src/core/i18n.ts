/**
 * Transport-agnostic translation layer for the widget.
 *
 * Every user-facing string in `src/` imports `__`/`_n`/`_x`/`sprintf` from
 * here (through the `@vifee/i18n` alias configured in `vite.config.ts` and
 * `tsconfig.json`). The functions are thin dispatchers over a pluggable
 * `Translator`, so the same UI code can run against different hosts:
 *
 * - the WordPress build installs a translator forwarding to the global
 *   `wp.i18n` (see `src/adapters/wordpress/wp-i18n.ts`);
 * - the cloud build will install its own catalogue-backed translator;
 * - with no translator installed (unit tests, SSR-less smoke checks) the
 *   default passthrough returns the original English string.
 *
 * Dispatch happens per call, not at install time, so a translator that reads
 * a lazily-loaded runtime stays correct.
 */

export interface Translator {
	__( text: string, domain?: string ): string;
	_n( single: string, plural: string, number: number, domain?: string ): string;
	_x( text: string, context: string, domain?: string ): string;
	sprintf( format: string, ...args: unknown[] ): string;
}

/** Text domain the widget's own strings are registered under. */
export const TEXT_DOMAIN = 'vifee-visual-feedback';

export function fallbackSprintf( format: string, ...args: unknown[] ): string {
	let index = 0;
	return format.replace( /%[sd]/g, () => String( args[ index++ ] ?? '' ) );
}

const passthrough: Translator = {
	__: ( text ) => text,
	_n: ( single, plural, number ) => ( 1 === number ? single : plural ),
	_x: ( text ) => text,
	sprintf: fallbackSprintf,
};

let translator: Translator = passthrough;

/** Installs the host's translator. Pass `null` to fall back to passthrough. */
export function setTranslator( next: Translator | null ): void {
	translator = next ?? passthrough;
}

export function __( text: string, domain?: string ): string {
	return translator.__( text, domain );
}

export function _n( single: string, plural: string, number: number, domain?: string ): string {
	return translator._n( single, plural, number, domain );
}

export function _x( text: string, context: string, domain?: string ): string {
	return translator._x( text, context, domain );
}

export function sprintf( format: string, ...args: unknown[] ): string {
	return translator.sprintf( format, ...args );
}
