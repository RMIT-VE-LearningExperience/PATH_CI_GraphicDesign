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
  stepTitle: string;
  subStepTitles: string[];
};

export default function CannotConvertToSubStepDialog({ open, onClose, stepTitle, subStepTitles }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: DIALOG_PAPER_SX }}>
      <DialogTitle sx={DIALOG_TITLE_SX}>Can&rsquo;t convert this step</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 2 }}>
          <Typography variant="body2">
            &ldquo;{stepTitle}&rdquo; can&rsquo;t become a sub-step because it already has {subStepTitles.length === 1 ? "a sub-step of its own" : "sub-steps of its own"}:
          </Typography>
          <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 3 }}>
            {subStepTitles.map((title, i) => (
              <Typography key={i} component="li" variant="body2">
                {title || "Untitled step"}
              </Typography>
            ))}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Move or delete {subStepTitles.length === 1 ? "it" : "them"} first, then try converting this step again.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={DIALOG_ACTIONS_SX}>
        <Button onClick={onClose} sx={CANCEL_BTN_SX}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
