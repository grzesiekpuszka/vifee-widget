import { __ } from '@vifee/i18n';
import { capturedErrors } from './error-collector';
import type { TechnicalMetadata } from './types';

export interface TechnicalEnvironment {
  userAgent: string;
  platform: string;
  userAgentDataPlatform?: string;
  viewportWidth: number;
  viewportHeight: number;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
}

export function collectTechnicalMetadata(
  environment: TechnicalEnvironment = browserEnvironment(),
): TechnicalMetadata {
  const ratio =
    Number.isFinite(environment.devicePixelRatio) && environment.devicePixelRatio > 0
      ? environment.devicePixelRatio
      : 1;

  return {
    browser: detectBrowser(environment.userAgent),
    os: detectOs(environment.userAgentDataPlatform, environment.platform, environment.userAgent),
    viewport: `${Math.round(environment.viewportWidth)}x${Math.round(environment.viewportHeight)}`,
    screen: `${Math.round(environment.screenWidth * ratio)}x${Math.round(environment.screenHeight * ratio)}`,
    scale: `${Number((ratio * 100).toFixed(1))}%`,
    errors: capturedErrors(),
  };
}

function browserEnvironment(): TechnicalEnvironment {
  const extended = navigator as Navigator & { userAgentData?: { platform?: string } };

  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform ?? '',
    userAgentDataPlatform: extended.userAgentData?.platform,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio,
  };
}

/** First match wins, so Edge and Opera are tested before Chrome (their UA strings contain it). */
function detectBrowser(userAgent: string): string {
  const definitions: Array<[RegExp, string]> = [
    [/Edg\/(\d+(?:\.\d+)?)/, 'Edge'],
    [/OPR\/(\d+(?:\.\d+)?)/, 'Opera'],
    [/Firefox\/(\d+(?:\.\d+)?)/, 'Firefox'],
    [/Chrome\/(\d+(?:\.\d+)?)/, 'Chrome'],
    [/Version\/(\d+(?:\.\d+)?).*Safari\//, 'Safari'],
  ];

  for (const [pattern, name] of definitions) {
    const match = userAgent.match(pattern);
    if (match) return `${name} ${match[1]}`;
  }

  return __('Unknown', 'vifee-visual-feedback');
}

/**
 * `navigator.userAgentData.platform` is the modern, unfrozen hint and wins when
 * present. `navigator.platform` is checked next but never trusted for 'Linux':
 * Chrome on Android reports 'Linux armv8l' there, so the UA sniff below has to
 * settle Android vs. desktop Linux.
 */
function detectOs(userAgentDataPlatform: string | undefined, platform: string, userAgent: string): string {
  const hinted = platformName(userAgentDataPlatform ?? '');
  if (hinted) return hinted;

  const legacy = platformName(platform);
  if (legacy && legacy !== 'Linux') return legacy;

  if (/Windows NT/i.test(userAgent)) return 'Windows';
  if (/Android/i.test(userAgent)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
  if (/Mac OS X/i.test(userAgent)) return 'macOS';
  if (/Linux/i.test(userAgent)) return 'Linux';

  return legacy ?? __('Unknown', 'vifee-visual-feedback');
}

function platformName(value: string): string | null {
  if (/Windows|Win32|Win64/i.test(value)) return 'Windows';
  if (/macOS|MacIntel|MacPPC/i.test(value)) return 'macOS';
  if (/Android/i.test(value)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(value)) return 'iOS';
  if (/Linux/i.test(value)) return 'Linux';
  return null;
}
