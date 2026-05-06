/**
 * Bundle Detail · Customers tab (M-172).
 *
 * Per-bundle eligibility surface. Three cards:
 *  - Tag-based: customerTagsAllow + customerTagsDeny chips.
 *  - Login & Segments: requireLogin checkbox + segmentIds textarea.
 *  - Market & locale: ChoiceList allowMultiple of countries + locales.
 *
 * Each card has its own per-card Save that fires
 * `onSave({ eligibility: { ... } })`. The page-level handler
 * forwards to PUT /api/v1/bundles/:id where the server's
 * deep-merge keeps siblings intact and `null` removes a
 * dimension's restriction.
 */
import { useState } from "react";
import {
  BlockStack,
  Banner,
  Box,
  Button,
  Card,
  Checkbox,
  ChoiceList,
  InlineStack,
  Tag,
  Text,
  TextField,
} from "@shopify/polaris";

export interface Eligibility {
  customerTagsAllow?: string[];
  customerTagsDeny?: string[];
  segmentIds?: string[];
  requireLogin?: boolean;
  markets?: string[];
  locales?: string[];
}

export interface CustomersTabProps {
  eligibility: Eligibility;
  busy: boolean;
  onSave: (
    patch: { eligibility: Record<string, unknown> },
  ) => Promise<void>;
}

const COMMON_MARKETS: { label: string; value: string }[] = [
  { label: "United States (US)", value: "US" },
  { label: "Canada (CA)", value: "CA" },
  { label: "United Kingdom (GB)", value: "GB" },
  { label: "Ireland (IE)", value: "IE" },
  { label: "Australia (AU)", value: "AU" },
  { label: "New Zealand (NZ)", value: "NZ" },
  { label: "Germany (DE)", value: "DE" },
  { label: "France (FR)", value: "FR" },
  { label: "Spain (ES)", value: "ES" },
  { label: "Italy (IT)", value: "IT" },
  { label: "Portugal (PT)", value: "PT" },
  { label: "Netherlands (NL)", value: "NL" },
  { label: "Belgium (BE)", value: "BE" },
  { label: "Sweden (SE)", value: "SE" },
  { label: "Norway (NO)", value: "NO" },
  { label: "Denmark (DK)", value: "DK" },
  { label: "Finland (FI)", value: "FI" },
  { label: "Poland (PL)", value: "PL" },
  { label: "Czechia (CZ)", value: "CZ" },
  { label: "Hungary (HU)", value: "HU" },
  { label: "Mexico (MX)", value: "MX" },
  { label: "Brazil (BR)", value: "BR" },
  { label: "Argentina (AR)", value: "AR" },
  { label: "Japan (JP)", value: "JP" },
  { label: "South Korea (KR)", value: "KR" },
  { label: "Singapore (SG)", value: "SG" },
  { label: "Hong Kong (HK)", value: "HK" },
  { label: "United Arab Emirates (AE)", value: "AE" },
  { label: "South Africa (ZA)", value: "ZA" },
  { label: "India (IN)", value: "IN" },
];

const SUPPORTED_LOCALE_LIST = [
  "en", "es", "fr", "de", "it", "pt",
  "ja", "zh", "ko", "nl", "pl", "sv",
  "da", "no", "ru",
];

// ---------------- Tag-based eligibility ----------------

interface TagsCardProps {
  initialAllow: string[];
  initialDeny: string[];
  busy: boolean;
  onSave: CustomersTabProps["onSave"];
}

function TagsCard({
  initialAllow,
  initialDeny,
  busy,
  onSave,
}: TagsCardProps): JSX.Element {
  const [allow, setAllow] = useState<string[]>(initialAllow);
  const [deny, setDeny] = useState<string[]>(initialDeny);
  const [pendingAllow, setPendingAllow] = useState("");
  const [pendingDeny, setPendingDeny] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add(side: "allow" | "deny"): void {
    const raw = side === "allow" ? pendingAllow : pendingDeny;
    const tag = raw.trim();
    if (tag.length === 0) return;
    const target = side === "allow" ? allow : deny;
    if (target.includes(tag)) {
      side === "allow" ? setPendingAllow("") : setPendingDeny("");
      return;
    }
    if (target.length >= 50) {
      setError(`Max 50 ${side} tags.`);
      return;
    }
    if (side === "allow") {
      setAllow([...allow, tag]);
      setPendingAllow("");
    } else {
      setDeny([...deny, tag]);
      setPendingDeny("");
    }
    setError(null);
  }

  const dirty =
    JSON.stringify(allow) !== JSON.stringify(initialAllow) ||
    JSON.stringify(deny) !== JSON.stringify(initialDeny);

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Tag-based eligibility
        </Text>
        <Text as="p" tone="subdued">
          Allow takes priority. If a customer has both an allow
          and deny tag, they see the bundle. Leave both lists
          empty for "everyone."
        </Text>
        {error && (
          <Banner tone="critical" title="Couldn't add tag">
            {error}
          </Banner>
        )}

        <Box>
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            Must have one of (allow)
          </Text>
          <InlineStack gap="200" wrap blockAlign="center">
            {allow.map((t) => (
              <Tag
                key={`allow-${t}`}
                onRemove={() => setAllow(allow.filter((x) => x !== t))}
              >
                {t}
              </Tag>
            ))}
          </InlineStack>
          <Box paddingBlockStart="200">
            <InlineStack gap="200" blockAlign="end">
              <Box minWidth="240px">
                <TextField
                  label="Add allow tag"
                  value={pendingAllow}
                  onChange={setPendingAllow}
                  autoComplete="off"
                  placeholder="e.g. vip"
                />
              </Box>
              <Button onClick={() => add("allow")}>Add</Button>
            </InlineStack>
          </Box>
        </Box>

        <Box>
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            Must NOT have any of (deny)
          </Text>
          <InlineStack gap="200" wrap blockAlign="center">
            {deny.map((t) => (
              <Tag
                key={`deny-${t}`}
                onRemove={() => setDeny(deny.filter((x) => x !== t))}
              >
                {t}
              </Tag>
            ))}
          </InlineStack>
          <Box paddingBlockStart="200">
            <InlineStack gap="200" blockAlign="end">
              <Box minWidth="240px">
                <TextField
                  label="Add deny tag"
                  value={pendingDeny}
                  onChange={setPendingDeny}
                  autoComplete="off"
                  placeholder="e.g. wholesale"
                />
              </Box>
              <Button onClick={() => add("deny")}>Add</Button>
            </InlineStack>
          </Box>
        </Box>

        <InlineStack align="end">
          <Button
            variant="primary"
            onClick={() =>
              onSave({
                eligibility: {
                  customerTagsAllow: allow.length > 0 ? allow : null,
                  customerTagsDeny: deny.length > 0 ? deny : null,
                },
              })
            }
            loading={busy}
            disabled={busy || !dirty}
          >
            Save tags
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

// ---------------- Login & Segments ----------------

interface LoginSegmentsCardProps {
  initialRequireLogin: boolean;
  initialSegmentIds: string[];
  busy: boolean;
  onSave: CustomersTabProps["onSave"];
}

function LoginSegmentsCard({
  initialRequireLogin,
  initialSegmentIds,
  busy,
  onSave,
}: LoginSegmentsCardProps): JSX.Element {
  const [requireLogin, setRequireLogin] = useState<boolean>(initialRequireLogin);
  const [segmentText, setSegmentText] = useState<string>(
    initialSegmentIds.join("\n"),
  );

  function parseSegments(text: string): string[] {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  const parsed = parseSegments(segmentText);
  const dirty =
    requireLogin !== initialRequireLogin ||
    JSON.stringify(parsed) !== JSON.stringify(initialSegmentIds);

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Login &amp; Segments
        </Text>
        <Checkbox
          label="Require customer login"
          checked={requireLogin}
          onChange={setRequireLogin}
          helpText="When on, only logged-in customers see this bundle."
        />
        <TextField
          label="Shopify Segment GIDs"
          value={segmentText}
          onChange={setSegmentText}
          multiline={4}
          autoComplete="off"
          placeholder={"gid://shopify/Segment/12345\ngid://shopify/Segment/67890"}
          helpText='One per line. Find segments in Shopify Admin → Customers → Segments.'
        />
        <InlineStack align="end">
          <Button
            variant="primary"
            onClick={() =>
              onSave({
                eligibility: {
                  requireLogin: requireLogin === false ? null : true,
                  segmentIds: parsed.length > 0 ? parsed : null,
                },
              })
            }
            loading={busy}
            disabled={busy || !dirty}
          >
            Save
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

// ---------------- Markets & locales ----------------

interface MarketLocaleCardProps {
  initialMarkets: string[];
  initialLocales: string[];
  busy: boolean;
  onSave: CustomersTabProps["onSave"];
}

function MarketLocaleCard({
  initialMarkets,
  initialLocales,
  busy,
  onSave,
}: MarketLocaleCardProps): JSX.Element {
  const [markets, setMarkets] = useState<string[]>(initialMarkets);
  const [locales, setLocales] = useState<string[]>(initialLocales);
  const dirty =
    JSON.stringify(markets) !== JSON.stringify(initialMarkets) ||
    JSON.stringify(locales) !== JSON.stringify(initialLocales);
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Market &amp; locale
        </Text>
        <Text as="p" tone="subdued">
          Empty selection means no restriction on that dimension.
          The storefront ANDs all enabled dimensions together.
        </Text>
        <ChoiceList
          title="Markets"
          allowMultiple
          choices={COMMON_MARKETS}
          selected={markets}
          onChange={setMarkets}
        />
        <ChoiceList
          title="Locales"
          allowMultiple
          choices={SUPPORTED_LOCALE_LIST.map((l) => ({ label: l, value: l }))}
          selected={locales}
          onChange={setLocales}
        />
        <InlineStack align="end">
          <Button
            variant="primary"
            onClick={() =>
              onSave({
                eligibility: {
                  markets: markets.length > 0 ? markets : null,
                  locales: locales.length > 0 ? locales : null,
                },
              })
            }
            loading={busy}
            disabled={busy || !dirty}
          >
            Save targeting
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

// ---------------- Tab shell ----------------

export function CustomersTab(props: CustomersTabProps): JSX.Element {
  const { eligibility, busy, onSave } = props;
  return (
    <BlockStack gap="400">
      <TagsCard
        initialAllow={eligibility.customerTagsAllow ?? []}
        initialDeny={eligibility.customerTagsDeny ?? []}
        busy={busy}
        onSave={onSave}
      />
      <LoginSegmentsCard
        initialRequireLogin={eligibility.requireLogin === true}
        initialSegmentIds={eligibility.segmentIds ?? []}
        busy={busy}
        onSave={onSave}
      />
      <MarketLocaleCard
        initialMarkets={eligibility.markets ?? []}
        initialLocales={eligibility.locales ?? []}
        busy={busy}
        onSave={onSave}
      />
    </BlockStack>
  );
}
