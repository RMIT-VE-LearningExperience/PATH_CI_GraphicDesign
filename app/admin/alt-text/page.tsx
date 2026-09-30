"use client";

import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  AutoAwesome as AutoAwesomeIcon,
  Replay as ReplayIcon,
  Save as SaveIcon,
  WarningAmber as WarningAmberIcon,
} from "@mui/icons-material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../../auth-provider";
import { getAuthInstance } from "../../../lib/firebase-client";
import type { AltTextEntry, TutorialState } from "../../../lib/tutorial-store";
import type { AltTextProposal, SkippedImage } from "../../../lib/alt-text-review";

const TEAL = "#000054";
const GENERATE_BATCH_SIZE = 8;

type Row = {
  key: string; // unique image key matching the review API: "item:<levelId>:<itemId>" / "step:<parentItemId>:<stepId>"
  kind: "item-thumbnail" | "step-image";
  levelId?: string;
  itemId?: string;
  parentItemId?: string;
  stepId?: string;
  location: string;
  imageUrl: string;
  currentAlt?: string;
  draftAlt: string;
  touched: boolean;
  valNote?: string;
};

function buildRows(state: TutorialState): Row[] {
  const rows: Row[] = [];
  const levels = state.hierarchy.levels
    .filter((l) => l.enabled)
    .sort((a, b) => a.order - b.order);
  const lastLevel = levels[levels.length - 1];

  for (const level of levels) {
    for (const item of state.items[level.id] ?? []) {
      if (!item.thumbnailUrl) continue;
      rows.push({
        key: `item:${level.id}:${item.id}`,
        kind: "item-thumbnail",
        levelId: level.id,
        itemId: item.id,
        location: `${level.name} → ${item.name}`,
        imageUrl: item.thumbnailUrl,
        currentAlt: item.thumbnailAlt,
        draftAlt: item.thumbnailAlt ?? "",
        touched: false,
      });
    }
  }

  if (lastLevel) {
    const lastLevelItems = new Map(
      (state.items[lastLevel.id] ?? []).map((item) => [item.id, item]),
    );
    for (const [parentItemId, steps] of Object.entries(state.steps)) {
      const parent = lastLevelItems.get(parentItemId);
      steps.forEach((step, index) => {
        if (!step.imageUrl) return;
        rows.push({
          key: `step:${parentItemId}:${step.id}`,
          kind: "step-image",
          parentItemId,
          stepId: step.id,
          location: `${parent?.name ?? parentItemId} → Step ${index + 1}: ${step.title}`,
          imageUrl: step.imageUrl,
          currentAlt: step.imageAlt,
          draftAlt: step.imageAlt ?? "",
          touched: false,
        });
      });
    }
  }

  return rows;
}

export default function AltTextPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"all" | "item-thumbnail" | "step-image">("all");
  const [missingOnly, setMissingOnly] = useState(false);
  const [generating, setGenerating] = useState<{ done: number; total: number } | null>(null);
  const [applying, setApplying] = useState(false);
  // Each admin supplies their own VAL key; kept in this browser only and
  // sent per-request — the server never stores it
  const [valApiKey, setValApiKey] = useState("");

  useEffect(() => {
    try {
      setValApiKey(window.localStorage.getItem("valApiKey") ?? "");
    } catch {
      // Private browsing: no remembered key
    }
  }, []);
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" | "warning" } | null>(null);

  const getAuthToken = useCallback(async (): Promise<string> => {
    try {
      const auth = getAuthInstance();
      return (await auth.currentUser?.getIdToken()) ?? "";
    } catch {
      return "";
    }
  }, []);

  const loadState = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const res = await fetch("/api/tutorial", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { state?: TutorialState; error?: string };
      if (!res.ok || !data.state) {
        setToast({ message: data.error ?? "Failed to load content", severity: "error" });
        return;
      }
      setRows(buildRows(data.state));
    } catch {
      setToast({ message: "Failed to load content", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    void loadState();
  }, [authLoading, user, router, loadState]);

  const visibleRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (tab === "all" || row.kind === tab) &&
          (!missingOnly || row.currentAlt === undefined),
      ),
    [rows, tab, missingOnly],
  );

  const dirtyRows = useMemo(() => rows.filter((row) => row.touched), [rows]);
  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((row) => selected.has(row.key));

  function updateValApiKey(value: string) {
    setValApiKey(value);
    try {
      if (value) window.localStorage.setItem("valApiKey", value);
      else window.localStorage.removeItem("valApiKey");
    } catch {
      // Private browsing: key still works for this visit, just not remembered
    }
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function toggleSelected(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleRows.forEach((row) => next.delete(row.key));
      else visibleRows.forEach((row) => next.add(row.key));
      return next;
    });
  }

  // ── VAL generation ────────────────────────────────────────────────────

  const generateForIds = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0 || generating) return;
      setGenerating({ done: 0, total: ids.length });
      const token = await getAuthToken();
      let skippedCount = 0;

      try {
        for (let i = 0; i < ids.length; i += GENERATE_BATCH_SIZE) {
          const batch = ids.slice(i, i + GENERATE_BATCH_SIZE);
          const res = await fetch("/api/alt-text", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              ...(valApiKey.trim() ? { "X-VAL-API-Key": valApiKey.trim() } : {}),
            },
            body: JSON.stringify({ ids: batch }),
          });
          const data = (await res.json()) as {
            proposals?: AltTextProposal[];
            skipped?: SkippedImage[];
            error?: string;
          };
          if (!res.ok) {
            setToast({ message: data.error ?? "VAL request failed", severity: "error" });
            return;
          }

          setRows((prev) =>
            prev.map((row) => {
              const proposal = data.proposals?.find((p) => p.key === row.key);
              if (!proposal) return row;
              return {
                ...row,
                draftAlt: proposal.proposedAlt,
                // A proposal for a never-reviewed image is always a change:
                // saving "" records the "decorative" decision explicitly
                touched: row.currentAlt === undefined || proposal.proposedAlt !== row.currentAlt,
                valNote: proposal.needsAttention,
              };
            }),
          );
          skippedCount += data.skipped?.length ?? 0;
          setGenerating({ done: Math.min(i + batch.length, ids.length), total: ids.length });
        }

        setToast(
          skippedCount > 0
            ? { message: `Done, but ${skippedCount} image(s) could not be reviewed`, severity: "warning" }
            : { message: "VAL proposals generated", severity: "success" },
        );
      } catch {
        setToast({ message: "VAL request failed", severity: "error" });
      } finally {
        setGenerating(null);
      }
    },
    [generating, getAuthToken, valApiKey],
  );

  // ── Apply ─────────────────────────────────────────────────────────────

  async function applyChanges() {
    if (dirtyRows.length === 0 || applying) return;
    setApplying(true);
    try {
      const entries: AltTextEntry[] = dirtyRows.map((row) =>
        row.kind === "item-thumbnail"
          ? { kind: "item-thumbnail", levelId: row.levelId!, itemId: row.itemId!, alt: row.draftAlt.trim() }
          : { kind: "step-image", parentItemId: row.parentItemId!, stepId: row.stepId!, alt: row.draftAlt.trim() },
      );
      const token = await getAuthToken();
      const res = await fetch("/api/tutorial", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "applyAltText", payload: { entries } }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setToast({ message: data.error ?? "Failed to save alt text", severity: "error" });
        return;
      }
      setRows((prev) =>
        prev.map((row) =>
          row.touched ? { ...row, currentAlt: row.draftAlt.trim(), draftAlt: row.draftAlt.trim(), touched: false } : row,
        ),
      );
      setToast({ message: `Saved alt text for ${entries.length} image(s)`, severity: "success" });
    } catch {
      setToast({ message: "Failed to save alt text", severity: "error" });
    } finally {
      setApplying(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <Box role="status" sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <CircularProgress sx={{ color: TEAL }} aria-label="Loading images" />
      </Box>
    );
  }

  return (
    <Box component="main" sx={{ minHeight: "100vh", bgcolor: "#f2f2f2" }}>
      {/* Header */}
      <Box
        component="header"
        sx={{
          position: "sticky", top: 0, zIndex: 10,
          bgcolor: "#45443F", color: "#E5E1D7",
          px: 3, py: 1.5,
          display: "flex", alignItems: "center", gap: 2,
        }}
      >
        <IconButton onClick={() => router.push("/admin")} sx={{ color: "inherit" }} aria-label="Back to dashboard">
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" component="h1" sx={{ lineHeight: 1.2 }}>Image Alt Text</Typography>
          <Typography variant="caption" sx={{ opacity: 0.85 }}>
            Bulk review with RMIT VAL · edit and apply alt tags across all content images
          </Typography>
        </Box>
        <Tooltip title="Your personal VAL API key — used only for your requests, remembered in this browser only">
          <TextField
            size="small"
            type="password"
            label="VAL API key"
            value={valApiKey}
            onChange={(e) => updateValApiKey(e.target.value)}
            autoComplete="off"
            sx={{
              width: 190,
              "& .MuiInputBase-input": { color: "#E5E1D7" },
              "& .MuiOutlinedInput-root": {
                "& fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                "&:hover fieldset": { borderColor: "rgba(255,255,255,0.45)" },
                "&.Mui-focused fieldset": { borderColor: TEAL },
              },
              "& .MuiInputLabel-root": {
                color: "rgba(255,255,255,0.6)",
                "&.Mui-focused": { color: TEAL },
              },
            }}
          />
        </Tooltip>
        <Button
          variant="outlined"
          startIcon={generating ? <CircularProgress size={16} sx={{ color: "inherit" }} /> : <AutoAwesomeIcon />}
          disabled={selected.size === 0 || !!generating || applying}
          onClick={() => void generateForIds(rows.filter((r) => selected.has(r.key)).map((r) => r.key))}
          sx={{ color: "#E5E1D7", borderColor: "rgba(255,255,255,0.3)", textTransform: "none" }}
        >
          {generating
            ? `Generating ${generating.done}/${generating.total}…`
            : `Generate with VAL (${selected.size})`}
        </Button>
        <Button
          variant="contained"
          startIcon={applying ? <CircularProgress size={16} sx={{ color: "inherit" }} /> : <SaveIcon />}
          disabled={dirtyRows.length === 0 || applying || !!generating}
          onClick={() => void applyChanges()}
          sx={{ bgcolor: TEAL, "&:hover": { bgcolor: "#00003f" }, textTransform: "none" }}
        >
          Apply {dirtyRows.length > 0 ? `${dirtyRows.length} change(s)` : "changes"}
        </Button>
      </Box>

      {generating && <LinearProgress aria-label="Alt text generation progress" sx={{ "& .MuiLinearProgress-bar": { bgcolor: TEAL } }} variant="determinate" value={(generating.done / generating.total) * 100} />}

      {/* Filters */}
      <Box sx={{ px: 3, pt: 1, display: "flex", alignItems: "center", gap: 2, borderBottom: "1px solid #E3DFD5", bgcolor: "#FFF" }}>
        <Tabs aria-label="Filter images by type" value={tab} onChange={(_, v: typeof tab) => setTab(v)} sx={{ "& .Mui-selected": { color: `${TEAL} !important` }, "& .MuiTabs-indicator": { bgcolor: TEAL } }}>
          <Tab value="all" label={`All (${rows.length})`} sx={{ textTransform: "none" }} />
          <Tab value="item-thumbnail" label={`Thumbnails (${rows.filter((r) => r.kind === "item-thumbnail").length})`} sx={{ textTransform: "none" }} />
          <Tab value="step-image" label={`Step images (${rows.filter((r) => r.kind === "step-image").length})`} sx={{ textTransform: "none" }} />
        </Tabs>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          onClick={() => setMissingOnly((v) => !v)}
          aria-pressed={missingOnly}
          variant={missingOnly ? "contained" : "text"}
          sx={{
            textTransform: "none",
            ...(missingOnly ? { bgcolor: TEAL, "&:hover": { bgcolor: "#00003f" } } : { color: TEAL }),
          }}
        >
          Missing alt only ({rows.filter((r) => r.currentAlt === undefined).length})
        </Button>
      </Box>

      {/* Table */}
      <Box sx={{ p: 3 }}>
        {/* Header row */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, px: 2, pb: 1, color: "#62615C", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
          <Checkbox
            size="small"
            checked={allVisibleSelected}
            indeterminate={!allVisibleSelected && visibleRows.some((row) => selected.has(row.key))}
            onChange={toggleSelectAllVisible}
            inputProps={{ "aria-label": "Select all visible images" }}
            sx={{ "&.Mui-checked, &.MuiCheckbox-indeterminate": { color: TEAL } }}
          />
          <Box sx={{ width: 96 }}>Image</Box>
          <Box sx={{ flex: 1.2 }}>Location</Box>
          <Box sx={{ flex: 2 }}>Alt text</Box>
          <Box sx={{ width: 76 }} />
        </Box>

        <Stack component="ul" spacing={1} sx={{ listStyle: "none", m: 0, p: 0 }}>
          {visibleRows.map((row) => (
            <Box
              component="li"
              key={row.key}
              sx={{
                display: "flex", alignItems: "center", gap: 2,
                bgcolor: "#FFF", borderRadius: 2, px: 2, py: 1.5,
                border: "1px solid",
                borderColor: row.touched ? TEAL : "#E3DFD5",
              }}
            >
              <Checkbox
                size="small"
                checked={selected.has(row.key)}
                onChange={() => toggleSelected(row.key)}
                inputProps={{ "aria-label": `Select ${row.location}` }}
                sx={{ "&.Mui-checked": { color: TEAL } }}
              />
              <Box
                component="a"
                href={row.imageUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`View full-size image: ${row.location} (opens in a new tab)`}
                sx={{ width: 96, height: 64, flexShrink: 0, borderRadius: 1, overflow: "hidden", bgcolor: "#EDE9DF", display: "block" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={row.imageUrl}
                  alt=""
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </Box>
              <Box sx={{ flex: 1.2, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, overflowWrap: "break-word" }}>
                  {row.location}
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: "wrap" }}>
                  <Chip
                    size="small"
                    label={row.kind === "item-thumbnail" ? "Thumbnail" : "Step image"}
                    sx={{ fontSize: "0.65rem", height: 20 }}
                  />
                  {row.currentAlt === undefined ? (
                    <Chip size="small" label="No alt set" variant="outlined" sx={{ fontSize: "0.65rem", height: 20, color: "#7A5C00", borderColor: "#7A5C00" }} />
                  ) : row.currentAlt === "" ? (
                    <Chip size="small" label="Decorative" variant="outlined" sx={{ fontSize: "0.65rem", height: 20 }} />
                  ) : null}
                  {row.touched && (
                    <Chip size="small" label="Unsaved" sx={{ fontSize: "0.65rem", height: 20, bgcolor: TEAL, color: "#FFF" }} />
                  )}
                </Stack>
              </Box>
              <Box sx={{ flex: 2, display: "flex", flexDirection: "column", gap: 0.5 }}>
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  maxRows={3}
                  placeholder="Empty = decorative image"
                  value={row.draftAlt}
                  inputProps={{ "aria-label": `Alt text for ${row.location}` }}
                  onChange={(e) => updateRow(row.key, { draftAlt: e.target.value, touched: true })}
                  sx={{ "& .MuiOutlinedInput-root.Mui-focused fieldset": { borderColor: TEAL } }}
                />
                {row.valNote && (
                  <Typography variant="caption" sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, color: "#7A5C00" }}>
                    <WarningAmberIcon aria-hidden="true" sx={{ fontSize: 16, mt: "1px" }} />
                    <span><strong>VAL note:</strong> {row.valNote}</span>
                  </Typography>
                )}
              </Box>
              <Stack direction="row" sx={{ width: 76, justifyContent: "flex-end" }}>
                <Tooltip title="Generate with VAL">
                  <span>
                    <IconButton
                      size="small"
                      disabled={!!generating || applying}
                      aria-label={`Generate alt text with VAL for ${row.location}`}
                      onClick={() => void generateForIds([row.key])}
                      sx={{ color: TEAL }}
                    >
                      <AutoAwesomeIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Reset to saved value">
                  <span>
                    <IconButton
                      size="small"
                      disabled={!row.touched}
                      aria-label={`Reset alt text to saved value for ${row.location}`}
                      onClick={() => updateRow(row.key, { draftAlt: row.currentAlt ?? "", touched: false, valNote: undefined })}
                    >
                      <ReplayIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Box>
          ))}

          {visibleRows.length === 0 && (
            <Typography variant="body2" sx={{ textAlign: "center", py: 6, color: "#62615C" }}>
              No images match the current filter.
            </Typography>
          )}
        </Stack>
      </Box>

      <Snackbar
        open={!!toast}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={toast?.severity ?? "info"} onClose={() => setToast(null)} variant="filled">
          {toast?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
