/**
 * Analytics service — thin wrapper over the repository (M-110+).
 * Most routes call the repo directly; the class is kept as a single
 * import point for future computed metrics.
 */
import { analyticsRepo, type IngestEvent } from "./repository";

export class AnalyticsService {
  ingest = (shopId: string, events: IngestEvent[]) =>
    analyticsRepo.ingest(shopId, events);
  overview = (shopId: string) => analyticsRepo.overview(shopId);
  byBundle = (shopId: string, bundleId: string) =>
    analyticsRepo.byBundle(shopId, bundleId);
}

export { analyticsRepo };
export type { IngestEvent };
