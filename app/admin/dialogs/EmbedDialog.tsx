"use client";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
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

const PRESETS = [
  { label: "Full width", value: "100%x600" },
  { label: "800×600", value: "800x600" },
  { label: "1280×720 (HD)", value: "1280x720" },
  { label: "Full width short", value: "100%x500" },
];

export default function EmbedDialog({ open, onClose, url, itemName }: Props) {
  const [width, setWidth] = useState("100%");
  const [height, setHeight] = useState("600");
  const [copied, setCopied] = useState(false);

  const presetValue = `${width}x${height}`;
  const embedCode = `<iframe src="${url}" width="${width}" height="${height}px" frameborder="0" allowfullscreen allow="fullscreen; accelerometer; gyroscope; vr" style="border:none;"></iframe>`;

  function handlePreset(value: string) {
    const [w, h] = value.split("x");
    setWidth(w);
    setHeight(h);
  }

  function copy() {
    void navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: DIALOG_PAPER_SX }}>
      <DialogTitle sx={{ bgcolor: "#FDF9F1", borderBottom: "2px solid #E5E1D7", py: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#3D8078", fontSize: "1.1rem" }}>
          Embed in Canvas LMS
        </Typography>
        <Typography variant="body2" color="text.secondary">{itemName}</Typography>
      </DialogTitle>
      <DialogContent sx={{ paddingTop: "24px !important", bgcolor: "#ffffff" }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>Width</Typography>
              <TextField size="small" fullWidth value={width} onChange={(e) => setWidth(e.target.value)} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>Height (px)</Typography>
              <TextField size="small" fullWidth value={height} onChange={(e) => setHeight(e.target.value)} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>Preset</Typography>
              <TextField
                select
                size="small"
                fullWidth
                value={PRESETS.some((p) => p.value === presetValue) ? presetValue : ""}
                onChange={(e) => handlePreset(e.target.value)}
              >
                {PRESETS.map((p) => (
                  <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                ))}
              </TextField>
            </Box>
          </Stack>

          <Box sx={{ bgcolor: "#f9f9f9", borderRadius: 2, border: "1px solid #E5E1D7", p: 2 }}>
            <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.75rem", wordBreak: "break-all", whiteSpace: "pre-wrap", color: "#45443F" }}>
              {embedCode}
            </Typography>
          </Box>

          <Box sx={{ bgcolor: "#EEF2FF", borderRadius: 2, p: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: "#3730a3", mb: 1 }}>
              How to embed in Canvas LMS:
            </Typography>
            <Box component="ol" sx={{ pl: 2, m: 0, color: "#3730a3" }}>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                Open your Canvas page or assignment in Edit mode
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                Click <strong>Insert → Embed</strong> (or the HTML editor <code>&lt;/&gt;</code> button)
              </Typography>
              <Typography component="li" variant="body2">
                Paste the code and save
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: "#4338ca", mt: 1, fontSize: "0.8rem" }}>
              This URL is permanent — uploading a new version won&apos;t break existing embeds.
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ ...DIALOG_ACTIONS_SX, gap: 1 }}>
        <Button
          variant="contained"
          onClick={copy}
          sx={{ ...PRIMARY_BTN_SX, flex: 1 }}
        >
          {copied ? "Copied!" : "Copy Embed Code"}
        </Button>
        <Button onClick={onClose} sx={CANCEL_BTN_SX}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
