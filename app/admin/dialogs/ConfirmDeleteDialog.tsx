"use client";

import type { ReactNode } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { DIALOG_PAPER_SX, DIALOG_TITLE_SX, DIALOG_ACTIONS_SX, CANCEL_BTN_SX } from "./dialogStyles";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
  loading?: boolean;
  message?: ReactNode;
};

export default function ConfirmDeleteDialog({ open, onClose, onConfirm, itemName, loading, message }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: DIALOG_PAPER_SX }}>
      <DialogTitle sx={DIALOG_TITLE_SX}>Confirm Delete</DialogTitle>
      <DialogContent>
        <Typography sx={{ pt: 2 }}>
          {message ?? (
            <>Delete <strong>{itemName}</strong>? It will be moved to the deleted items bin and can be restored.</>
          )}
        </Typography>
      </DialogContent>
      <DialogActions sx={DIALOG_ACTIONS_SX}>
        <Button onClick={onClose} disabled={loading} sx={CANCEL_BTN_SX}>Cancel</Button>
        <Button
          onClick={onConfirm}
          color="error"
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
