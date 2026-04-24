import { StackClientApp } from '@stackframe/stack';

const projectId = process.env.REACT_APP_STACK_PROJECT_ID;
const publishableClientKey = process.env.REACT_APP_STACK_PUBLISHABLE_KEY;

export const isStackConfigured = Boolean(projectId && publishableClientKey);

let stackAppInstance = null;

if (isStackConfigured) {
  stackAppInstance = new StackClientApp({
    projectId,
    publishableClientKey,
    tokenStore: 'cookie',
    urls: {
      signIn: '/login',
      signUp: '/register',
      afterSignIn: '/dashboard',
      afterSignUp: '/dashboard',
      afterSignOut: '/',
    },
  });
} else if (process.env.NODE_ENV !== 'production') {
  // Avoid a hard crash/white-screen when local auth env vars are missing.
  console.warn(
    '[SyncCodes] Stack auth is not configured. Set REACT_APP_STACK_PROJECT_ID and REACT_APP_STACK_PUBLISHABLE_KEY.'
  );
}

export const stackApp = stackAppInstance;
