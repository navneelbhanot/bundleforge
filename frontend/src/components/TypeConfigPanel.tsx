/**
 * Visual builder — type-specific config panel (M-100).
 *
 * Switches on bundle.type and renders the relevant config form. The
 * config shape mirrors src/services/bundles/validators.ts (M-048).
 */
import { Card, Text, TextField, Checkbox } from "@shopify/polaris";

export interface TypeConfigPanelProps {
  type: string;
  config: Record<string, unknown>;
}

function asNum(v: unknown, fallback = ""): string {
  return typeof v === "number" ? String(v) : fallback;
}
function asBool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export function TypeConfigPanel({ type, config }: TypeConfigPanelProps): JSX.Element {
  const noop = () => {};
  switch (type) {
    case "fixed":
      return (
        <Card>
          <Text as="h2" variant="headingMd">
            Fixed bundle
          </Text>
          <Text as="p">No additional config required.</Text>
        </Card>
      );
    case "mix_match":
      return (
        <Card>
          <Text as="h2" variant="headingMd">
            Mix &amp; match
          </Text>
          <TextField
            label="Min items"
            type="number"
            value={asNum(config.minItems)}
            onChange={noop}
            autoComplete="off"
          />
          <TextField
            label="Max items"
            type="number"
            value={asNum(config.maxItems)}
            onChange={noop}
            autoComplete="off"
          />
          <Checkbox
            label="Allow duplicates"
            checked={asBool(config.allowDuplicates)}
            onChange={noop}
          />
        </Card>
      );
    case "build_box":
      return (
        <Card>
          <Text as="h2" variant="headingMd">
            Build-a-box
          </Text>
          <TextField
            label="Min items"
            type="number"
            value={asNum(config.minItems)}
            onChange={noop}
            autoComplete="off"
          />
          <TextField
            label="Max items"
            type="number"
            value={asNum(config.maxItems)}
            onChange={noop}
            autoComplete="off"
          />
          <Text as="p">Steps: {(config.steps as Array<unknown> | undefined)?.length ?? 0}</Text>
        </Card>
      );
    case "multipack":
      return (
        <Card>
          <Text as="h2" variant="headingMd">
            Multipack
          </Text>
          <TextField
            label="Pack quantity"
            type="number"
            value={asNum(config.packQuantity)}
            onChange={noop}
            autoComplete="off"
          />
        </Card>
      );
    case "wholesale":
      return (
        <Card>
          <Text as="h2" variant="headingMd">
            Wholesale
          </Text>
          <TextField
            label="Min wholesale qty"
            type="number"
            value={asNum(config.minWholesaleQuantity)}
            onChange={noop}
            autoComplete="off"
          />
        </Card>
      );
    default:
      return (
        <Card>
          <Text as="h2" variant="headingMd">
            {type}
          </Text>
          <Text as="p">Free-form configuration.</Text>
        </Card>
      );
  }
}
