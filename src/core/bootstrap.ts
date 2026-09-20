import type { FeedbackGateway } from './gateway';
import type { Bootstrap } from './types';

export async function loadBootstrap(gateway: FeedbackGateway): Promise<Bootstrap | null> {
  try {
    return await gateway.bootstrap();
  } catch (error) {
    if (error instanceof Error && error.name === 'GatewayError' && 'kind' in error && error.kind === 'auth') {
      return null;
    }
    throw error;
  }
}
