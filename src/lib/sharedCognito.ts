/**
 * Shared Cognito lock — Vector + PID
 * Do not let a sandbox/pipeline defineAuth() pool replace these IDs.
 */
import { Amplify } from 'aws-amplify';

export const SHARED_COGNITO = {
  region: 'us-west-2',
  userPoolId: 'us-west-2_1Kry5Hphg',
  userPoolClientId: '44nd3qek7cve9pnqm4coci398h',
  identityPoolId: 'us-west-2:ef39ef02-876b-4d0b-912c-582b9c21b56b',
} as const;

export function applySharedCognitoLock(outputs: Record<string, unknown>): Record<string, unknown> {
  const auth = {
    ...((outputs.auth as Record<string, unknown>) || {}),
    aws_region: SHARED_COGNITO.region,
    user_pool_id: SHARED_COGNITO.userPoolId,
    user_pool_client_id: SHARED_COGNITO.userPoolClientId,
    identity_pool_id: SHARED_COGNITO.identityPoolId,
    username_attributes: ['email'],
    standard_required_attributes: ['email'],
    user_verification_types: ['email'],
    mfa_configuration: 'NONE',
  };
  return { ...outputs, auth };
}

/** Amplify v6 runtime shape (Auth.Cognito) — required so email is the username. */
export function lockAmplifyAuthRuntime(): void {
  const current = Amplify.getConfig();
  const cognito = (current.Auth as { Cognito?: Record<string, unknown> } | undefined)?.Cognito || {};
  Amplify.configure({
    ...current,
    Auth: {
      ...current.Auth,
      Cognito: {
        ...cognito,
        userPoolId: SHARED_COGNITO.userPoolId,
        userPoolClientId: SHARED_COGNITO.userPoolClientId,
        identityPoolId: SHARED_COGNITO.identityPoolId,
        loginWith: { email: true },
      },
    },
  });
}
