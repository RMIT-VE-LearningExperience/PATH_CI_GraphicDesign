"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { DIALOG_PAPER_SX, DIALOG_TITLE_SX, DIALOG_ACTIONS_SX, CANCEL_BTN_SX } from "./dialogStyles";

type Props = {
  open: boolean;
  onClose: () => void;
  name: string;
  lastModified: Date | null;
  modifiedBy: string;
  createdAt?: Date | null;
};

function fmt(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InfoDialog({ open, onClose, name, lastModified, modifiedBy, createdAt }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: DIALOG_PAPER_SX }}>
      <DialogTitle sx={DIALOG_TITLE_SX}>Item Information</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 2 }}>
          <Row label="Name" value={name} />
          {createdAt && <Row label="Created" value={fmt(createdAt)} />}
          <Row label="Last Modified" value={fmt(lastModified)} />
          <Row label="Modified By" value={modifiedBy || "—"} />
        </Stack>
      </DialogContent>
      <DialogActions sx={DIALOG_ACTIONS_SX}>
        <Button onClick={onClose} sx={CANCEL_BTN_SX}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start">
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );
}
