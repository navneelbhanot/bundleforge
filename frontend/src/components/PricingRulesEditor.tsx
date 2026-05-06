/**
 * PricingRulesEditor (M-101).
 *
 * One Card per rule with inline controls. The card layout reads
 * better than a 6-column IndexTable on narrower widths and makes
 * every input obvious — merchants don't have to guess which cell is
 * editable. `onChange` fires on every mutation (add, edit, remove)
 * with the full rules array; the parent decides when to persist.
 */
import { useState } from "react";
import {
  Card,
  Button,
  BlockStack,
  Box,
  Checkbox,
  EmptyState,
  InlineStack,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";

export type PricingRuleType =
  | "fixed"
  | "percentage"
  | "flat_discount"
  | "tiered"
  | "volume"
  | "bogo"
  | "custom";

export interface PricingRuleRow {
  id?: string;
  type: PricingRuleType;
  value: number;
  minQuantity?: number;
  priority?: number;
  isStackable?: boolean;
}

export interface PricingRulesEditorProps {
  initial: PricingRuleRow[];
  onChange?: (rules: PricingRuleRow[]) => void;
}

const TYPE_OPTIONS: Array<{ label: string; value: PricingRuleType; hint: string }> = [
  { label: "Percentage off", value: "percentage", hint: "% off the bundle subtotal." },
  { label: "Fixed amount off", value: "flat_discount", hint: "Flat $ amount off the subtotal." },
  { label: "Fixed bundle price", value: "fixed", hint: "Override the subtotal to this exact $ value." },
  { label: "Tiered (per quantity)", value: "tiered", hint: "Different rate at different quantities. Use Min qty to set the threshold." },
  { label: "Volume", value: "volume", hint: "Wholesale-style: deeper discount past a quantity threshold." },
  { label: "BOGO", value: "bogo", hint: "Buy-one-get-one. Value = % off the 'get' item (100 = free)." },
  { label: "Custom", value: "custom", hint: "Free-form. Your own logic interprets value." },
];

let counter = 0;
const localId = (): string => `local-${++counter}`;

function valueLabel(type: PricingRuleType): string {
  switch (type) {
    case "percentage":
      return "Discount (%)";
    case "flat_discount":
      return "Amount off";
    case "fixed":
      return "Bundle price";
    case "tiered":
    case "volume":
      return "Discount per unit";
    case "bogo":
      return "Discount on 'get' (%)";
    case "custom":
      return "Value";
  }
}

function valueHelpText(type: PricingRuleType): string {
  return TYPE_OPTIONS.find((o) => o.value === type)?.hint ?? "";
}

function parseNumber(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function parseOptionalNumber(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

interface RuleCardProps {
  rule: PricingRuleRow;
  index: number;
  onUpdate: (patch: Partial<PricingRuleRow>) => void;
  onRemove: () => void;
}

function RuleCard({ rule, index, onUpdate, onRemove }: RuleCardProps): JSX.Element {
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h3" variant="headingSm">
            Rule {index + 1}
          </Text>
          <Button onClick={onRemove} tone="critical" variant="tertiary">
            Remove
          </Button>
        </InlineStack>

        <Select
          label="Rule type"
          options={TYPE_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
          value={rule.type}
          onChange={(v) => onUpdate({ type: v as PricingRuleType })}
          helpText={valueHelpText(rule.type)}
        />

        <InlineStack gap="400" wrap>
          <Box minWidth="180px">
            <TextField
              label={valueLabel(rule.type)}
              type="number"
              value={String(rule.value)}
              onChange={(v) => onUpdate({ value: parseNumber(v) })}
              autoComplete="off"
              step={rule.type === "percentage" || rule.type === "bogo" ? 1 : 0.01}
            />
          </Box>
          <Box minWidth="160px">
            <TextField
              label="Min quantity"
              type="number"
              value={rule.minQuantity === undefined ? "" : String(rule.minQuantity)}
              onChange={(v) => onUpdate({ minQuantity: parseOptionalNumber(v) })}
              autoComplete="off"
              helpText="Leave blank for no minimum."
            />
          </Box>
          <Box minWidth="160px">
            <TextField
              label="Priority"
              type="number"
              value={String(rule.priority ?? 0)}
              onChange={(v) => onUpdate({ priority: parseNumber(v) })}
              autoComplete="off"
              helpText="Higher runs first."
            />
          </Box>
        </InlineStack>

        <Checkbox
          label="Stackable with other rules"
          checked={rule.isStackable ?? false}
          onChange={(checked) => onUpdate({ isStackable: checked })}
          helpText="Off: this rule is exclusive — only one rule applies per bundle."
        />
      </BlockStack>
    </Card>
  );
}

export function PricingRulesEditor({
  initial,
  onChange,
}: PricingRulesEditorProps): JSX.Element {
  const [rules, setRules] = useState<PricingRuleRow[]>(initial);

  function emit(next: PricingRuleRow[]): void {
    setRules(next);
    onChange?.(next);
  }

  function add(): void {
    emit([
      ...rules,
      {
        id: localId(),
        type: "percentage",
        value: 10,
        minQuantity: 1,
        priority: 0,
        isStackable: false,
      },
    ]);
  }

  function update(idx: number, patch: Partial<PricingRuleRow>): void {
    emit(rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function remove(idx: number): void {
    emit(rules.filter((_, i) => i !== idx));
  }

  return (
    <BlockStack gap="300">
      <InlineStack align="space-between" blockAlign="center">
        <Text as="h2" variant="headingMd">
          Pricing rules
        </Text>
        <Button onClick={add} variant="primary">
          Add rule
        </Button>
      </InlineStack>

      {rules.length === 0 ? (
        <Card>
          <EmptyState
            heading="No pricing rules yet"
            action={{ content: "Add your first rule", onAction: add }}
            image=""
          >
            <p>
              Without a rule the bundle prices at the sum of its
              components. Add a percentage, flat discount, or fixed
              bundle price to apply at the cart and checkout.
            </p>
          </EmptyState>
        </Card>
      ) : (
        rules.map((r, i) => (
          <RuleCard
            key={r.id ?? i}
            rule={r}
            index={i}
            onUpdate={(patch) => update(i, patch)}
            onRemove={() => remove(i)}
          />
        ))
      )}
    </BlockStack>
  );
}
