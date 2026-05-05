/**
 * Integrations service — re-exports from the registry. Adapters
 * register themselves via side-effect import in registry.ts.
 */
export {
  dispatchOrder,
  getAdapter,
  registerAdapter,
} from "./registry";
export type {
  BundleOrderEvent,
  IntegrationAdapter,
  IntegrationCreds,
  IntegrationType,
  PingResult,
} from "./types";

// Kept for back-compat with the original prisma-stub signature.
export class IntegrationsService {}
