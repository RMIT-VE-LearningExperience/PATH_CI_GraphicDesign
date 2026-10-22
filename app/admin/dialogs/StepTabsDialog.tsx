"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { DEFAULT_STEP_TAB_LABELS, STEP_SECTIONS, STEP_TAB_LABEL_MAX_LENGTH, type StepSection } from "../../../lib/step-groups";
import { DIALOG_PAPER_SX, DIALOG_TITLE_SX, DIALOG_ACTIONS_SX, PRIMARY_BTN_SX, CANCEL_BTN_SX } from "./dialogStyles";

type Props = {
  open: boolean;
  onClose: () => void;
  labels: Record<StepSection, string>;
  onSave: (labels: Record<StepSection, string>) => void;
  loading?: boolean;
};

// What each tab shows, so admins know what they are naming
const DESCRIPTIONS: Record<StepSection, string> = {
  overview: "Written once per printer and shown to every product under it. Shown as an accordion.",
  steps: "The numbered steps for the product.",
  appendix: "Extra reference material for the product. Shown as an accordion.",
  safety: "Shown as a pop-up the first time a visitor opens the product in a browser session.",
};

export default function StepTabsDialog({ open, onClose, labels, onSave, loading }: Props) {
  const [draft, setDraft] = useState<Record<StepSection, string>>(labels);

  useEffect(() => {
    if (open) setDraft(labels);
  }, [open, labels]);

  const hasBlank = STEP_SECTIONS.some((section) => !draft[section].trim());

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: DIALOG_PAPER_SX }}>
      <DialogTitle sx={DIALOG_TITLE_SX}>Edit tab names</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            These names apply to every product in the app. A tab with no content is hidden from visitors.
          </Typography>
          {STEP_SECTIONS.map((section) => (
            <TextField
              key={section}
              label={DEFAULT_STEP_TAB_LABELS[section]}
              value={draft[section]}
              onChange={(e) => setDraft((prev) => ({ ...prev, [section]: e.target.value }))}
              helperText={DESCRIPTIONS[section]}
              inputProps={{ maxLength: STEP_TAB_LABEL_MAX_LENGTH }}
              error={!draft[section].trim()}
              fullWidth
              required
              size="small"
            />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={DIALOG_ACTIONS_SX}>
        <Button onClick={onClose} disabled={loading} sx={CANCEL_BTN_SX}>Cancel</Button>
        <Button
          onClick={() => onSave(draft)}
          variant="contained"
          disabled={loading || hasBlank}
          sx={PRIMARY_BTN_SX}
        >
          {loading ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
