"use client";

import {
  Alert,
  Avatar,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  Link,
  ListSubheader,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Check as CheckIcon,
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIndicatorIcon,
  Equalizer as EqualizerIcon,
  Image as ImageIcon,
  Logout as LogoutIcon,
  MoreVert as MoreVertIcon,
  QrCode2 as QrCodeIcon,
  Restore as RestoreIcon,
  Save as SaveIcon,
  SettingsEthernet as SettingsEthernetIcon,
} from "@mui/icons-material";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-provider";
import { getAuthInstance } from "../../lib/firebase-client";
import type { Item, Level, RelationshipEntry, Step, TutorialState } from "../../lib/tutorial-store";

import Sidebar from "./Sidebar";
import AddEditItemDialog from "./dialogs/AddEditItemDialog";
import AddEditStepDialog from "./dialogs/AddEditStepDialog";
import SearchLinkDialog from "./dialogs/SearchLinkDialog";
import ConfirmDeleteDialog from "./dialogs/ConfirmDeleteDialog";
import InfoDialog from "./dialogs/InfoDialog";
import CopyLinkDialog from "./dialogs/CopyLinkDialog";
import QRCodeDialog from "./dialogs/QRCodeDialog";
import EmbedDialog from "./dialogs/EmbedDialog";
import StatsModal from "./dialogs/StatsModal";

// ── Helper ────────────────────────────────────────────────────────────

function getVideoEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vi = url.match(/vimeo\.com\/(\d+)/);
  if (vi) return `https://player.vimeo.com/video/${vi[1]}`;
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return url;
  return null;
}

// ── Types ─────────────────────────────────────────────────────────────

type NavEntry = { levelId: string; itemId: string; itemName: string };

type DeleteTarget =
  | { kind: "item"; levelId: string; itemId: string; name: string }
  | { kind: "unlink"; parentLevelId: string; parentItemId: string; parentKey: string; childItemId: string; childLevelId: string; name: string }
  | { kind: "step"; parentItemId: string; stepId: string; name: string }
  | { kind: "deletedBinItem"; deletedItemId: string; name: string };

type MenuTarget = {
  anchorEl: HTMLElement;
  type: "item" | "step";
  id: string;
  extra?: string;
  item?: Item;
  step?: Step;
};

// ── Section Settings ──────────────────────────────────────────────────

function SectionSettings({
  level,
  onSave,
  saving,
  saved,
  onAdd,
}: {
  level: Level;
  onSave: (levelId: string, title: string, subtitle: string) => void;
  saving: boolean;
  saved: boolean;
  onAdd: () => void;
}) {
  const [title, setTitle] = useState(level.sectionTitle ?? "");
  const [subtitle, setSubtitle] = useState(level.sectionSubtitle ?? "");
  const savedTitle = useRef(level.sectionTitle ?? "");
  const savedSubtitle = useRef(level.sectionSubtitle ?? "");

  useEffect(() => {
    setTitle(level.sectionTitle ?? "");
    setSubtitle(level.sectionSubtitle ?? "");
    savedTitle.current = level.sectionTitle ?? "";
    savedSubtitle.current = level.sectionSubtitle ?? "";
  }, [level.sectionTitle, level.sectionSubtitle]);

  const dirty =
    title !== (level.sectionTitle ?? "") || subtitle !== (level.sectionSubtitle ?? "");

  return (
    <Box sx={{ mb: 3 }}>
      <TextField
        label="Section Title"
        size="small"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        inputProps={{ maxLength: 50 }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <Typography variant="caption" color="text.secondary">{title.length}/50</Typography>
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2, minWidth: 260, maxWidth: "50%" }}
      />
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <TextField
          label="Subtitle"
          size="small"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          inputProps={{ maxLength: 100 }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Typography variant="caption" color="text.secondary">{subtitle.length}/100</Typography>
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 260, maxWidth: "50%" }}
        />
        <Button
          variant="contained"
          onClick={onAdd}
          sx={{
            bgcolor: "#3D8078", color: "#fff", fontWeight: 600,
            textTransform: "none", whiteSpace: "nowrap",
            "&:hover": { bgcolor: "#2D6059" },
          }}
        >
          + Add {level.singularName}
        </Button>
      </Box>
      {(dirty || saving || saved) && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
          {saving ? (
            <CircularProgress size={16} sx={{ color: "#3D8078" }} />
          ) : saved ? (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <CheckIcon sx={{ fontSize: 16, color: "#1A7A2E" }} />
              <Typography variant="caption" sx={{ color: "#1A7A2E" }}>Saved</Typography>
            </Stack>
          ) : (
            <>
              <Button
                size="small"
                variant="contained"
                onClick={() => onSave(level.id, title, subtitle)}
                startIcon={<SaveIcon sx={{ fontSize: "14px !important" }} />}
                sx={{ fontSize: "0.7rem", py: 0.4, px: 1, minWidth: 0, bgcolor: "#3D8078", "&:hover": { bgcolor: "#2D6059" }, textTransform: "none" }}
              >
                Save
              </Button>
              <Button
                size="small"
                variant="text"
                onClick={() => { setTitle(savedTitle.current); setSubtitle(savedSubtitle.current); }}
                sx={{ fontSize: "0.7rem", py: 0.4, px: 1, minWidth: 0, color: "text.secondary", textTransform: "none" }}
              >
                Cancel
              </Button>
            </>
          )}
        </Stack>
      )}
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [state, setState] = useState<TutorialState | null>(null);
  const [loading, setLoading] = useState(true);
  const [navStack, setNavStack] = useState<NavEntry[]>([]);
  const [globalListLevelId, setGlobalListLevelId] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  // Dialog state
  const [itemDialog, setItemDialog] = useState<{
    mode: "add" | "edit";
    levelId: string;
    item?: Item;
    isGlobalList?: boolean;
  } | null>(null);
  const [searchDialog, setSearchDialog] = useState<{
    levelId: string;
    parentLevelId: string;
    parentItemId: string;
    parentKey: string;
  } | null>(null);
  const [stepDialog, setStepDialog] = useState<{
    mode: "add" | "edit";
    parentItemId: string;
    step?: Step;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [infoOpen, setInfoOpen] = useState<{ item: Item | Step; isStep?: boolean } | null>(null);
  const [copyLinkTarget, setCopyLinkTarget] = useState<{ itemName: string; url: string } | null>(null);
  const [qrTarget, setQrTarget] = useState<{ itemName: string; url: string } | null>(null);
  const [embedTarget, setEmbedTarget] = useState<{ itemName: string; url: string } | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);

  // Loading / feedback
  const [actionLoading, setActionLoading] = useState(false);
  const [homepageSaving, setHomepageSaving] = useState(false);
  const [homepageSaved, setHomepageSaved] = useState(false);
  const [headingSaving, setHeadingSaving] = useState<string | null>(null);
  const [headingSaved, setHeadingSaved] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sortColumn, setSortColumn] = useState<"name" | "lastEdited" | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  function handleSortClick(col: "name" | "lastEdited") {
    if (sortColumn === col) {
      if (sortAsc) { setSortAsc(false); }
      else { setSortColumn(null); setSortAsc(true); }
    } else {
      setSortColumn(col);
      setSortAsc(true);
    }
  }

  // Deleted items filter
  const [deletedNameFilter, setDeletedNameFilter] = useState("");
  const [deletedTypeFilter, setDeletedTypeFilter] = useState("");
  const [deletedFromDate, setDeletedFromDate] = useState("");
  const [deletedToDate, setDeletedToDate] = useState("");

  // Global list filter
  const [globalListNameFilter, setGlobalListNameFilter] = useState("");
  const [globalListContextFilter, setGlobalListContextFilter] = useState("");

  // Alerts
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showAlert(text: string, severity: "success" | "error" = "success") {
    if (severity === "error") {
      setError(text);
      setSuccess(null);
    } else {
      setSuccess(text);
      setError(null);
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSuccess(null), 3000);
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────

  const activeLevels = useMemo(
    () =>
      (state?.hierarchy.levels ?? [])
        .filter((l) => l.enabled)
        .sort((a, b) => a.order - b.order),
    [state],
  );

  const atSteps = navStack.length === activeLevels.length && activeLevels.length > 0;
  const currentLevel: Level | undefined = atSteps ? undefined : activeLevels[navStack.length];
  const parentEntry = navStack.length > 0 ? navStack[navStack.length - 1] : null;
  const parentLevel: Level | undefined =
    navStack.length > 0 ? activeLevels[navStack.length - 1] : undefined;

  // Composite relationship key for the current parent context.
  // At depth 2+ includes the grandparent ID so each ancestor path has its own
  // independent child collection.
  const parentKey = useMemo((): string => {
    if (!parentEntry) return "";
    if (navStack.length < 2) return parentEntry.itemId;
    return `${navStack[navStack.length - 2].itemId}:${parentEntry.itemId}`;
  }, [navStack, parentEntry]);

  const currentItems = useMemo((): Item[] => {
    if (!state || !currentLevel) return [];
    const all = state.items[currentLevel.id] ?? [];
    const source =
      navStack.length === 0
        ? all
        : (() => {
            const rels = state.relationships[parentLevel!.id]?.[parentKey] ?? [];
            const linked = new Set(rels.map((r) => r.childItemId));
            return all.filter((i) => linked.has(i.id));
          })();
    if (sortColumn === "name") {
      const s = [...source].sort((a, b) => a.name.localeCompare(b.name));
      return sortAsc ? s : s.reverse();
    }
    if (sortColumn === "lastEdited") {
      const s = [...source].sort((a, b) => {
        const aT = a.lastModified ? new Date(a.lastModified).getTime() : 0;
        const bT = b.lastModified ? new Date(b.lastModified).getTime() : 0;
        return aT - bT;
      });
      return sortAsc ? s : s.reverse();
    }
    return source;
  }, [state, currentLevel, navStack, parentLevel, parentKey, sortColumn, sortAsc]);

  const currentSteps = useMemo((): Step[] => {
    if (!state || !atSteps || !parentEntry) return [];
    return state.steps[parentEntry.itemId] ?? [];
  }, [state, atSteps, parentEntry]);

  const globalListItems = useMemo((): Item[] => {
    if (!state || !globalListLevelId) return [];
    const items = state.items[globalListLevelId] ?? [];
    if (sortColumn === "name") {
      const s = [...items].sort((a, b) => a.name.localeCompare(b.name));
      return sortAsc ? s : s.reverse();
    }
    if (sortColumn === "lastEdited") {
      const s = [...items].sort((a, b) => {
        const aT = a.lastModified ? new Date(a.lastModified).getTime() : 0;
        const bT = b.lastModified ? new Date(b.lastModified).getTime() : 0;
        return aT - bT;
      });
      return sortAsc ? s : s.reverse();
    }
    return items;
  }, [state, globalListLevelId, sortColumn, sortAsc]);

  // For each item in the global list, resolve its parent/grandparent context.
  // parents  = immediate parents (e.g. level 1 items for level 2 items)
  // grandparents = two levels up (e.g. level 1 items for level 3 items)
  // Composite keys (e.g. "parentId:childId") are decoded by splitting on ":"
  // so the true parent/grandparent IDs can be looked up by name.
  type ParentEntry = { parents: { id: string; name: string }[]; grandparents: { id: string; name: string }[] };
  const globalListParentInfo = useMemo((): Record<string, ParentEntry> => {
    if (!state || !globalListLevelId) return {};
    const levelIndex = activeLevels.findIndex((l) => l.id === globalListLevelId);
    if (levelIndex <= 0) return {};

    const result: Record<string, ParentEntry> = {};
    const parentLvl = activeLevels[levelIndex - 1];
    const grandparentLvl = levelIndex > 1 ? activeLevels[levelIndex - 2] : null;

    // Keys in relationships[parentLvl.id] may be composite ("grandparentId:parentId").
    // Extract the actual parent item ID from the last segment.
    const parentRels = state.relationships[parentLvl.id] ?? {};
    Object.entries(parentRels).forEach(([compositeKey, children]) => {
      const segments = compositeKey.split(":");
      const actualParentId = segments[segments.length - 1];
      const grandparentId = segments.length >= 2 ? segments[segments.length - 2] : null;

      const parentItem = (state.items[parentLvl.id] ?? []).find((i) => i.id === actualParentId);
      if (!parentItem) return;

      children.forEach((rel) => {
        if (!result[rel.childItemId]) result[rel.childItemId] = { parents: [], grandparents: [] };
        if (!result[rel.childItemId].parents.some((p) => p.id === actualParentId))
          result[rel.childItemId].parents.push({ id: actualParentId, name: parentItem.name });

        // Derive grandparent directly from the composite key (accurate even when
        // multiple grandparents share the same parent).
        if (grandparentId && grandparentLvl) {
          const gpItem = (state.items[grandparentLvl.id] ?? []).find((i) => i.id === grandparentId);
          if (gpItem && !result[rel.childItemId].grandparents.some((gp) => gp.id === grandparentId))
            result[rel.childItemId].grandparents.push({ id: grandparentId, name: gpItem.name });
        }
      });
    });

    return result;
  }, [state, globalListLevelId, activeLevels]);

  // ── Auth token ────────────────────────────────────────────────────────

  const getAuthToken = useCallback(async (): Promise<string> => {
    try {
      const auth = getAuthInstance();
      return (await auth.currentUser?.getIdToken()) ?? "";
    } catch {
      return "";
    }
  }, []);

  // ── API dispatch ──────────────────────────────────────────────────────

  const dispatch = useCallback(
    async (action: string, payload: object): Promise<TutorialState | null> => {
      try {
        setActionLoading(true);
        const token = await getAuthToken();
        const res = await fetch("/api/tutorial", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action, payload }),
        });
        const data = (await res.json()) as { state?: TutorialState; error?: string };
        if (!res.ok) {
          showAlert(data.error ?? "Action failed", "error");
          return null;
        }
        setState(data.state ?? null);
        return data.state ?? null;
      } catch {
        showAlert("Network error", "error");
        return null;
      } finally {
        setActionLoading(false);
      }
    },
    [getAuthToken],
  );

  // ── Initial load ──────────────────────────────────────────────────────

  const loadState = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const res = await fetch("/api/tutorial", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { state: TutorialState };
      setState(data.state);
    } catch {
      showAlert("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    void loadState();
  }, [authLoading, user, router, loadState]);

  // ── Navigation ────────────────────────────────────────────────────────

  function handleNavigate(item: Item, levelId: string) {
    setNavStack((prev) => [...prev, { levelId, itemId: item.id, itemName: item.name }]);
    setGlobalListLevelId(null);
    setShowDeleted(false);
    setSortColumn(null); setSortAsc(true);
    setExpandedStepId(null);
  }

  function handleBreadcrumbNav(depth: number) {
    setNavStack((prev) => prev.slice(0, depth));
    setGlobalListLevelId(null);
    setShowDeleted(false);
    setSortColumn(null); setSortAsc(true);
    setExpandedStepId(null);
  }

  function handleGoHome() {
    setNavStack([]);
    setGlobalListLevelId(null);
    setShowDeleted(false);
    setSortColumn(null); setSortAsc(true);
    setExpandedStepId(null);
  }

  function handleGlobalList(levelId: string) {
    setGlobalListLevelId(levelId);
    setShowDeleted(false);
    setSortColumn(null); setSortAsc(true);
    setGlobalListNameFilter("");
    setGlobalListContextFilter("");
  }

  function handleShowDeleted() {
    setShowDeleted(true);
    setGlobalListLevelId(null);
  }

  // ── Publish toggle ────────────────────────────────────────────────────

  async function handlePublishToggle(item: Item, levelId: string) {
    if (navStack.length === 0 || globalListLevelId) {
      await dispatch("updateItem", { levelId, itemId: item.id, published: !item.published });
    } else {
      const rels = state!.relationships[parentLevel!.id]?.[parentKey] ?? [];
      const rel = rels.find((r) => r.childItemId === item.id);
      await dispatch("updateRelationship", {
        parentLevelId: parentLevel!.id,
        parentItemId: parentKey,
        childItemId: item.id,
        published: !rel?.published,
      });
    }
  }

  function getItemPublished(item: Item): boolean {
    if (navStack.length === 0 || globalListLevelId) return item.published;
    const rels = state?.relationships[parentLevel!.id]?.[parentKey] ?? [];
    return rels.find((r) => r.childItemId === item.id)?.published ?? false;
  }

  // ── Item CRUD ─────────────────────────────────────────────────────────

  async function handleSaveItem(data: { name: string; description: string; thumbnailDataUrl: string }) {
    if (!itemDialog) return;
    const { mode, levelId, item, isGlobalList } = itemDialog;

    if (mode === "edit" && item) {
      const ns = await dispatch("updateItem", {
        levelId, itemId: item.id, name: data.name,
        description: data.description, thumbnailDataUrl: data.thumbnailDataUrl,
      });
      if (ns) { setItemDialog(null); showAlert("Saved"); }
    } else {
      const prevIds = new Set((state?.items[levelId] ?? []).map((i) => i.id));
      const ns = await dispatch("addItem", {
        levelId, name: data.name,
        description: data.description, thumbnailDataUrl: data.thumbnailDataUrl,
      });
      if (!ns) return;
      if (!isGlobalList && navStack.length > 0 && parentEntry && parentLevel) {
        const newItem = (ns.items[levelId] ?? []).find((i) => !prevIds.has(i.id));
        if (newItem) {
          await dispatch("linkItem", {
            parentLevelId: parentLevel.id, parentItemId: parentKey,
            childLevelId: levelId, childItemId: newItem.id,
          });
        }
      }
      setItemDialog(null);
      showAlert("Added");
    }
  }

  async function handleLink(childItemId: string) {
    if (!searchDialog) return;
    const ns = await dispatch("linkItem", {
      parentLevelId: searchDialog.parentLevelId, parentItemId: searchDialog.parentKey,
      childLevelId: searchDialog.levelId, childItemId,
    });
    if (ns) { setSearchDialog(null); showAlert("Linked"); }
  }

  async function handleCreateAndLink(data: { name: string; description: string; thumbnailDataUrl: string }) {
    if (!searchDialog) return;
    const prevIds = new Set((state?.items[searchDialog.levelId] ?? []).map((i) => i.id));
    const ns = await dispatch("addItem", {
      levelId: searchDialog.levelId, name: data.name,
      description: data.description, thumbnailDataUrl: data.thumbnailDataUrl,
    });
    if (!ns) return;
    const newItem = (ns.items[searchDialog.levelId] ?? []).find((i) => !prevIds.has(i.id));
    if (newItem) {
      const linked = await dispatch("linkItem", {
        parentLevelId: searchDialog.parentLevelId, parentItemId: searchDialog.parentKey,
        childLevelId: searchDialog.levelId, childItemId: newItem.id,
      });
      if (linked) { setSearchDialog(null); showAlert("Created and linked"); }
    }
  }

  // ── Step CRUD ─────────────────────────────────────────────────────────

  async function handleSaveStep(data: { title: string; contentHtml: string; imageDataUrl: string; videoUrl: string }) {
    if (!stepDialog) return;
    const { mode, parentItemId, step } = stepDialog;
    if (mode === "edit" && step) {
      const ns = await dispatch("updateStep", {
        parentItemId, stepId: step.id, title: data.title,
        contentHtml: data.contentHtml, imageDataUrl: data.imageDataUrl, videoUrl: data.videoUrl,
      });
      if (ns) { setStepDialog(null); showAlert("Saved"); }
    } else {
      const ns = await dispatch("addStep", {
        parentItemId, title: data.title,
        contentHtml: data.contentHtml, imageDataUrl: data.imageDataUrl, videoUrl: data.videoUrl,
      });
      if (ns) { setStepDialog(null); showAlert("Step added"); }
    }
  }

  async function handleDragEnd(result: DropResult) {
    if (!result.destination || !parentEntry) return;
    if (result.source.index === result.destination.index) return;
    await dispatch("setStepOrder", {
      parentItemId: parentEntry.itemId,
      stepId: result.draggableId,
      newIndex: result.destination.index,
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    let ok = false;
    if (deleteTarget.kind === "item") {
      ok = !!(await dispatch("deleteItem", { levelId: deleteTarget.levelId, itemId: deleteTarget.itemId }));
    } else if (deleteTarget.kind === "unlink") {
      ok = !!(await dispatch("unlinkItem", {
        parentLevelId: deleteTarget.parentLevelId,
        parentItemId: deleteTarget.parentKey,
        childItemId: deleteTarget.childItemId,
      }));
    } else if (deleteTarget.kind === "step") {
      ok = !!(await dispatch("deleteStep", { parentItemId: deleteTarget.parentItemId, stepId: deleteTarget.stepId }));
    } else if (deleteTarget.kind === "deletedBinItem") {
      ok = !!(await dispatch("permanentlyDeleteItem", { deletedItemId: deleteTarget.deletedItemId }));
    }
    if (ok) { setDeleteTarget(null); showAlert("Deleted"); }
  }

  // ── Settings ──────────────────────────────────────────────────────────

  async function handleSaveHeading(levelId: string, title: string, subtitle: string) {
    setHeadingSaving(levelId);
    try {
      const ns = await dispatch("updateLevelSettings", { levelId, sectionTitle: title, sectionSubtitle: subtitle });
      if (ns) {
        setHeadingSaved(levelId);
        setTimeout(() => setHeadingSaved(null), 3000);
      }
    } finally {
      setHeadingSaving(null);
    }
  }

  async function handleSaveHomepage(title: string, description: string) {
    setHomepageSaving(true);
    try {
      const ns = await dispatch("updateHomepageSettings", { title, description });
      if (ns) {
        setHomepageSaved(true);
        setTimeout(() => setHomepageSaved(false), 3000);
      }
    } finally {
      setHomepageSaving(false);
    }
  }

  // ── Preview ───────────────────────────────────────────────────────────

  async function handlePreview() {
    setPreviewLoading(true);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/preview-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { token?: string };
      if (res.ok && data.token) {
        const url = new URL("/", window.location.origin);
        url.searchParams.set("previewToken", data.token);
        navStack.forEach((entry, i) => {
          url.searchParams.set(`l${i + 1}`, entry.itemId);
        });
        window.open(url.toString(), "_blank");
      } else {
        showAlert("Could not create preview token", "error");
      }
    } catch {
      showAlert("Preview failed", "error");
    } finally {
      setPreviewLoading(false);
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────

  function renderItemRow(item: Item, levelId: string, opts: { isGlobalList?: boolean }) {
    const published = getItemPublished(item);
    const features = state!.appSettings.features;
    const levelIndex = activeLevels.findIndex((l) => l.id === levelId);
    const pathParts: string[] = [];
    navStack.slice(0, levelIndex).forEach((entry) => {
      const slug = (state!.items[entry.levelId] ?? []).find((i) => i.id === entry.itemId)?.slug;
      pathParts.push(slug ?? entry.itemId);
    });
    pathParts.push(item.slug ?? item.id);
    const itemUrl = `${window.location.origin}/${pathParts.join("/")}`;
    const showShareTools = !opts.isGlobalList && (features.copyLink || features.qrCode || features.canvasEmbed);

    const parentInfo = opts.isGlobalList ? (globalListParentInfo[item.id] ?? { parents: [], grandparents: [] }) : null;

    return (
      <TableRow
        key={item.id}
        hover
        onClick={() => !opts.isGlobalList && handleNavigate(item, levelId)}
        sx={{
          cursor: opts.isGlobalList ? "default" : "pointer",
          borderBottom: "1px solid #E5E1D7",
          "&:hover": { bgcolor: "#E5E1D7" },
        }}
      >
        <TableCell sx={{ padding: "12px 16px" }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Avatar src={item.thumbnailUrl} variant="rounded" sx={{ width: 32, height: 32 }}>
              <ImageIcon sx={{ fontSize: 16, color: "grey.400" }} />
            </Avatar>
            <Typography variant="body2">{item.name}</Typography>
          </Stack>
        </TableCell>

        {/* Parent context columns — only in global list */}
        {parentInfo && levelIndex === 2 && (
          <TableCell sx={{ padding: "12px 16px" }}>
            {parentInfo.parents.length > 0
              ? parentInfo.parents.map((p) => (
                  <Typography key={p.id} variant="body2" color="text.secondary">{p.name}</Typography>
                ))
              : <Typography variant="body2" color="text.disabled">—</Typography>}
          </TableCell>
        )}
        {parentInfo && levelIndex >= 1 && (
          <TableCell sx={{ padding: "12px 16px" }}>
            {(levelIndex === 1 ? parentInfo.parents : parentInfo.grandparents).length > 0
              ? (levelIndex === 1 ? parentInfo.parents : parentInfo.grandparents).map((p) => (
                  <Link
                    key={p.id}
                    component="button"
                    variant="body2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNavStack([{ levelId: activeLevels[0].id, itemId: p.id, itemName: p.name }]);
                      setGlobalListLevelId(null);
                      setShowDeleted(false);
                    }}
                    sx={{ display: "block", textAlign: "left", color: "#3D8078" }}
                  >
                    {p.name}
                  </Link>
                ))
              : <Typography variant="body2" color="text.disabled">—</Typography>}
          </TableCell>
        )}

        <TableCell align="center" sx={{ padding: "4px 8px", width: showShareTools ? 196 : 52 }}>
          <Stack direction="row" alignItems="center" justifyContent="center">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setMenuTarget({ anchorEl: e.currentTarget, type: "item", id: item.id, extra: levelId, item });
              }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
            {showShareTools && features.copyLink && (
              <Tooltip title="Copy link">
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); setCopyLinkTarget({ itemName: item.name, url: itemUrl }); }}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {showShareTools && features.qrCode && (
              <Tooltip title="Download QR code">
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); setQrTarget({ itemName: item.name, url: itemUrl }); }}>
                  <QrCodeIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {showShareTools && features.canvasEmbed && (
              <Tooltip title="Embed in Canvas LMS">
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); setEmbedTarget({ itemName: item.name, url: itemUrl }); }}>
                  <SettingsEthernetIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </TableCell>

        <TableCell align="center" sx={{ padding: "12px 16px" }}>
          <Typography variant="body2" color="text.secondary">
            {item.lastModified
              ? new Date(item.lastModified).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })
              : "N/A"}
          </Typography>
        </TableCell>

        {!opts.isGlobalList && (
          <TableCell align="center" sx={{ padding: "4px 16px" }} onClick={(e) => e.stopPropagation()}>
            <Tooltip title={published ? "Deactivate" : "Activate"}>
              <Switch
                checked={published}
                onChange={() => void handlePublishToggle(item, levelId)}
                size="small"
                sx={{
                  "& .MuiSwitch-switchBase.Mui-checked": { color: "#135b22" },
                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#b3d3b9" },
                  "& .MuiSwitch-switchBase": { color: "#C4321A" },
                  "& .MuiSwitch-track": { bgcolor: "#efc9c2" },
                }}
              />
            </Tooltip>
          </TableCell>
        )}
      </TableRow>
    );
  }

  function renderItemTable(items: Item[], levelId: string, opts: { isGlobalList?: boolean } = {}) {
    const level = activeLevels.find((l) => l.id === levelId);
    const features = state!.appSettings.features;
    const showShareTools = !opts.isGlobalList && (features.copyLink || features.qrCode || features.canvasEmbed);
    const levelIndex = activeLevels.findIndex((l) => l.id === levelId);
    const showParentCols = opts.isGlobalList && levelIndex >= 1;
    // For level 2: 1 parent col (level 1 = "Active In")
    // For level 3: 2 parent cols (level 2 name, then level 1 = "Active In")
    const parentColCount = showParentCols ? (levelIndex === 2 ? 2 : 1) : 0;

    return (
      <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 1, overflow: "hidden", mb: 3 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: "#FDF9F1", borderBottom: "2px solid #E5E1D7" }}>
              <TableCell
                sx={{ fontWeight: 700, cursor: "pointer", userSelect: "none", color: "#45443F", fontSize: "0.95rem", padding: "16px" }}
                onClick={() => handleSortClick("name")}
              >
                {level?.singularName ?? "Name"}{sortColumn === "name" ? (sortAsc ? " ↑" : " ↓") : ""}
              </TableCell>
              {showParentCols && levelIndex === 2 && (
                <TableCell sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.95rem", padding: "16px" }}>
                  {activeLevels[levelIndex - 1]?.singularName ?? "Level 2"}
                </TableCell>
              )}
              {showParentCols && (
                <TableCell sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.95rem", padding: "16px" }}>
                  Active In
                </TableCell>
              )}
              <TableCell align="center" sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.95rem", padding: "16px", width: showShareTools ? 196 : 52 }} />
              <TableCell
                align="center"
                sx={{ fontWeight: 700, cursor: "pointer", userSelect: "none", color: "#45443F", fontSize: "0.95rem", padding: "16px" }}
                onClick={() => handleSortClick("lastEdited")}
              >
                Last Edited{sortColumn === "lastEdited" ? (sortAsc ? " ↑" : " ↓") : ""}
              </TableCell>
              {!opts.isGlobalList && (
                <TableCell align="center" sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.95rem", padding: "16px" }}>Status</TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={(opts.isGlobalList ? 3 : 4) + parentColCount}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                    No {level?.name.toLowerCase() ?? "items"} yet
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => renderItemRow(item, levelId, opts))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  function renderCurrentLevelView() {
    if (!state || !currentLevel) return null;
    const isLevel1 = navStack.length === 0;

    function handleAdd() {
      if (isLevel1) {
        setItemDialog({ mode: "add", levelId: currentLevel!.id });
      } else if (currentLevel!.type === "type1") {
        setSearchDialog({
          levelId: currentLevel!.id,
          parentLevelId: parentLevel!.id,
          parentItemId: parentEntry!.itemId,
          parentKey: parentKey,
        });
      } else {
        setItemDialog({ mode: "add", levelId: currentLevel!.id });
      }
    }

    return (
      <Box>
        <SectionSettings
          level={currentLevel}
          onSave={handleSaveHeading}
          saving={headingSaving === currentLevel.id}
          saved={headingSaved === currentLevel.id}
          onAdd={handleAdd}
        />
        {renderItemTable(currentItems, currentLevel.id)}
      </Box>
    );
  }

  function renderStepsView() {
    if (!state || !parentEntry) return null;

    return (
      <Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
          <Typography variant="h5" sx={{ color: "#45443F", fontWeight: 700 }}>
            Steps: {parentEntry.itemName}
          </Typography>
          <Button
            variant="contained"
            onClick={() => setStepDialog({ mode: "add", parentItemId: parentEntry.itemId })}
            sx={{ bgcolor: "#3D8078", color: "#fff", fontWeight: 600, textTransform: "none", "&:hover": { bgcolor: "#2D6059" } }}
          >
            + Add Step
          </Button>
        </Box>

        {currentSteps.length === 0 ? (
          <Typography color="text.secondary">No steps added yet.</Typography>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="steps">
              {(droppableProvided) => (
                <Box
                  ref={droppableProvided.innerRef}
                  {...droppableProvided.droppableProps}
                  sx={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                  {currentSteps.map((step, index) => (
                    <Draggable key={step.id} draggableId={step.id} index={index}>
                      {(draggableProvided, snapshot) => (
                        <Paper
                          ref={draggableProvided.innerRef}
                          {...draggableProvided.draggableProps}
                          elevation={1}
                          sx={{
                            p: 3, borderRadius: 1, border: "1px solid #E5E1D7",
                            transition: snapshot.isDragging ? "none" : "box-shadow 200ms ease",
                            boxShadow: snapshot.isDragging ? "0 8px 24px rgba(0,0,0,0.15)" : undefined,
                          }}
                        >
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, flex: 1 }}>
                              <Box
                                {...draggableProvided.dragHandleProps}
                                sx={{ display: "flex", alignItems: "center", pt: 0.5, cursor: "grab", color: "text.disabled" }}
                              >
                                <DragIndicatorIcon fontSize="small" />
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
                                  <Typography variant="h6" fontWeight={700} sx={{ color: "#45443F" }}>
                                    Step {index + 1}: {step.title}
                                  </Typography>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => setExpandedStepId(expandedStepId === step.id ? null : step.id)}
                                    sx={{
                                      color: "#3D8078", borderColor: "#3D8078", fontWeight: 600,
                                      textTransform: "none",
                                      "&:hover": { bgcolor: "rgba(61,128,120,0.1)", borderColor: "#2D6059" },
                                    }}
                                  >
                                    {expandedStepId === step.id ? "Collapse" : "Expand"}
                                  </Button>
                                </Box>

                                <Collapse in={expandedStepId === step.id}>
                                  <Box sx={{ mt: 2, mb: 1 }}>
                                    {step.contentHtml && (
                                      <Box
                                        sx={{
                                          p: 2, bgcolor: "action.hover", borderRadius: 1, mb: 2,
                                          "& p": { mb: 1 }, "& ul": { pl: 2, mb: 1 },
                                        }}
                                        dangerouslySetInnerHTML={{ __html: step.contentHtml }}
                                      />
                                    )}
                                    {step.imageUrl && (
                                      <Box
                                        component="img"
                                        src={step.imageUrl}
                                        alt="Step image"
                                        sx={{ width: "100%", maxWidth: 400, maxHeight: 300, objectFit: "cover", borderRadius: 1, mt: 1 }}
                                      />
                                    )}
                                    {step.videoUrl && getVideoEmbedUrl(step.videoUrl) && (
                                      <Box sx={{ mt: 1 }}>
                                        {/\.(mp4|webm|ogg)(\?.*)?$/i.test(step.videoUrl) ? (
                                          <Box component="video" controls src={step.videoUrl} sx={{ width: "100%", borderRadius: 1 }} />
                                        ) : (
                                          <Box sx={{ position: "relative", width: "100%", paddingBottom: "56.25%", borderRadius: 1, overflow: "hidden" }}>
                                            <Box
                                              component="iframe"
                                              src={getVideoEmbedUrl(step.videoUrl)!}
                                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                              allowFullScreen
                                              sx={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                                            />
                                          </Box>
                                        )}
                                      </Box>
                                    )}
                                  </Box>
                                </Collapse>
                              </Box>
                            </Box>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuTarget({ anchorEl: e.currentTarget, type: "step", id: step.id, extra: parentEntry.itemId, step });
                              }}
                              sx={{ ml: 1 }}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Paper>
                      )}
                    </Draggable>
                  ))}
                  {droppableProvided.placeholder}
                </Box>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </Box>
    );
  }

  function renderGlobalListView() {
    if (!state || !globalListLevelId) return null;
    const level = activeLevels.find((l) => l.id === globalListLevelId);
    if (!level) return null;
    const levelIndex = activeLevels.findIndex((l) => l.id === globalListLevelId);
    const label = level.type === "type1" ? `All ${level.name}` : `${level.name} Management`;
    const showContextFilter = levelIndex >= 1;

    // Collect unique parent/grandparent options from items actually present in the list
    const parentOptions = Array.from(
      new Map(
        globalListItems.flatMap((item) =>
          (globalListParentInfo[item.id]?.parents ?? []).map((p) => [p.id, p.name] as [string, string])
        )
      ).entries()
    ).sort(([, a], [, b]) => a.localeCompare(b));

    const grandparentOptions = Array.from(
      new Map(
        globalListItems.flatMap((item) =>
          (globalListParentInfo[item.id]?.grandparents ?? []).map((gp) => [gp.id, gp.name] as [string, string])
        )
      ).entries()
    ).sort(([, a], [, b]) => a.localeCompare(b));

    // Decode filter value and apply
    const filtered = globalListItems.filter((item) => {
      if (globalListNameFilter && !item.name.toLowerCase().includes(globalListNameFilter.toLowerCase())) return false;
      if (globalListContextFilter) {
        const colonIdx = globalListContextFilter.indexOf(":");
        const role = globalListContextFilter.slice(0, colonIdx);
        const filterId = globalListContextFilter.slice(colonIdx + 1);
        const info = globalListParentInfo[item.id];
        if (role === "gp" && !info?.grandparents.some((gp) => gp.id === filterId)) return false;
        if (role === "p" && !info?.parents.some((p) => p.id === filterId)) return false;
      }
      return true;
    });

    const contextLabel = levelIndex >= 2
      ? `${activeLevels[0].singularName} / ${activeLevels[levelIndex - 1].singularName}`
      : (activeLevels[0]?.singularName ?? "Context");

    const hasFilter = !!(globalListNameFilter || globalListContextFilter);

    return (
      <Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
          <Box>
            <Typography variant="h5" sx={{ color: "#45443F", fontWeight: 700, mb: 0.5 }}>{label}</Typography>
            <Typography variant="body2" color="text.secondary">
              View and manage all {level.name.toLowerCase()} across the system
            </Typography>
          </Box>
          <Button
            variant="contained"
            onClick={() => setItemDialog({ mode: "add", levelId: globalListLevelId, isGlobalList: true })}
            sx={{ bgcolor: "#3D8078", color: "#fff", fontWeight: 600, textTransform: "none", whiteSpace: "nowrap", "&:hover": { bgcolor: "#2D6059" } }}
          >
            + Add {level.singularName}
          </Button>
        </Box>

        {showContextFilter && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }} alignItems="flex-end">
            <TextField
              size="small"
              label="Search by name"
              value={globalListNameFilter}
              onChange={(e) => setGlobalListNameFilter(e.target.value)}
              sx={{ minWidth: 200 }}
            />
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>{contextLabel}</InputLabel>
              <Select
                label={contextLabel}
                value={globalListContextFilter}
                onChange={(e) => setGlobalListContextFilter(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <Divider />
                {levelIndex >= 2 && grandparentOptions.length > 0 && (
                  <ListSubheader>{activeLevels[0].singularName}</ListSubheader>
                )}
                {levelIndex >= 2 && grandparentOptions.map(([id, name]) => (
                  <MenuItem key={id} value={`gp:${id}`}>{name}</MenuItem>
                ))}
                {levelIndex >= 2 && grandparentOptions.length > 0 && parentOptions.length > 0 && (
                  <Divider />
                )}
                {levelIndex >= 2 && parentOptions.length > 0 && (
                  <ListSubheader>{activeLevels[levelIndex - 1].singularName}</ListSubheader>
                )}
                {parentOptions.map(([id, name]) => (
                  <MenuItem key={id} value={`p:${id}`}>{name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {hasFilter && (
              <Button
                size="small"
                onClick={() => { setGlobalListNameFilter(""); setGlobalListContextFilter(""); }}
                sx={{ textTransform: "none", color: "#3D8078" }}
              >
                Clear
              </Button>
            )}
          </Stack>
        )}

        {renderItemTable(filtered, globalListLevelId, { isGlobalList: true })}
      </Box>
    );
  }

  function renderDeletedView() {
    if (!state) return null;

    // Build unique type options from current deleted items
    const allDeleted = state.deletedItems;
    const typeOptions = Array.from(new Set(allDeleted.map((d) =>
      d.type === "step" ? "step" : d.type,
    ))).map((t) => ({
      value: t,
      label: t === "step" ? "Step" : (activeLevels.find((l) => l.id === t)?.singularName ?? t),
    }));

    // Apply filters
    const filtered = allDeleted.filter((d) => {
      if (deletedNameFilter && !d.name.toLowerCase().includes(deletedNameFilter.toLowerCase())) return false;
      if (deletedTypeFilter && d.type !== deletedTypeFilter) return false;
      if (deletedFromDate) {
        const from = new Date(deletedFromDate);
        if (new Date(d.deletedAt) < from) return false;
      }
      if (deletedToDate) {
        const to = new Date(deletedToDate);
        to.setHours(23, 59, 59, 999);
        if (new Date(d.deletedAt) > to) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

    return (
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ color: "#45443F", fontWeight: 700, mb: 0.5 }}>Deleted Items</Typography>
          <Typography variant="body2" color="text.secondary">Restore or permanently delete removed items</Typography>
        </Box>

        {/* Filter bar */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }} alignItems="flex-end">
          <TextField
            size="small"
            label="Search by name"
            value={deletedNameFilter}
            onChange={(e) => setDeletedNameFilter(e.target.value)}
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Type</InputLabel>
            <Select
              label="Type"
              value={deletedTypeFilter}
              onChange={(e) => setDeletedTypeFilter(e.target.value)}
            >
              <MenuItem value="">All types</MenuItem>
              {typeOptions.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="From date"
            type="date"
            value={deletedFromDate}
            onChange={(e) => setDeletedFromDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
          <TextField
            size="small"
            label="To date"
            type="date"
            value={deletedToDate}
            onChange={(e) => setDeletedToDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
          {(deletedNameFilter || deletedTypeFilter || deletedFromDate || deletedToDate) && (
            <Button
              size="small"
              onClick={() => { setDeletedNameFilter(""); setDeletedTypeFilter(""); setDeletedFromDate(""); setDeletedToDate(""); }}
              sx={{ textTransform: "none", color: "#3D8078" }}
            >
              Clear
            </Button>
          )}
        </Stack>

        {allDeleted.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No deleted items.</Typography>
        ) : (
          <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 1, overflow: "hidden" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "#FDF9F1", borderBottom: "2px solid #E5E1D7" }}>
                  <TableCell sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.9rem", py: 1.5, px: 2 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.9rem", py: 1.5, px: 2 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.9rem", py: 1.5, px: 2 }}>Location</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.9rem", py: 1.5, px: 2 }}>Deleted</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.9rem", py: 1.5, px: 2 }}>By</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.9rem", py: 1.5, px: 2 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: "center", py: 3, color: "text.secondary" }}>
                      No items match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((d) => {
                    const typeLabel = d.type === "step"
                      ? "Step"
                      : (activeLevels.find((l) => l.id === d.type)?.singularName ?? d.type);
                    return (
                      <TableRow key={d.id} sx={{ borderBottom: "1px solid #E5E1D7", "&:last-child td": { borderBottom: 0 } }}>
                        <TableCell sx={{ py: 1.25, px: 2, fontWeight: 500, color: "#45443F" }}>{d.name}</TableCell>
                        <TableCell sx={{ py: 1.25, px: 2 }}>
                          <Chip
                            label={typeLabel}
                            size="small"
                            sx={{
                              bgcolor: d.type === "step" ? "#E8F4F2" : "#F5F0E8",
                              color: d.type === "step" ? "#3D8078" : "#45443F",
                              fontWeight: 600, fontSize: "0.75rem",
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ py: 1.25, px: 2, color: "text.secondary", fontSize: "0.85rem", maxWidth: 200 }}>
                          {d.location ? (
                            <Tooltip title={d.location} placement="top-start">
                              <Box sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {d.location}
                              </Box>
                            </Tooltip>
                          ) : "—"}
                        </TableCell>
                        <TableCell sx={{ py: 1.25, px: 2, color: "text.secondary", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                          {d.deletedAt
                            ? new Date(d.deletedAt).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })
                            : "—"}
                        </TableCell>
                        <TableCell sx={{ py: 1.25, px: 2, color: "text.secondary", fontSize: "0.85rem" }}>
                          {d.deletedBy ?? "—"}
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1, px: 2 }}>
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button
                              variant="outlined" size="small"
                              startIcon={<RestoreIcon fontSize="small" />}
                              onClick={() => void dispatch("restoreDeletedItem", { deletedItemId: d.id })}
                              disabled={actionLoading}
                              sx={{ textTransform: "none", color: "#3D8078", borderColor: "#3D8078", "&:hover": { bgcolor: "rgba(61,128,120,0.1)" }, whiteSpace: "nowrap" }}
                            >
                              Restore
                            </Button>
                            <Tooltip title="Delete permanently">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setDeleteTarget({ kind: "deletedBinItem", deletedItemId: d.id, name: d.name })}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    );
  }

  function renderMenu() {
    if (!menuTarget) return null;
    const { type, extra, item, step } = menuTarget;
    const handleClose = () => setMenuTarget(null);

    function onEdit() {
      handleClose();
      if (type === "item" && item && extra) setItemDialog({ mode: "edit", levelId: extra, item, isGlobalList: !!globalListLevelId });
      else if (type === "step" && step && extra) setStepDialog({ mode: "edit", parentItemId: extra, step });
    }

    function onInfo() {
      handleClose();
      if (type === "item" && item) setInfoOpen({ item });
      else if (type === "step" && step) setInfoOpen({ item: step, isStep: true });
    }

    function onDelete() {
      handleClose();
      if (type === "item" && item && extra) {
        if (navStack.length > 0 && !globalListLevelId && parentLevel && parentEntry) {
          setDeleteTarget({ kind: "unlink", parentLevelId: parentLevel.id, parentItemId: parentEntry.itemId, parentKey: parentKey, childItemId: item.id, childLevelId: extra, name: item.name });
        } else {
          setDeleteTarget({ kind: "item", levelId: extra, itemId: item.id, name: item.name });
        }
      } else if (type === "step" && step && extra) {
        setDeleteTarget({ kind: "step", parentItemId: extra, stepId: step.id, name: step.title });
      }
    }

    return (
      <Menu anchorEl={menuTarget.anchorEl} open onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={onEdit} dense>Edit</MenuItem>
        <MenuItem onClick={onInfo} dense>Information</MenuItem>
        <Divider />
        <MenuItem onClick={onDelete} dense sx={{ color: "error.main" }}>Delete</MenuItem>
      </Menu>
    );
  }

  function deleteConfirmMessage() {
    if (!deleteTarget) return null;
    if (deleteTarget.kind === "unlink") {
      const childLevel = activeLevels.find((l) => l.id === deleteTarget.childLevelId);
      return (
        <>
          Remove <strong>{deleteTarget.name}</strong> from this{" "}
          {parentLevel?.singularName?.toLowerCase() ?? "item"}? The{" "}
          {childLevel?.singularName?.toLowerCase() ?? "item"} will still exist in the global list.
        </>
      );
    }
    if (deleteTarget.kind === "deletedBinItem") {
      return <>Permanently delete <strong>{deleteTarget.name}</strong>? This cannot be undone.</>;
    }
    return undefined;
  }

  // ── Initial loading screen ────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <CircularProgress sx={{ color: "#3D8078" }} />
      </Box>
    );
  }

  // ── Top bar (breadcrumbs + stats + logout) ────────────────────────────

  const crumbSx = { color: "#3D8078", fontWeight: 500, "&:hover": { color: "#2D6059" }, cursor: "pointer" };

  // ── Main render ───────────────────────────────────────────────────────

  const stepDialogSteps = state?.steps[stepDialog?.parentItemId ?? ""] ?? [];
  const stepDialogNumber = stepDialog
    ? stepDialog.mode === "add"
      ? stepDialogSteps.length + 1
      : (stepDialogSteps.findIndex((s) => s.id === stepDialog.step?.id) + 1) || 1
    : 1;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar
        activeLevels={activeLevels}
        features={state?.appSettings.features ?? { copyLink: true, qrCode: true, canvasEmbed: true, fullItemListView: true }}
        navStack={navStack}
        onGoHome={handleGoHome}
        onGlobalList={handleGlobalList}
        globalListLevelId={globalListLevelId}
        onShowDeleted={handleShowDeleted}
        showDeleted={showDeleted}
        homepageTitle={state?.homepageTitle ?? ""}
        homepageDescription={state?.homepageDescription ?? ""}
        onSaveHomepage={(t, d) => void handleSaveHomepage(t, d)}
        homepageSaving={homepageSaving}
        homepageSaved={homepageSaved}
        onPreview={() => void handlePreview()}
        previewLoading={previewLoading}
        level1Items={activeLevels[0] ? (state?.items[activeLevels[0].id] ?? []) : []}
        onNavigateLevel1={(item) => {
          setNavStack([{ levelId: activeLevels[0]!.id, itemId: item.id, itemName: item.name }]);
          setGlobalListLevelId(null);
          setShowDeleted(false);
          setSortColumn(null); setSortAsc(true);
          setExpandedStepId(null);
        }}
        onLevel1ItemMenu={(item, anchorEl) =>
          setMenuTarget({ anchorEl, type: "item", id: item.id, extra: activeLevels[0]!.id, item })
        }
      />

      <Box
        component="main"
        sx={{ flex: 1, p: 3, bgcolor: "#FDF9F1", minHeight: "100vh", overflowY: "auto", position: "relative" }}
      >
        {/* Loading overlay */}
        {actionLoading && (
          <Box sx={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            bgcolor: "rgba(253,249,241,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 10,
          }}>
            <CircularProgress sx={{ color: "#3D8078" }} />
          </Box>
        )}

        {/* Alerts */}
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>{success}</Alert>}

        {/* Breadcrumbs + Stats + Logout */}
        <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Breadcrumbs>
            <Link component="button" variant="body2" onClick={handleGoHome} underline="hover" sx={crumbSx}>
              HOME
            </Link>
            {!showDeleted && !globalListLevelId && navStack.map((entry, i) => (
              <Link key={entry.itemId} component="button" variant="body2"
                onClick={() => handleBreadcrumbNav(i + 1)} underline="hover" sx={crumbSx}
              >
                {entry.itemName.toUpperCase()}
              </Link>
            ))}
            {showDeleted && (
              <Typography variant="body2" sx={{ color: "#3D8078", fontWeight: 500 }}>DELETED ITEMS</Typography>
            )}
            {globalListLevelId && !showDeleted && (() => {
              const lvl = activeLevels.find((l) => l.id === globalListLevelId);
              const label = lvl
                ? (lvl.type === "type1" ? `FULL ${lvl.name.toUpperCase()} LIST` : `${lvl.name.toUpperCase()} MANAGEMENT`)
                : "MANAGEMENT";
              return <Typography variant="body2" sx={{ color: "#3D8078", fontWeight: 500 }}>{label}</Typography>;
            })()}
          </Breadcrumbs>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Tooltip title="Statistics">
              <IconButton onClick={() => setStatsOpen(true)} size="small" sx={{ color: "#666", "&:hover": { color: "#333" } }}>
                <EqualizerIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Sign Out">
              <IconButton onClick={() => void signOut()} size="small" sx={{ color: "#666", "&:hover": { color: "#333" } }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {/* Main views */}
        {showDeleted && renderDeletedView()}
        {!showDeleted && globalListLevelId && renderGlobalListView()}
        {!showDeleted && !globalListLevelId && atSteps && renderStepsView()}
        {!showDeleted && !globalListLevelId && !atSteps && renderCurrentLevelView()}
      </Box>

      {/* ── Dialogs ── */}

      <AddEditItemDialog
        open={!!itemDialog}
        onClose={() => setItemDialog(null)}
        onSave={(d) => void handleSaveItem(d)}
        loading={actionLoading}
        mode={itemDialog?.mode ?? "add"}
        levelSingularName={activeLevels.find((l) => l.id === itemDialog?.levelId)?.singularName ?? "Item"}
        initialData={
          itemDialog?.item
            ? { name: itemDialog.item.name, description: itemDialog.item.description, thumbnailUrl: itemDialog.item.thumbnailUrl }
            : undefined
        }
      />

      {searchDialog && (
        <SearchLinkDialog
          open
          onClose={() => setSearchDialog(null)}
          onLink={(id) => void handleLink(id)}
          onCreateAndLink={(d) => void handleCreateAndLink(d)}
          loading={actionLoading}
          levelPluralName={activeLevels.find((l) => l.id === searchDialog.levelId)?.name ?? "Items"}
          levelSingularName={activeLevels.find((l) => l.id === searchDialog.levelId)?.singularName ?? "Item"}
          allItems={state?.items[searchDialog.levelId] ?? []}
          linkedItemIds={
            new Set(
              (state?.relationships[searchDialog.parentLevelId]?.[searchDialog.parentKey] ?? []).map(
                (r: RelationshipEntry) => r.childItemId,
              ),
            )
          }
        />
      )}

      <AddEditStepDialog
        open={!!stepDialog}
        onClose={() => setStepDialog(null)}
        onSave={(d) => void handleSaveStep(d)}
        loading={actionLoading}
        mode={stepDialog?.mode ?? "add"}
        stepNumber={stepDialogNumber}
        initialData={
          stepDialog?.step
            ? { title: stepDialog.step.title, contentHtml: stepDialog.step.contentHtml, imageUrl: stepDialog.step.imageUrl, videoUrl: stepDialog.step.videoUrl }
            : undefined
        }
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteConfirm()}
        itemName={deleteTarget?.name ?? ""}
        loading={actionLoading}
        message={deleteConfirmMessage()}
      />

      {infoOpen && (
        <InfoDialog
          open
          onClose={() => setInfoOpen(null)}
          name={infoOpen.isStep ? (infoOpen.item as Step).title : (infoOpen.item as Item).name}
          lastModified={(infoOpen.item as Item | Step).lastModified}
          modifiedBy={(infoOpen.item as Item | Step).modifiedBy}
          createdAt={(infoOpen.item as Item | Step).createdAt}
        />
      )}

      {copyLinkTarget && (
        <CopyLinkDialog open onClose={() => setCopyLinkTarget(null)} url={copyLinkTarget.url} itemName={copyLinkTarget.itemName} />
      )}
      {qrTarget && (
        <QRCodeDialog open onClose={() => setQrTarget(null)} url={qrTarget.url} itemName={qrTarget.itemName} />
      )}
      {embedTarget && (
        <EmbedDialog open onClose={() => setEmbedTarget(null)} url={embedTarget.url} itemName={embedTarget.itemName} />
      )}

      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} getAuthToken={getAuthToken} />

      {renderMenu()}
    </Box>
  );
}
