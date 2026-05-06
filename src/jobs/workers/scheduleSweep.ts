/**
 * Schedule sweep worker (M-170b).
 *
 * Periodic sweep that flips a bundle's status when its
 * `endsAt` passes. End behavior comes from
 * `scheduleSettings.endBehavior`:
 *   - "archive" (default) → status "archived".
 *   - "pause"             → status "draft".
 *
 * The pure `processExpiredBundles` function is the
 * unit-testable seam. `startScheduleSweep()` wires it to a
 * 5-minute setInterval — single worker, no cross-process
 * coordination needed.
 */
import { logger } from "../../config/logger";
import { prisma } from "../../config/database";
import { bundleActivityRepo } from "../../services/bundles/activityRepo";

const log = logger.child({ module: "schedule-sweep" });

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

interface ExpiredBundleRow {
  id: string;
  shopId: string;
  status: string;
  endsAt: Date | null;
  scheduleSettings: unknown;
}

export interface ScheduleSweepDeps {
  client?: {
    bundle: {
      findMany(args: {
        where: {
          status: "active";
          endsAt: { not: null; lt: Date };
        };
        select: {
          id: true;
          shopId: true;
          status: true;
          endsAt: true;
          scheduleSettings: true;
        };
      }): Promise<ExpiredBundleRow[]>;
      update(args: {
        where: { id: string };
        data: { status: string };
      }): Promise<unknown>;
    };
  };
  appendActivity?: typeof bundleActivityRepo.append;
}

export interface SweepResult {
  archived: number;
  paused: number;
  errors: number;
}

function readEndBehavior(scheduleSettings: unknown): "archive" | "pause" {
  if (
    scheduleSettings &&
    typeof scheduleSettings === "object" &&
    !Array.isArray(scheduleSettings)
  ) {
    const v = (scheduleSettings as Record<string, unknown>).endBehavior;
    if (v === "pause") return "pause";
  }
  return "archive";
}

export async function processExpiredBundles(
  now: Date,
  deps: ScheduleSweepDeps = {},
): Promise<SweepResult> {
  const client =
    deps.client ?? (prisma as unknown as Required<ScheduleSweepDeps>["client"]);
  const appendActivity = deps.appendActivity ?? bundleActivityRepo.append;

  const out: SweepResult = { archived: 0, paused: 0, errors: 0 };

  let rows: ExpiredBundleRow[];
  try {
    rows = await client.bundle.findMany({
      where: {
        status: "active",
        endsAt: { not: null, lt: now },
      },
      select: {
        id: true,
        shopId: true,
        status: true,
        endsAt: true,
        scheduleSettings: true,
      },
    });
  } catch (err) {
    log.warn({ err }, "schedule sweep findMany failed");
    return out;
  }

  for (const row of rows) {
    const behavior = readEndBehavior(row.scheduleSettings);
    try {
      if (behavior === "pause") {
        await client.bundle.update({
          where: { id: row.id },
          data: { status: "draft" },
        });
        await appendActivity({
          shopId: row.shopId,
          bundleId: row.id,
          action: "auto_paused",
          summary: "Schedule reached endsAt; bundle moved to draft",
          metadata: { endsAt: row.endsAt?.toISOString() ?? null },
        });
        out.paused += 1;
      } else {
        await client.bundle.update({
          where: { id: row.id },
          data: { status: "archived" },
        });
        await appendActivity({
          shopId: row.shopId,
          bundleId: row.id,
          action: "auto_archived",
          summary: "Schedule reached endsAt; bundle archived",
          metadata: { endsAt: row.endsAt?.toISOString() ?? null },
        });
        out.archived += 1;
      }
    } catch (err) {
      log.warn(
        { err, bundleId: row.id, behavior },
        "schedule sweep failed for bundle",
      );
      out.errors += 1;
    }
  }
  return out;
}

export function startScheduleSweep(): { stop: () => void } {
  const tick = async (): Promise<void> => {
    try {
      const result = await processExpiredBundles(new Date());
      if (result.archived + result.paused + result.errors > 0) {
        log.info(result, "schedule sweep tick");
      }
    } catch (err) {
      log.warn({ err }, "schedule sweep tick threw");
    }
  };
  const handle = setInterval(() => {
    void tick();
  }, SWEEP_INTERVAL_MS);
  // Run once on boot so a freshly deployed worker doesn't
  // wait 5 minutes before its first sweep.
  void tick();
  return {
    stop: () => clearInterval(handle),
  };
}
