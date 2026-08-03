"use client";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Add as AddIcon, Crop as CropIcon } from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";
import { validateImageFile, processUpload } from "../utils/imageUpload";
import { DIALOG_PAPER_SX, DIALOG_TITLE_SX, DIALOG_ACTIONS_SX, PRIMARY_BTN_SX, CANCEL_BTN_SX, UPLOAD_BTN_SX } from "./dialogStyles";
import ImageCropDialog from "./ImageCropDialog";

type SaveData = {
  name: string;
  description: string;
  thumbnailDataUrl: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (data: SaveData) => void;
  loading?: boolean;
  mode: "add" | "edit";
  levelSingularName: string;
  initialData?: {
    name?: string;
    description?: string;
    thumbnailUrl?: string;
  };
};

export default function AddEditItemDialog({
  open,
  onClose,
  onSave,
  loading,
  mode,
  levelSingularName,
  initialData,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const [compressed, setCompressed] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const originalThumbnailRef = useRef("");
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      prevOpenRef.current = false;
      return;
    }
    if (prevOpenRef.current) return;
    prevOpenRef.current = true;
    setName(initialData?.name ?? "");
    setDescription(initialData?.description ?? "");
    const url = initialData?.thumbnailUrl ?? "";
    setThumbnailDataUrl(url);
    originalThumbnailRef.current = url;
    setImageError("");
    setCompressed(false);
    setCropOpen(false);
  }, [open, initialData]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { setImageError(err); return; }
    setImageError("");
    const { dataUrl, compressed: wasCompressed } = await processUpload(file);
    setThumbnailDataUrl(dataUrl);
    originalThumbnailRef.current = dataUrl;
    setCompressed(wasCompressed);
    e.target.value = "";
  }

  function handleSave() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim(), thumbnailDataUrl });
  }

  function clearImage() {
    setThumbnailDataUrl("");
    originalThumbnailRef.current = "";
    setCompressed(false);
  }

  const title = mode === "add" ? `Add ${levelSingularName}` : `Edit ${levelSingularName}`;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: DIALOG_PAPER_SX }}>
        <DialogTitle sx={DIALOG_TITLE_SX}>{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 2 }}>

            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              size="small"
              autoFocus
            />

            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              size="small"
              placeholder={`Add a description for this ${levelSingularName.toLowerCase()}...`}
              inputProps={{ maxLength: 300 }}
              helperText={`${description.length} / 300`}
            />

            {/* Thumbnail */}
            <Box>
              <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>Thumbnail</Typography>

              {!thumbnailDataUrl && (
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <IconButton onClick={() => fileInputRef.current?.click()} sx={UPLOAD_BTN_SX}>
                    <AddIcon />
                  </IconButton>
                  <Typography variant="caption" color="text.secondary">
                    JPEG, PNG, or GIF · max 700 KB
                  </Typography>
                </Stack>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif"
                style={{ display: "none" }}
                onChange={(e) => void handleFileChange(e)}
              />

              {imageError && (
                <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
                  {imageError}
                </Typography>
              )}
              {compressed && (
                <Typography variant="caption" display="block" sx={{ mt: 0.5, color: "#f59e0b" }}>
                  Image was compressed to meet the 700 KB limit.
                </Typography>
              )}

              {thumbnailDataUrl && (
                <Box sx={{ mt: 1, display: "flex", gap: 2, alignItems: "flex-start" }}>
                  <Box sx={{ position: "relative", display: "inline-block" }}>
                    <Box
                      component="img"
                      src={thumbnailDataUrl}
                      alt="Thumbnail preview"
                      sx={{
                        width: 220, maxWidth: "100%", aspectRatio: "4/3",
                        objectFit: "cover", borderRadius: 1,
                        border: "1px solid", borderColor: "divider",
                        display: "block",
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={clearImage}
                      sx={{ position: "absolute", top: 0, right: 0, bgcolor: "rgba(255,255,255,0.9)", "&:hover": { bgcolor: "#fff" } }}
                    >
                      ✕
                    </IconButton>
                  </Box>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<CropIcon />}
                      onClick={() => setCropOpen(true)}
                      sx={{ color: "#3D8078", borderColor: "#3D8078", textTransform: "none", fontWeight: 600 }}
                    >
                      Crop
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>

          </Stack>
        </DialogContent>
        <DialogActions sx={DIALOG_ACTIONS_SX}>
          <Button onClick={onClose} disabled={loading} sx={CANCEL_BTN_SX}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={loading || !name.trim()}
            sx={PRIMARY_BTN_SX}
          >
            {loading
              ? (mode === "add" ? "Adding..." : "Saving...")
              : (mode === "add" ? "Add" : "Save")}
          </Button>
        </DialogActions>
      </Dialog>

      <ImageCropDialog
        open={cropOpen}
        onClose={() => setCropOpen(false)}
        imageDataUrl={thumbnailDataUrl}
        originalDataUrl={originalThumbnailRef.current}
        onApply={(cropped) => setThumbnailDataUrl(cropped)}
      />
    </>
  );
}
