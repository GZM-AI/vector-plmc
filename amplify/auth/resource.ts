import { defineAuth } from '@aws-amplify/backend';

/**
 * Vector / shared team auth — email login.
 * Authenticator forces sign-in (ITAR-adjacent documents).
 * After pool deletion: sandbox recreates a new User Pool.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
});