/**
 * Demo accounts are a local testing convenience. They are disabled by default
 * in production even if DEMO_MODE is accidentally left on, unless the deployer
 * explicitly opts in with ALLOW_DEMO_IN_PRODUCTION=true.
 */
export function isDemoModeEnabled(): boolean {
  if (process.env.DEMO_MODE !== 'true') return false;
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.ALLOW_DEMO_IN_PRODUCTION === 'true';
}
