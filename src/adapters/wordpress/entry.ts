/**
 * Build entry point for the WordPress plugin bundle (`vifee-widget.js`).
 *
 * `FrontendLoader::print_runtime()` prints a `<script type="application/json"
 * id="vifee-runtime-config">` tag carrying the REST base plus either a nonce
 * (logged-in managers), a CSRF token (activated guest reviewers) or an
 * activation token (guest opening a review link). This module reads that tag,
 * builds a `WordPressGateway` from it and mounts the widget — everything that
 * ties the host-agnostic core in `src/` to WordPress lives here or in its
 * sibling modules.
 */
import { mountVifee } from '../../mount';
import { installWordPressI18n } from './wp-i18n';
import { WordPressGateway, type WordPressGatewayOptions } from './wordpress-gateway';

export { mountVifee, WordPressGateway };
export type { WordPressGatewayOptions };

installWordPressI18n();

interface BrowserRuntime extends WordPressGatewayOptions {
	activationToken?: string;
}

function readBrowserRuntime(): BrowserRuntime | null {
	const node = document.getElementById( 'vifee-runtime-config' );
	if ( ! node?.textContent ) return null;
	try {
		return JSON.parse( node.textContent ) as BrowserRuntime;
	} catch {
		return null;
	}
}

const browserRuntime = 'undefined' !== typeof document ? readBrowserRuntime() : null;
if ( browserRuntime ) {
	const { activationToken, ...gatewayOptions } = browserRuntime;
	const gateway = new WordPressGateway( gatewayOptions );
	void mountVifee( {
		gateway,
		activationToken,
		onActivated: ( result ) =>
			new WordPressGateway( { ...gatewayOptions, csrfToken: result.csrfToken } ),
	} ).catch( ( reason ) => {
		// Never rethrown: a widget that fails to mount must not surface as an
		// unhandled rejection in the host site's console, and there is nothing
		// left to retry. It is logged, though — swallowing this silently made
		// every mount failure present identically as "the widget isn't there",
		// with nothing to go on from the reviewer's browser.
		// eslint-disable-next-line no-console
		console.warn( '[vifee] The feedback widget could not start.', reason );
	} );
}
