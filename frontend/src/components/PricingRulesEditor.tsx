/**
 * PricingRulesEditor (M-101).
 *
 * Renders a Polaris IndexTable with one row per pricing rule. Allows
 * inline add / remove. Calls onChange(rules) on every mutation.
 */
import { useState } from "react";
import {
  Card,
  Button,
  IndexTable,
  Text,
  Badge,
  ButtonGroup,
} from "@shopify/polaris";

export interface PricingRuleRow {
  id?: string;
  type:
    | "fixed"
    | "percentage"
    | "flat_discount"
    | "tiered"
    | "volume"
    | "bogo"
    | "custom";
  value: number;
  minQuantity?: number;
  priority?: number;
  isStackable?: boolean;
}

export interface PricingRulesEditorProps {
  initial: PricingRuleRow[];
  onChange?: (rules: PricingRuleRow[]) => void;
}

let counter = 0;
const localId = (): string => `local-${++counter}`;

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
    const next: PricingRuleRow[] = [
      ...rules,
      {
        id: localId(),
        type: "fixed",
        value: 0,
        minQuantity: 1,
        priority: 0,
        isStackable: false,
      },
    ];
    emit(next);
  }

  function remove(idx: number): void {
    const next = rules.filter((_, i) => i !== idx);
    emit(next);
  }

  return (
    <Card>
      <Text as="h2" variant="headingMd">
        Pricing rules
      </Text>
      <IndexTable
        itemCount={rules.length}
        headings={[
          { title: "Type" },
          { title: "Value" },
          { title: "Min qty" },
          { title: "Priority" },
          { title: "Stackable" },
          { title: "" },
        ]}
        selectable={false}
      >
        {rules.map((r, i) => (
          <IndexTable.Row id={r.id ?? String(i)} key={r.id ?? i} position={i}>
            <IndexTable.Cell>
              <Text as="span" fontWeight="semibold">
                {r.type}
              </Text>
            </IndexTable.Cell>
            <IndexTable.Cell>{r.value}</IndexTable.Cell>
            <IndexTable.Cell>{r.minQuantity ?? "—"}</IndexTable.Cell>
            <IndexTable.Cell>{r.priority ?? 0}</IndexTable.Cell>
            <IndexTable.Cell>
              {r.isStackable ? (
                <Badge tone="success">stackable</Badge>
              ) : (
                <Badge>exclusive</Badge>
              )}
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Button onClick={() => remove(i)} variant="tertiary">
                Remove
              </Button>
            </IndexTable.Cell>
          </IndexTable.Row>
        ))}
      </IndexTable>
      <ButtonGroup>
        <Button onClick={add}>Add rule</Button>
      </ButtonGroup>
    </Card>
  );
}
