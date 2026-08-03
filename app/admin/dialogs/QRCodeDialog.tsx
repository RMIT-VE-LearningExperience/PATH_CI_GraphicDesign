"use client";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { Download as DownloadIcon } from "@mui/icons-material";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { DIALOG_PAPER_SX, DIALOG_ACTIONS_SX, PRIMARY_BTN_SX, CANCEL_BTN_SX } from "./dialogStyles";

type Props = {
  open: boolean;
  onClose: () => void;
  url: string;
  itemName: string;
};

export default function QRCodeDialog({ open, onClose, url, itemName }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQrDataUrl(null);
      return;
    }
    const padding = 20, qrSize = 300, textHeight = 40;
    void QRCode.toDataURL(url, { width: qrSize, margin: 2, color: { dark: "#000000", light: "#ffffff" } })
      .then((dataUrl) => {
        const canvas = document.createElement("canvas");
        canvas.width = qrSize + padding * 2;
        canvas.height = qrSize + padding * 2 + textHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, padding, padding, qrSize, qrSize);
          ctx.fillStyle = "#000000";
          ctx.font = "bold 16px Arial, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(itemName, canvas.width / 2, qrSize + padding + textHeight / 2 + 6);
          setQrDataUrl(canvas.toDataURL("image/png"));
        };
        img.src = dataUrl;
      })
      .catch(console.error);
  }, [open, url, itemName]);

  function download() {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.download = `${itemName.toLowerCase().replace(/\s+/g, "-")}-qr.png`;
    link.href = qrDataUrl;
    link.click();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: DIALOG_PAPER_SX }}>
      <DialogTitle sx={{ bgcolor: "#FDF9F1", borderBottom: "2px solid #E5E1D7", py: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#3D8078", fontSize: "1.1rem" }}>
          QR Code
        </Typography>
        <Typography variant="body2" color="text.secondary">{itemName}</Typography>
      </DialogTitle>
      <DialogContent sx={{ paddingTop: "24px !important", bgcolor: "#ffffff" }}>
        <Stack alignItems="center" spacing={2}>
          {qrDataUrl ? (
            <Box
              component="img"
              src={qrDataUrl}
              alt="QR code"
              sx={{
                maxWidth: 340,
                width: "100%",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                display: "block",
              }}
            />
          ) : (
            <Box sx={{ width: 340, height: 380, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography variant="body2" color="text.secondary">Generating…</Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ ...DIALOG_ACTIONS_SX, gap: 1 }}>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={download}
          disabled={!qrDataUrl}
          sx={{ ...PRIMARY_BTN_SX, flex: 1 }}
        >
          Download
        </Button>
        <Button onClick={onClose} sx={CANCEL_BTN_SX}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
