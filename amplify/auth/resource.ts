import { defineAuth } from '@aws-amplify/backend';

/**
 * Minimal auth so Data can use userPool / identity.
 * Vector UI can stay on auth bypass until you wire Authenticator.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
});