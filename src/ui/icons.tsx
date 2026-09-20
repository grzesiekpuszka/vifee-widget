import type { JSX } from 'preact';

export type IconName =
	| 'camera'
	| 'crop'
	| 'paperclip'
	| 'trash'
	| 'undo'
	| 'redo'
	| 'arrow-up-right'
	| 'square'
	| 'circle'
	| 'type'
	| 'blur-rect'
	| 'blur-ellipse'
	| 'bold'
	| 'italic'
	| 'code'
	| 'link'
	| 'list'
	| 'list-ordered'
	| 'calendar'
	| 'message-circle'
	| 'eye'
	| 'eye-off'
	| 'maximize-2'
	| 'send'
	| 'crosshair'
	| 'chevron-down'
	| 'chevron-up'
	| 'check'
	| 'x'
	| 'menu'
	| 'ellipsis';

// @license Lucide contributors (lucide-static v1.34.0) - ISC
// Shapes below are copied verbatim; `blur-rect`/`blur-ellipse` are
// custom compositions.
const glyphs: Record<IconName, JSX.Element> = {
	camera: (
		<>
			<path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" />
			<circle cx="12" cy="13" r="3" />
		</>
	),
	crop: (
		<>
			<path d="M6 2v14a2 2 0 0 0 2 2h14" />
			<path d="M18 22V8a2 2 0 0 0-2-2H2" />
		</>
	),
	paperclip: <path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551" />,
	trash: (
		<>
			<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
			<path d="M3 6h18" />
			<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
		</>
	),
	undo: (
		<>
			<path d="M3 7v6h6" />
			<path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
		</>
	),
	redo: (
		<>
			<path d="M21 7v6h-6" />
			<path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
		</>
	),
	'arrow-up-right': (
		<>
			<path d="M7 7h10v10" />
			<path d="M7 17 17 7" />
		</>
	),
	square: <rect width="18" height="18" x="3" y="3" rx="2" />,
	circle: <circle cx="12" cy="12" r="10" />,
	type: (
		<>
			<path d="M12 4v16" />
			<path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" />
			<path d="M9 20h6" />
		</>
	),
	'blur-rect': (
		<>
			<rect x="4" y="6" width="7" height="6" />
			<rect x="13" y="12" width="7" height="6" />
			<rect x="8" y="9" width="8" height="6" opacity=".45" />
		</>
	),
	'blur-ellipse': (
		<>
			<circle cx="12" cy="12" r="8" />
			<circle cx="12" cy="12" r="3" opacity=".45" />
		</>
	),
	bold: <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />,
	italic: (
		<>
			<line x1="19" x2="10" y1="4" y2="4" />
			<line x1="14" x2="5" y1="20" y2="20" />
			<line x1="15" x2="9" y1="4" y2="20" />
		</>
	),
	code: (
		<>
			<path d="m16 18 6-6-6-6" />
			<path d="m8 6-6 6 6 6" />
		</>
	),
	link: (
		<>
			<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
			<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
		</>
	),
	list: (
		<>
			<path d="M3 5h.01" />
			<path d="M3 12h.01" />
			<path d="M3 19h.01" />
			<path d="M8 5h13" />
			<path d="M8 12h13" />
			<path d="M8 19h13" />
		</>
	),
	'list-ordered': (
		<>
			<path d="M11 5h10" />
			<path d="M11 12h10" />
			<path d="M11 19h10" />
			<path d="M4 4h1v5" />
			<path d="M4 9h2" />
			<path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02" />
		</>
	),
	calendar: (
		<>
			<path d="M8 2v3" />
			<path d="M16 2v3" />
			<rect x="3" y="3" width="18" height="18" rx="2" />
			<path d="M3 9h18" />
		</>
	),
	'message-circle': <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />,
	eye: (
		<>
			<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
			<circle cx="12" cy="12" r="3" />
		</>
	),
	'eye-off': (
		<>
			<path d="m2 2 20 20" />
			<path d="M6.71 6.71C4.69 8.1 3.16 10 2.06 11.65a1 1 0 0 0 0 .7C4.22 15.59 7.54 19 12 19c1.3 0 2.49-.29 3.57-.78" />
			<path d="M10.73 5.08A8.9 8.9 0 0 1 12 5c4.46 0 7.78 3.41 9.94 6.65a1 1 0 0 1 0 .7 15.4 15.4 0 0 1-2.23 2.73" />
			<path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
		</>
	),
	'maximize-2': (
		<>
			<path d="M15 3h6v6" />
			<path d="m21 3-7 7" />
			<path d="m3 21 7-7" />
			<path d="M9 21H3v-6" />
		</>
	),
	send: (
		<>
			<path d="m22 2-7 20-4-9-9-4Z" />
			<path d="M22 2 11 13" />
		</>
	),
	crosshair: (
		<>
			<circle cx="12" cy="12" r="8" />
			<path d="M12 2v4" />
			<path d="M12 18v4" />
			<path d="M2 12h4" />
			<path d="M18 12h4" />
		</>
	),
	'chevron-down': <path d="m6 9 6 6 6-6" />,
	'chevron-up': <path d="m18 15-6-6-6 6" />,
	check: <path d="M20 6 9 17l-5-5" />,
	x: (
		<>
			<path d="M18 6 6 18" />
			<path d="m6 6 12 12" />
		</>
	),
	menu: (
		<>
			<path d="M4 5h16" />
			<path d="M4 12h16" />
			<path d="M4 19h16" />
		</>
	),
	ellipsis: (
		<>
			<path d="M12 12h.01" />
			<path d="M19 12h.01" />
			<path d="M5 12h.01" />
		</>
	),
};

export function Icon({ name, size = 16, class: className }: { name: IconName; size?: number; class?: string }): JSX.Element {
	return (
		<svg
			viewBox="0 0 24 24"
			width={size}
			height={size}
			fill="none"
			stroke="currentColor"
			stroke-width={2}
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
			class={className}
		>
			{glyphs[name]}
		</svg>
	);
}
