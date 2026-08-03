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
import { Add as AddIcon, Crop as CropIcon, Image as ImageIcon, Link as LinkIcon } from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";
import RichTextEditor from "../RichTextEditor";
import { validateImageFile, processUpload } from "../utils/imageUpload";
import { DIALOG_PAPER_SX, DIALOG_TITLE_SX, DIALOG_ACTIONS_SX, PRIMARY_BTN_SX, CANCEL_BTN_SX, UPLOAD_BTN_SX } from "./dialogStyles";
import ImageCropDialog from "./ImageCropDialog";

function getVideoEmbedUrl(url: string): string | null {
  if (!url.trim()) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vi = url.match(/vimeo\.com\/(\d+)/);
  if (vi) return `https://player.vimeo.com/video/${vi[1]}`;
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return url;
  return null;
}

type SaveData = {
  title: string;
  contentHtml: string;
  imageDataUrl: string;
  videoUrl: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (data: SaveData) => void;
  loading?: boolean;
  mode: "add" | "edit";
  stepNumber?: number;
  initialData?: {
    title?: string;
    contentHtml?: string;
    imageUrl?: string;
    videoUrl?: string;
  };
};

export default function AddEditStepDialog({
  open,
  onClose,
  onSave,
  loading,
  mode,
  stepNumber,
  initialData,
}: Props) {
  const [title, setTitle] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const [compressed, setCompressed] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const originalImageRef = useRef("");
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      prevOpenRef.current = false;
      return;
    }
    if (prevOpenRef.current) return;
    prevOpenRef.current = true;
    setTitle(initialData?.title ?? "");
    setContentHtml(initialData?.contentHtml ?? "");
    const vidUrl = initialData?.videoUrl ?? "";
    const imgUrl = initialData?.imageUrl ?? "";
    if (vidUrl) {
      setMediaType("video");
      setVideoUrl(vidUrl);
      setImageDataUrl("");
      originalImageRef.current = "";
    } else {
      setMediaType("image");
      setImageDataUrl(imgUrl);
      originalImageRef.current = imgUrl;
      setVideoUrl("");
    }
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
    setImageDataUrl(dataUrl);
    originalImageRef.current = dataUrl;
    setCompressed(wasCompressed);
    e.target.value = "";
  }

  function clearImage() {
    setImageDataUrl("");
    originalImageRef.current = "";
    setCompressed(false);
  }

  function handleSave() {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      contentHtml,
      imageDataUrl: mediaType === "image" ? imageDataUrl : "",
      videoUrl: mediaType === "video" ? videoUrl.trim() : "",
    });
  }

  const embedUrl = getVideoEmbedUrl(videoUrl);
  const isDirectVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(videoUrl);

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: DIALOG_PAPER_SX }}>
        <DialogTitle sx={DIALOG_TITLE_SX}>Step {stepNumber ?? 1}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 2 }}>
            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              required
              size="small"
              autoFocus
            />

            <RichTextEditor label="Content" value={contentHtml} onChange={setContentHtml} />

            {/* Media section */}
            <Box>
              <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>Media</Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Button
                  size="small"
                  variant={mediaType === "image" ? "contained" : "outlined"}
                  startIcon={<ImageIcon />}
                  onClick={() => { setMediaType("image"); setVideoUrl(""); }}
                  sx={{
                    textTransform: "none", fontWeight: 600,
                    ...(mediaType === "image"
                      ? { bgcolor: "#3D8078", color: "#fff", "&:hover": { bgcolor: "#2D6059" } }
                      : { color: "#3D8078", borderColor: "#3D8078" }),
                  }}
                >
                  Image
                </Button>
                <Button
                  size="small"
                  variant={mediaType === "video" ? "contained" : "outlined"}
                  startIcon={<LinkIcon />}
                  onClick={() => { setMediaType("video"); clearImage(); }}
                  sx={{
                    textTransform: "none", fontWeight: 600,
                    ...(mediaType === "video"
                      ? { bgcolor: "#3D8078", color: "#fff", "&:hover": { bgcolor: "#2D6059" } }
                      : { color: "#3D8078", borderColor: "#3D8078" }),
                  }}
                >
                  Video URL
                </Button>
              </Stack>

              {/* Image upload section */}
              {mediaType === "image" && (
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>Optional</Typography>

                  {!imageDataUrl && (
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

                  {imageDataUrl && (
                    <Box sx={{ mt: 2, display: "flex", gap: 2, alignItems: "flex-start" }}>
                      <Box sx={{ position: "relative", display: "inline-block" }}>
                        <Box
                          component="img"
                          src={imageDataUrl}
                          alt="Step image preview"
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
              )}

              {/* Video URL section */}
              {mediaType === "video" && (
                <Stack spacing={1.5}>
                  <TextField
                    label="Video URL"
                    placeholder="YouTube, Vimeo, or direct .mp4 link"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    fullWidth
                    size="small"
                  />
                  {embedUrl && (
                    <Box sx={{ position: "relative" }}>
                      {isDirectVideo ? (
                        <Box component="video" controls src={videoUrl} sx={{ width: "100%", borderRadius: 1 }} />
                      ) : (
                        <Box sx={{ position: "relative", width: "100%", paddingBottom: "56.25%", borderRadius: 1, overflow: "hidden" }}>
                          <Box
                            component="iframe"
                            src={embedUrl}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            sx={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                          />
                        </Box>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => setVideoUrl("")}
                        sx={{ position: "absolute", top: 4, right: 4, bgcolor: "rgba(255,255,255,0.9)", "&:hover": { bgcolor: "#fff" } }}
                      >
                        ✕
                      </IconButton>
                    </Box>
                  )}
                </Stack>
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
            disabled={loading || !title.trim()}
            sx={PRIMARY_BTN_SX}
          >
            {loading
              ? (mode === "add" ? "Adding..." : "Saving...")
              : (mode === "add" ? "Add Step" : "Save")}
          </Button>
        </DialogActions>
      </Dialog>

      <ImageCropDialog
        open={cropOpen}
        onClose={() => setCropOpen(false)}
        imageDataUrl={imageDataUrl}
        originalDataUrl={originalImageRef.current}
        onApply={(cropped) => setImageDataUrl(cropped)}
      />
    </>
  );
}
