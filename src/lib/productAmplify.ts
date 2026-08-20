/**
 * Shared Amplify Data client for Registry spine (+ reuse from main for MapLayout).
 */
let client: any = null;

export function configureProductAmplify(amplifyClient: any): void {
  client = amplifyClient;
  console.log('[productAmplify] Data client configured for Registry spine');
}

export function getProductClient(): any | null {
  return client;
}

export function hasProductClient(): boolean {
  return !!client;
}
