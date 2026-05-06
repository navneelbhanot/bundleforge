/**
 * Shared confirm dialog (M-182).
 *
 * Replaces hand-rolled <Modal> blocks scattered across
 * pages (AdvancedTab Delete, BundlesListTable bulk + saved-
 * view delete, etc.). Optional `requireTyped` keeps the
 * primary action disabled until the user types the magic
 * string — covers the typed-Delete pattern from M-175.
 */
import { useEffect, useState, type ReactNode } from "react";
import {
  BlockStack,
  Modal,
  Text,
  TextField,
} from "@shopify/polaris";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /**
   * When set, the primary button stays disabled until the
   * user types this exact string in the confirmation
   * TextField. Used for irreversible destructive actions.
   */
  requireTyped?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps): JSX.Element {
  const {
    open,
    title,
    body,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    destructive = false,
    requireTyped,
    loading = false,
    onConfirm,
    onCancel,
  } = props;

  const [typed, setTyped] = useState("");

  // Clear the typed-confirm input every time the dialog
  // closes/reopens so the next invocation starts fresh.
  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const typedOk =
    !requireTyped || typed.trim().toUpperCase() === requireTyped.toUpperCase();
  const disabled = loading || !typedOk;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      primaryAction={{
        content: confirmLabel,
        loading,
        disabled,
        destructive,
        onAction: async () => {
          await onConfirm();
        },
      }}
      secondaryActions={[
        { content: cancelLabel, onAction: onCancel },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          {typeof body === "string" ? (
            <Text as="p">{body}</Text>
          ) : body !== undefined ? (
            body
          ) : null}
          {requireTyped && (
            <TextField
              label={`Type ${requireTyped} to confirm`}
              value={typed}
              onChange={setTyped}
              autoComplete="off"
            />
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
