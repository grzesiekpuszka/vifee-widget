import { __ } from '@vifee/i18n';
import type { Feedback } from '../../core/types';
import { Pin } from './pin';

interface PinLayerProps {
  feedback: Feedback[];
  openUuid: string | null;
  onOpen(uuid: string): void;
}

export function PinLayer({ feedback, openUuid, onOpen }: PinLayerProps) {
  return (
    <div class="vifee-pin-layer" aria-label={__( 'Comments on the page', 'vifee-visual-feedback' )}>
      {feedback.map((item) => (
        <Pin
          key={item.uuid}
          feedback={item}
          active={openUuid === item.uuid}
          onOpen={() => onOpen(item.uuid)}
        />
      ))}
    </div>
  );
}
