"use client";

import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Image as ImageIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";
import type { Item } from "../../../lib/tutorial-store";
import { validateImageFile, processUpload } from "../utils/imageUpload";
import { DIALOG_PAPER_SX, DIALOG_TITLE_SX, DIALOG_ACTIONS_SX, PRIMARY_BTN_SX, CANCEL_BTN_SX, UPLOAD_BTN_SX } from "./dialogStyles";

type Props = {
  open: boolean;
  onClose: () => void;
  onLink: (itemId: string) => void;
  onCreateAndLink: (data: { name: string; description: string; thumbnailDataUrl: string }) => void;
  loading?: boolean;
  levelPluralName: string;
  levelSingularName: string;
  allItems: Item[];
  linkedItemIds: Set<string>;
};

const SECTION_HEADER_SX = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  px: 2,
  py: 1.5,
  cursor: "pointer",
  bgcolor: "#A19A8C",
  userSelect: "none",
  "&:hover": { bgcolor: "#918B7E" },
} as const;

export default function SearchLinkDialog({
  open,
  onClose,
  onLink,
  onCreateAndLink,
  loading,
  levelPluralName,
  levelSingularName,
  allItems,
  linkedItemIds,
}: Props) {
  const [query, setQuery] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(true);
  const [createExpanded, setCreateExpanded] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newThumbnailDataUrl, setNewThumbnailDataUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSearchExpanded(true);
      setCreateExpanded(false);
      setNewName("");
      setNewDescription("");
      setNewThumbnailDataUrl("");
      setImageError("");
    }
  }, [open]);

  const filtered = allItems.filter(
    (item) =>
      !linkedItemIds.has(item.id) &&
      item.name.toLowerCase().includes(query.toLowerCase()),
  );

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { setImageError(err); return; }
    setImageError("");
    const { dataUrl } = await processUpload(file);
    setNewThumbnailDataUrl(dataUrl);
    e.target.value = "";
  }

  function handleCreate() {
    if (!newName.trim()) return;
    onCreateAndLink({
      name: newName.trim(),
      description: newDescription.trim(),
      thumbnailDataUrl: newThumbnailDataUrl,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: DIALOG_PAPER_SX }}>
      <DialogTitle sx={DIALOG_TITLE_SX}>Add {levelSingularName}</DialogTitle>

      <DialogContent sx={{ padding: "0 !important" }}>

        {/* Search existing section */}
        <Box onClick={() => setSearchExpanded(!searchExpanded)} sx={SECTION_HEADER_SX}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.8rem", color: "#ffffff", letterSpacing: "0.08em" }}>
            SEARCH EXISTING {levelPluralName.toUpperCase()}
          </Typography>
          {searchExpanded
            ? <ExpandLessIcon sx={{ color: "#ffffff", fontSize: 20 }} />
            : <ExpandMoreIcon sx={{ color: "#ffffff", fontSize: 20 }} />}
        </Box>
        <Collapse in={searchExpanded}>
          <Stack spacing={1.5} sx={{ p: 2 }}>
            <TextField
              placeholder={`Search ${levelPluralName.toLowerCase()}...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              fullWidth
              size="small"
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            {filtered.length > 0 ? (
              <List dense disablePadding sx={{ maxHeight: 240, overflowY: "auto" }}>
                {filtered.map((item) => (
                  <ListItemButton
                    key={item.id}
                    onClick={() => onLink(item.id)}
                    disabled={loading}
                    sx={{ borderRadius: 1, "&:hover": { bgcolor: "rgba(0,0,84,0.08)" } }}
                  >
                    <ListItemAvatar>
                      <Avatar
                        src={item.thumbnailUrl}
                        variant="rounded"
                        sx={{ width: 36, height: 36, bgcolor: "grey.100" }}
                      >
                        <ImageIcon fontSize="small" sx={{ color: "grey.400" }} />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={item.name}
                      secondary={item.description || undefined}
                      primaryTypographyProps={{ variant: "body2" }}
                      secondaryTypographyProps={{ variant: "caption" }}
                    />
                  </ListItemButton>
                ))}
              </List>
            ) : query ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1, textAlign: "center" }}>
                No {levelPluralName.toLowerCase()} found matching &quot;{query}&quot;
              </Typography>
            ) : null}
          </Stack>
        </Collapse>

        {/* Add new section */}
        <Box
          onClick={() => setCreateExpanded(!createExpanded)}
          sx={{ ...SECTION_HEADER_SX, borderTop: "1px solid #C8C4BB" }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: "0.8rem", color: "#ffffff", letterSpacing: "0.08em" }}>
            ADD NEW {levelSingularName.toUpperCase()}
          </Typography>
          {createExpanded
            ? <ExpandLessIcon sx={{ color: "#ffffff", fontSize: 20 }} />
            : <ExpandMoreIcon sx={{ color: "#ffffff", fontSize: 20 }} />}
        </Box>
        <Collapse in={createExpanded}>
          <Stack spacing={2} sx={{ p: 2 }}>
            <TextField
              label="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              fullWidth
              required
              size="small"
            />
            <TextField
              label="Description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              fullWidth
              multiline
              minRows={2}
              size="small"
              inputProps={{ maxLength: 300 }}
              helperText={`${newDescription.length} / 300`}
            />
            <Box>
              <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
                Thumbnail
              </Typography>
              {!newThumbnailDataUrl ? (
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <IconButton onClick={() => fileInputRef.current?.click()} sx={UPLOAD_BTN_SX}>
                    <AddIcon />
                  </IconButton>
                  <Typography variant="caption" color="text.secondary">
                    JPEG, PNG, or GIF · max 700 KB
                  </Typography>
                </Stack>
              ) : (
                <Box sx={{ position: "relative", display: "inline-block" }}>
                  <Box
                    component="img"
                    src={newThumbnailDataUrl}
                    alt="Thumbnail preview"
                    sx={{ width: 64, height: 64, objectFit: "cover", borderRadius: 1, border: "1px solid", borderColor: "divider", display: "block" }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => setNewThumbnailDataUrl("")}
                    sx={{ position: "absolute", top: -6, right: -6, bgcolor: "rgba(255,255,255,0.9)", "&:hover": { bgcolor: "#fff" }, width: 20, height: 20, fontSize: "0.65rem" }}
                  >
                    ✕
                  </IconButton>
                </Box>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif"
                style={{ display: "none" }}
                onChange={(e) => void handleFileChange(e)}
              />
              {imageError && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {imageError}
                </Alert>
              )}
            </Box>
          </Stack>
        </Collapse>

      </DialogContent>

      <DialogActions sx={DIALOG_ACTIONS_SX}>
        <Button onClick={onClose} disabled={loading} sx={CANCEL_BTN_SX}>
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={loading || !newName.trim()}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
          sx={PRIMARY_BTN_SX}
        >
          Create &amp; Link
        </Button>
      </DialogActions>
    </Dialog>
  );
}
