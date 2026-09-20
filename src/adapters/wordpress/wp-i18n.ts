/**
 * WordPress translator for the widget's `@vifee/i18n` layer.
 *
 * The full `@wordpress/i18n` package (Tannin + memoization + domain registry)
 * added ~5-6 KB gzip to the widget's initial bundle. WordPress core already
 * loads the real implementation as the global `wp.i18n` (registered via the
 * `wp-i18n` script handle, which `FrontendLoader::enqueue()` enqueues
 * alongside the widget module), so this adapter forwards to that global
 * instead of bundling a second copy.
 *
 * Lookups happen per call, so the widget still renders correctly if the
 * module executes before `wp.i18n` is on the page — it just falls back to the
 * untranslated string for those calls.
 */
import { fallbackSprintf, setTranslator, type Translator } from '../../core/i18n';

type WpI18n = Translator;

declare global {
	interface Window {
		wp?: { i18n?: WpI18n };
	}
}

function runtime(): WpI18n | undefined {
	return 'undefined' !== typeof window ? window.wp?.i18n : undefined;
}

export const wordPressTranslator: Translator = {
	__: ( text, domain ) => runtime()?.__( text, domain ) ?? text,
	_n: ( single, plural, number, domain ) => {
		const wp = runtime();
		if ( wp ) {
			return wp._n( single, plural, number, domain );
		}
		return 1 === number ? single : plural;
	},
	_x: ( text, context, domain ) => runtime()?._x( text, context, domain ) ?? text,
	sprintf: ( format, ...args ) => {
		const wp = runtime();
		return wp ? wp.sprintf( format, ...args ) : fallbackSprintf( format, ...args );
	},
};

/** Routes the widget's `__()`/`sprintf()` calls through WordPress's `wp.i18n`. */
export function installWordPressI18n(): void {
	setTranslator( wordPressTranslator );
}
