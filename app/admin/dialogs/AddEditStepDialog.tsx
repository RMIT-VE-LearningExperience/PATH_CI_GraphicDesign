"use client";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Add as AddIcon, Crop as CropIcon, DragIndicator as DragIndicatorIcon } from "@mui/icons-material";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
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

type GalleryImage = { id: string; dataUrl: string; original: string };

type SaveData = {
  title: string;
  contentHtml: string;
  imageDataUrls: string[];
  videoUrl: string;
  stepType: "main" | "sub";
  parentStepId: string | null;
};

type MainStepOption = { id: string; title: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (data: SaveData) => void;
  loading?: boolean;
  mode: "add" | "edit";
  // Display number, e.g. "3" for a main step or "3.2" for a sub-step
  stepLabel?: string;
  // For tabs other than Steps: the tab's name, used in place of a number in the title
  sectionName?: string;
  // The step being edited (it can't be its own parent)
  stepId?: string;
  stepType: "main" | "sub";
  parentStepId?: string | null;
  mainSteps: MainStepOption[];
  initialData?: {
    title?: string;
    contentHtml?: string;
    imageUrls?: string[];
    videoUrl?: string;
  };
};

export default function AddEditStepDialog({
  open,
  onClose,
  onSave,
  loading,
  mode,
  stepLabel,
  sectionName,
  stepId,
  stepType: initialStepType,
  parentStepId: initialParentStepId,
  mainSteps,
  initialData,
}: Props) {
  const [title, setTitle] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const [compressed, setCompressed] = useState(false);
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const [stepType, setStepType] = useState<"main" | "sub">("main");
  const [parentStepId, setParentStepId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const prevOpenRef = useRef(false);

  // Available parents exclude the step itself (a step can't be its own parent)
  const parentOptions = mainSteps.filter((m) => m.id !== stepId);

  useEffect(() => {
    if (!open) {
      prevOpenRef.current = false;
      return;
    }
    if (prevOpenRef.current) return;
    prevOpenRef.current = true;
    setTitle(initialData?.title ?? "");
    setContentHtml(initialData?.contentHtml ?? "");
    setImages((initialData?.imageUrls ?? []).map((url) => ({ id: crypto.randomUUID(), dataUrl: url, original: url })));
    setVideoUrl(initialData?.videoUrl ?? "");
    setImageError("");
    setCompressed(false);
    setCropIndex(null);
    setStepType(initialStepType);
    setParentStepId(initialParentStepId ?? null);
  }, [open, initialData, initialStepType, initialParentStepId]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { setImageError(err); return; }
    setImageError("");
    const { dataUrl, compressed: wasCompressed } = await processUpload(file);
    setImages((prev) => [...prev, { id: crypto.randomUUID(), dataUrl, original: dataUrl }]);
    if (wasCompressed) setCompressed(true);
    e.target.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function handleImageDragEnd(result: DropResult) {
    if (!result.destination) return;
    setImages((prev) => {
      const next = Array.from(prev);
      const [moved] = next.splice(result.source.index, 1);
      next.splice(result.destination!.index, 0, moved);
      return next;
    });
  }

  function handleSave() {
    if (!title.trim()) return;
    if (stepType === "sub" && !parentStepId) return;
    onSave({
      title: title.trim(),
      contentHtml,
      imageDataUrls: images.map((img) => img.dataUrl),
      videoUrl: videoUrl.trim(),
      stepType,
      parentStepId: stepType === "sub" ? parentStepId : null,
    });
  }

  const embedUrl = getVideoEmbedUrl(videoUrl);
  const isDirectVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(videoUrl);

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: DIALOG_PAPER_SX }}>
        <DialogTitle sx={DIALOG_TITLE_SX}>
          {sectionName
            ? `${sectionName}: ${mode === "add" ? "new" : "edit"} ${stepType === "sub" ? "sub-item" : "item"}`
            : `${stepType === "sub" ? "Sub-step" : "Step"} ${stepLabel ?? "1"}`}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 2 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl size="small" sx={{ minWidth: 160 }} disabled={parentOptions.length === 0 && stepType === "main"}>
                <InputLabel id="step-type-label">{sectionName ? "Item type" : "Step type"}</InputLabel>
                <Select
                  labelId="step-type-label"
                  label={sectionName ? "Item type" : "Step type"}
                  value={stepType}
                  onChange={(e) => {
                    const next = e.target.value as "main" | "sub";
                    setStepType(next);
                    if (next === "sub" && !parentStepId) {
                      setParentStepId(parentOptions[0]?.id ?? null);
                    }
                  }}
                >
                  <MenuItem value="main">{sectionName ? "Main item" : "Main step"}</MenuItem>
                  <MenuItem value="sub" disabled={parentOptions.length === 0}>{sectionName ? "Sub-item" : "Sub-step"}</MenuItem>
                </Select>
              </FormControl>

              {stepType === "sub" && (
                <FormControl size="small" sx={{ minWidth: 200, flex: 1 }} required>
                  <InputLabel id="parent-step-label">{sectionName ? "Under main item" : "Under main step"}</InputLabel>
                  <Select
                    labelId="parent-step-label"
                    label={sectionName ? "Under main item" : "Under main step"}
                    value={parentStepId ?? ""}
                    onChange={(e) => setParentStepId(e.target.value || null)}
                  >
                    {parentOptions.map((m) => (
                      <MenuItem key={m.id} value={m.id}>{m.title || "Untitled step"}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Stack>

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

            {/* Media section: any number of images, plus an optional video */}
            <Box>
              <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>Images</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Optional &mdash; add as many as this step needs. Drag the handle to reorder.
              </Typography>

              <DragDropContext onDragEnd={handleImageDragEnd}>
                <Droppable droppableId="step-images" direction="horizontal">
                  {(droppableProvided) => (
                    <Stack
                      ref={droppableProvided.innerRef}
                      {...droppableProvided.droppableProps}
                      direction="row"
                      flexWrap="wrap"
                      gap={2}
                      sx={{ mb: images.length > 0 ? 1.5 : 0 }}
                    >
                      {images.map((img, index) => (
                        <Draggable key={img.id} draggableId={img.id} index={index}>
                          {(dragProvided, snapshot) => (
                            <Box
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              sx={{
                                position: "relative", display: "inline-block", borderRadius: 1,
                                boxShadow: snapshot.isDragging ? "0 8px 24px rgba(0,0,0,0.2)" : "none",
                              }}
                            >
                              <Box
                                component="img"
                                src={img.dataUrl}
                                alt={`Step image ${index + 1} preview`}
                                sx={{
                                  width: 160, maxWidth: "100%", aspectRatio: "4/3",
                                  objectFit: "cover", borderRadius: 1,
                                  border: "1px solid", borderColor: "divider", display: "block",
                                }}
                              />
                              <Box
                                {...dragProvided.dragHandleProps}
                                aria-label={`Reorder image ${index + 1} of ${images.length}. Press space to pick up, then use the arrow keys.`}
                                sx={{
                                  position: "absolute", top: 4, left: 4,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  width: 28, height: 28, borderRadius: 1,
                                  bgcolor: "rgba(255,255,255,0.9)", cursor: "grab", color: "text.secondary",
                                  "&:hover": { bgcolor: "#fff" },
                                }}
                              >
                                <DragIndicatorIcon fontSize="small" />
                              </Box>
                              <Stack direction="row" spacing={0.5} sx={{ position: "absolute", top: 4, right: 4 }}>
                                <IconButton
                                  size="small"
                                  onClick={() => setCropIndex(index)}
                                  aria-label={`Crop image ${index + 1}`}
                                  sx={{ bgcolor: "rgba(255,255,255,0.9)", "&:hover": { bgcolor: "#fff" } }}
                                >
                                  <CropIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => removeImage(index)}
                                  aria-label={`Remove image ${index + 1}`}
                                  sx={{ bgcolor: "rgba(255,255,255,0.9)", "&:hover": { bgcolor: "#fff" } }}
                                >
                                  <span aria-hidden="true">✕</span>
                                </IconButton>
                              </Stack>
                            </Box>
                          )}
                        </Draggable>
                      ))}
                      {droppableProvided.placeholder}
                    </Stack>
                  )}
                </Droppable>
              </DragDropContext>

              <Stack direction="row" alignItems="center" spacing={1.5}>
                <IconButton onClick={() => fileInputRef.current?.click()} aria-label="Add image" sx={UPLOAD_BTN_SX}>
                  <AddIcon />
                </IconButton>
                <Typography variant="caption" color="text.secondary">
                  JPEG, PNG, or GIF · max 700 KB each
                </Typography>
              </Stack>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif"
                style={{ display: "none" }}
                onChange={(e) => void handleFileChange(e)}
              />

              {imageError && (
                <Typography variant="caption" color="error" display="block" role="alert" sx={{ mt: 0.5 }}>
                  {imageError}
                </Typography>
              )}
              {compressed && (
                <Typography variant="caption" display="block" role="status" sx={{ mt: 0.5, color: "#7A5C00" }}>
                  An image was compressed to meet the 700 KB limit.
                </Typography>
              )}

              <Stack spacing={1.5} sx={{ mt: 3 }}>
                <Typography variant="body2" fontWeight={500}>Video</Typography>
                <TextField
                  label="Video URL"
                  placeholder="YouTube, Vimeo, or direct .mp4 link (optional)"
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
                          title="Video preview"
                          sx={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                        />
                      </Box>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => setVideoUrl("")}
                      aria-label="Remove video"
                      sx={{ position: "absolute", top: 4, right: 4, bgcolor: "rgba(255,255,255,0.9)", "&:hover": { bgcolor: "#fff" } }}
                    >
                      <span aria-hidden="true">✕</span>
                    </IconButton>
                  </Box>
                )}
              </Stack>
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
            disabled={loading || !title.trim() || (stepType === "sub" && !parentStepId)}
            sx={PRIMARY_BTN_SX}
          >
            {loading
              ? (mode === "add" ? "Adding..." : "Saving...")
              : (mode === "add" ? (sectionName ? (stepType === "sub" ? "Add Sub-item" : "Add Item") : (stepType === "sub" ? "Add Sub-step" : "Add Step")) : "Save")}
          </Button>
        </DialogActions>
      </Dialog>

      <ImageCropDialog
        open={cropIndex !== null}
        onClose={() => setCropIndex(null)}
        imageDataUrl={cropIndex !== null ? images[cropIndex]?.dataUrl ?? "" : ""}
        originalDataUrl={cropIndex !== null ? images[cropIndex]?.original ?? "" : ""}
        onApply={(cropped) => {
          if (cropIndex === null) return;
          setImages((prev) => prev.map((img, i) => (i === cropIndex ? { ...img, dataUrl: cropped } : img)));
        }}
      />
    </>
  );
}
