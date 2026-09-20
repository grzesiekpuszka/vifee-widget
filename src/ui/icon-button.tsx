import type { JSX } from 'preact';
import { Icon, type IconName } from './icons';

interface IconButtonProps extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'title'> {
  label: string;
  icon: IconName;
}

export function IconButton({ label, icon, class: className = '', ...props }: IconButtonProps) {
  return <button {...props} type={props.type ?? 'button'} class={`vifee-icon-button ${className}`.trim()} aria-label={label} title={label}>
    <Icon name={icon} />
  </button>;
}
