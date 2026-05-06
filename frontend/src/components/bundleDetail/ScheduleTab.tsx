/**
 * Bundle Detail · Schedule tab (M-170).
 *
 * Three cards: Window (start/end + timezone), Recurrence
 * (daily/weekly/monthly), End behavior (archive vs pause). Each
 * card persists independently via the page-level onSave handler so
 * a Save on one doesn't disturb in-flight edits on another.
 *
 * Storefront wiring already honors startsAt/endsAt
 * (validateCart.ts). The recurringRule + endBehavior fields persist
 * today; the cron worker that reads endBehavior at endsAt-passes
 * lands in M-170b.
 */
import { useState } from "react";
import {
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  ChoiceList,
  InlineStack,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";

export type RecurringRuleType = "daily" | "weekly" | "monthly";
export type ScheduleEndBehavior = "archive" | "pause";

export interface RecurringRule {
  type: RecurringRuleType | null;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  startTime?: string;
  endTime?: string;
}

export interface ScheduleSettings {
  timezone?: string;
  recurringRule?: RecurringRule | null;
  endBehavior?: ScheduleEndBehavior;
}

export interface ScheduleTabProps {
  startsAt: string | null;
  endsAt: string | null;
  scheduleSettings: ScheduleSettings;
  /** Defaults to the shop timezone; optional override in the UI. */
  shopTimezone: string;
  busy: boolean;
  onSave: (
    patch: {
      startsAt?: string | null;
      endsAt?: string | null;
      scheduleSettings?: ScheduleSettings;
    },
  ) => Promise<void>;
}

/**
 * Common timezone options. Mirrors the M-161 General-tab list.
 */
const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Honolulu",
  "America/Toronto",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
];

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const RECURRENCE_OPTIONS = [
  { label: "None — fires once over the window", value: "none" },
  { label: "Daily — every day in the window", value: "daily" },
  { label: "Weekly — pick days", value: "weekly" },
  { label: "Monthly — pick a day of month", value: "monthly" },
] as const;

const END_BEHAVIOR_OPTIONS = [
  {
    label: "Archive at end (clean off the storefront, can reopen later)",
    value: "archive",
  },
  {
    label: "Pause at end (move to draft, schedule stays editable)",
    value: "pause",
  },
];

/** ISO datetime → "YYYY-MM-DD" + "HH:MM" pair, in the local browser zone. */
function splitIso(
  iso: string | null,
): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const pad = (n: number): string => String(n).padStart(2, "0");
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

function joinIso(date: string, time: string): string | null {
  if (!date) return null;
  const safeTime = time && /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  return `${date}T${safeTime}:00.000Z`;
}

interface WindowCardProps {
  startsAt: string | null;
  endsAt: string | null;
  timezone: string;
  shopTimezone: string;
  busy: boolean;
  onSave: ScheduleTabProps["onSave"];
}

function WindowCard({
  startsAt,
  endsAt,
  timezone,
  shopTimezone,
  busy,
  onSave,
}: WindowCardProps): JSX.Element {
  const startSplit = splitIso(startsAt);
  const endSplit = splitIso(endsAt);
  const [startDate, setStartDate] = useState(startSplit.date);
  const [startTime, setStartTime] = useState(startSplit.time);
  const [endDate, setEndDate] = useState(endSplit.date);
  const [endTime, setEndTime] = useState(endSplit.time);
  const [tz, setTz] = useState<string>(timezone || shopTimezone);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    startDate !== startSplit.date ||
    startTime !== startSplit.time ||
    endDate !== endSplit.date ||
    endTime !== endSplit.time ||
    tz !== (timezone || shopTimezone);

  // Cross-field check: if both sides set, end ≥ start.
  const startMs = startDate ? new Date(joinIso(startDate, startTime) ?? "").getTime() : null;
  const endMs = endDate ? new Date(joinIso(endDate, endTime) ?? "").getTime() : null;
  const rangeInvalid =
    startMs !== null && endMs !== null && endMs < startMs;

  async function save(): Promise<void> {
    if (rangeInvalid) {
      setError("End must be on/after the start.");
      return;
    }
    setError(null);
    await onSave({
      startsAt: startDate ? joinIso(startDate, startTime) : null,
      endsAt: endDate ? joinIso(endDate, endTime) : null,
      scheduleSettings: { timezone: tz },
    });
  }

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Window
        </Text>
        <Text as="p" tone="subdued">
          When the bundle is visible to customers. Empty values mean
          "no bound" — leave start blank to make it always-on, or end
          blank to keep it open-ended.
        </Text>
        {error && (
          <Banner tone="critical" title="Couldn't save">
            {error}
          </Banner>
        )}
        <InlineStack gap="400" wrap>
          <Box minWidth="200px">
            <TextField
              label="Start date"
              type="date"
              value={startDate}
              onChange={setStartDate}
              autoComplete="off"
            />
          </Box>
          <Box minWidth="160px">
            <TextField
              label="Start time"
              type="time"
              value={startTime}
              onChange={setStartTime}
              autoComplete="off"
              helpText="HH:MM in 24h"
            />
          </Box>
        </InlineStack>
        <InlineStack gap="400" wrap>
          <Box minWidth="200px">
            <TextField
              label="End date"
              type="date"
              value={endDate}
              onChange={setEndDate}
              autoComplete="off"
            />
          </Box>
          <Box minWidth="160px">
            <TextField
              label="End time"
              type="time"
              value={endTime}
              onChange={setEndTime}
              autoComplete="off"
            />
          </Box>
        </InlineStack>
        <Select
          label="Timezone"
          options={TIMEZONES.map((t) => ({ label: t, value: t }))}
          value={tz}
          onChange={setTz}
          helpText={`Shop default: ${shopTimezone}`}
        />
        <InlineStack align="end">
          <Button
            variant="primary"
            onClick={save}
            loading={busy}
            disabled={busy || !dirty || rangeInvalid}
          >
            Save window
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

interface RecurrenceCardProps {
  rule: RecurringRule | null | undefined;
  busy: boolean;
  onSave: ScheduleTabProps["onSave"];
}

function RecurrenceCard({ rule, busy, onSave }: RecurrenceCardProps): JSX.Element {
  const initialType: RecurringRuleType | "none" = rule?.type ?? "none";
  const [type, setType] = useState<RecurringRuleType | "none">(initialType);
  const [days, setDays] = useState<string[]>(
    (rule?.daysOfWeek ?? []).map(String),
  );
  const [dom, setDom] = useState<string>(
    rule?.dayOfMonth !== undefined ? String(rule.dayOfMonth) : "",
  );
  const [startTime, setStartTime] = useState<string>(rule?.startTime ?? "");
  const [endTime, setEndTime] = useState<string>(rule?.endTime ?? "");

  const initialDaysJson = JSON.stringify((rule?.daysOfWeek ?? []).map(String));
  const dirty =
    type !== initialType ||
    JSON.stringify(days) !== initialDaysJson ||
    dom !== (rule?.dayOfMonth !== undefined ? String(rule.dayOfMonth) : "") ||
    startTime !== (rule?.startTime ?? "") ||
    endTime !== (rule?.endTime ?? "");

  async function save(): Promise<void> {
    if (type === "none") {
      await onSave({
        scheduleSettings: { recurringRule: null },
      });
      return;
    }
    const next: RecurringRule = { type };
    if (type === "weekly") {
      next.daysOfWeek = days
        .map((d) => Number.parseInt(d, 10))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    }
    if (type === "monthly") {
      const n = Number.parseInt(dom, 10);
      if (Number.isInteger(n) && n >= 1 && n <= 31) {
        next.dayOfMonth = n;
      }
    }
    if (startTime) next.startTime = startTime;
    if (endTime) next.endTime = endTime;
    await onSave({ scheduleSettings: { recurringRule: next } });
  }

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Recurrence
        </Text>
        <Text as="p" tone="subdued">
          For repeating sales (e.g. weekend-only specials, monthly
          drops). Leave at None to use the window as a single
          continuous period.
        </Text>
        <Select
          label="Pattern"
          options={
            RECURRENCE_OPTIONS as unknown as { label: string; value: string }[]
          }
          value={type}
          onChange={(v) => setType(v as RecurringRuleType | "none")}
        />
        {type === "weekly" && (
          <ChoiceList
            title="Days of week"
            allowMultiple
            choices={DAY_LABELS.map((label, i) => ({
              label,
              value: String(i),
            }))}
            selected={days}
            onChange={(next) => setDays(next)}
          />
        )}
        {type === "monthly" && (
          <Box minWidth="160px">
            <TextField
              label="Day of month"
              type="number"
              min={1}
              max={31}
              value={dom}
              onChange={setDom}
              autoComplete="off"
              helpText="Months without that day are skipped (e.g. Feb 30)"
            />
          </Box>
        )}
        {type !== "none" && (
          <InlineStack gap="400" wrap>
            <Box minWidth="160px">
              <TextField
                label="Daily start time"
                type="time"
                value={startTime}
                onChange={setStartTime}
                autoComplete="off"
              />
            </Box>
            <Box minWidth="160px">
              <TextField
                label="Daily end time"
                type="time"
                value={endTime}
                onChange={setEndTime}
                autoComplete="off"
              />
            </Box>
          </InlineStack>
        )}
        <InlineStack align="end">
          <Button
            variant="primary"
            onClick={save}
            loading={busy}
            disabled={busy || !dirty}
          >
            Save recurrence
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

interface EndBehaviorCardProps {
  endBehavior: ScheduleEndBehavior | undefined;
  busy: boolean;
  onSave: ScheduleTabProps["onSave"];
}

function EndBehaviorCard({
  endBehavior,
  busy,
  onSave,
}: EndBehaviorCardProps): JSX.Element {
  const [choice, setChoice] = useState<ScheduleEndBehavior>(
    endBehavior ?? "archive",
  );
  const dirty = choice !== (endBehavior ?? "archive");
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          End behavior
        </Text>
        <Text as="p" tone="subdued">
          What happens at the end of the window. The cron worker
          that runs this lands in M-170b — until then this setting
          persists but doesn&apos;t fire.
        </Text>
        <ChoiceList
          title="When the window ends"
          titleHidden
          allowMultiple={false}
          choices={END_BEHAVIOR_OPTIONS}
          selected={[choice]}
          onChange={(next) =>
            setChoice((next[0] ?? "archive") as ScheduleEndBehavior)
          }
        />
        <InlineStack align="end">
          <Button
            variant="primary"
            onClick={() =>
              onSave({ scheduleSettings: { endBehavior: choice } })
            }
            loading={busy}
            disabled={busy || !dirty}
          >
            Save end behavior
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

export function ScheduleTab(props: ScheduleTabProps): JSX.Element {
  const { startsAt, endsAt, scheduleSettings, shopTimezone, busy, onSave } =
    props;
  return (
    <BlockStack gap="400">
      <WindowCard
        startsAt={startsAt}
        endsAt={endsAt}
        timezone={scheduleSettings.timezone ?? shopTimezone}
        shopTimezone={shopTimezone}
        busy={busy}
        onSave={onSave}
      />
      <RecurrenceCard
        rule={scheduleSettings.recurringRule}
        busy={busy}
        onSave={onSave}
      />
      <EndBehaviorCard
        endBehavior={scheduleSettings.endBehavior}
        busy={busy}
        onSave={onSave}
      />
    </BlockStack>
  );
}
