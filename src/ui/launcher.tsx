import { Icon, type IconName } from './icons';

interface LauncherProps {
  label: string;
  count?: number;
  onClick(): void;
  icon?: IconName;
  symbol?: string;
  class?: string;
  hidden?: boolean;
}

export function Launcher({ label, count = 0, onClick, icon, symbol, class: className = '', hidden = false }: LauncherProps) {
  return (
    <button hidden={hidden} class={`vifee-launcher ${className}`.trim()} type="button" aria-label={label} title={label} onClick={onClick}>
      {symbol ? <span class="vifee-launcher__symbol" aria-hidden="true">{symbol}</span> : icon ? <Icon name={icon} size={20} class="vifee-launcher__icon" /> : null}
      {count > 0 && <span class="vifee-launcher__count">{count}</span>}
    </button>
  );
}
