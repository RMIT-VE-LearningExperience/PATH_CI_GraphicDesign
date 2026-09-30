"use client";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { DIALOG_PAPER_SX, DIALOG_ACTIONS_SX, PRIMARY_BTN_SX, CANCEL_BTN_SX } from "./dialogStyles";

type Props = {
  open: boolean;
  onClose: () => void;
  url: string;
  itemName: string;
};

export default function CopyLinkDialog({ open, onClose, url, itemName }: Props) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: DIALOG_PAPER_SX }}>
      <DialogTitle sx={{ bgcolor: "#f2f2f2", borderBottom: "2px solid #E5E1D7", py: 2.5 }}>
        <Typography component="span" variant="h6" sx={{ display: "block", fontWeight: 700, color: "#000054", fontSize: "1.1rem" }}>
          Copy Link
        </Typography>
        <Typography component="span" variant="body2" color="text.secondary" sx={{ display: "block" }}>{itemName}</Typography>
      </DialogTitle>
      <DialogContent sx={{ paddingTop: "24px !important", bgcolor: "#ffffff" }}>
        <Box sx={{ bgcolor: "#f9f9f9", borderRadius: 2, border: "1px solid #E5E1D7", p: 2 }}>
          <Typography
            variant="body2"
            sx={{ fontFamily: "monospace", fontSize: "0.75rem", wordBreak: "break-all", color: "#45443F" }}
          >
            {url}
          </Typography>
        </Box>
      </DialogContent>
      <Box role="status" sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }}>
        {copied ? "Link copied to clipboard" : ""}
      </Box>
      <DialogActions sx={{ ...DIALOG_ACTIONS_SX, gap: 1 }}>
        <Button
          variant="contained"
          onClick={copy}
          sx={{ ...PRIMARY_BTN_SX, flex: 1 }}
        >
          {copied ? "Copied!" : "Copy Link"}
        </Button>
        <Button onClick={onClose} sx={CANCEL_BTN_SX}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
