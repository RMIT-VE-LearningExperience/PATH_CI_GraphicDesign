"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Fab,
  Grid,
  IconButton,
  Modal,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  Home as HomeIcon,
  Image as ImageIcon,
  Info as InfoIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  Remove as RemoveIcon,
} from "@mui/icons-material";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { trackEvent } from "./GoogleAnalytics";
import Footer from "./Footer";
import type { Item, Level, RelationshipEntry, Step, TutorialState } from "../../lib/tutorial-store";

// ── Constants ─────────────────────────────────────────────────────────

const PROGRESS_KEY = "path_guide_progress_v1";

const colors = {
  primary: "#000054",
  darkBg: "#45443F",
  lightBg: "#f2f2f2",
  lightBorder: "#E5E1D7",
  text: "#45443F",
  lightText: "#62615C",
  cardBg: "#FFFFFF",
  cardShadow: "0 2px 8px rgba(69, 68, 63, 0.08)",
  cardShadowHover: "0 8px 16px rgba(69, 68, 63, 0.12)",
};

// Visually hides content while keeping it in the accessibility tree.
const srOnlySx = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

// Applied to the <main> landmark, which is given programmatic focus after
// every in-app navigation. :focus-visible (not :focus) keeps the ring hidden
// after a mouse click and shown after keyboard activation.
const mainFocusSx = {
  outline: "none",
  "&:focus-visible": {
    outline: `3px solid ${colors.primary}`,
    outlineOffset: "-2px",
  },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────

function scrollToTop() {
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
}

function getVideoEmbedUrl(url: string): string | null {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return url;
  return null;
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<(?!\/?(p|br|ul|ol|li|b|strong|i|em|h3|a)(\s+[^>]*)?>)[^>]*>/gi, "")
    .replace(/<a\s+[^>]*href=(\"|')(.*?)\1[^>]*>/gi, (_m, _q, href: string) => {
      const safe = /^(https?:\/\/|mailto:)/i.test(href) ? href : "#";
      return `<a href="${safe}" target="_blank" rel="noreferrer">`;
    });
}

// ── Skip link ─────────────────────────────────────────────────────────
// Hidden until focused, so keyboard users can jump past the preview banner
// and top navigation straight to the main content of the current view.

function SkipLink() {
  return (
    <Box
      component="a"
      href="#main-content"
      sx={{
        ...srOnlySx,
        "&:focus": {
          position: "fixed",
          top: 8,
          left: 8,
          width: "auto",
          height: "auto",
          margin: 0,
          padding: "8px 16px",
          overflow: "visible",
          clip: "auto",
          whiteSpace: "normal",
          zIndex: 2000,
          bgcolor: colors.darkBg,
          color: "#fff",
          borderRadius: 1,
          fontWeight: 700,
          textDecoration: "none",
        },
      }}
    >
      Skip to content
    </Box>
  );
}

// ── Nav icon button ───────────────────////////////////////////////////

function NavIconButton({
  onClick,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <IconButton
      onClick={onClick}
      aria-label={ariaLabel}
      sx={{
        "&:focus-visible": { outline: `3px solid ${colors.primary}`, outlineOffset: 2 },
        color: colors.text,
        border: `1px solid ${colors.lightBorder}`,
        borderRadius: "6px",
        transition: "all 0.2s ease",
        "&:hover": { bgcolor: colors.lightBorder },
      }}
    >
      {children}
    </IconButton>
  );
}

// ── Item card ─────────────────────────────────────────────────────────

function ItemCard({
  item,
  isLastLevel,
  isPublished,
  isPreview,
  onClick,
}: {
  item: Item;
  isLastLevel: boolean;
  isPublished: boolean;
  isPreview: boolean;
  onClick: () => void;
}) {
  const isUnpublished = isPreview && !isPublished;
  const titleId = useId();

  return (
    <Card
      sx={{
        position: "relative",
        cursor: "pointer",
        height: "100%",
        borderRadius: "8px",
        border: isUnpublished ? "2px solid #f59e0b" : "none",
        backgroundColor: colors.cardBg,
        boxShadow: colors.cardShadow,
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": { boxShadow: colors.cardShadowHover, transform: "translateY(-4px)" },
        "&:active": { transform: "translateY(-2px)" },
        "@media (prefers-reduced-motion: reduce)": {
          transition: "none",
          "&:hover, &:active": { transform: "none" },
        },
      }}
    >
      {/* Card-wide native button so the whole card is keyboard/AT operable */}
      <Box
        component="button"
        type="button"
        onClick={onClick}
        aria-labelledby={titleId}
        sx={{
          position: "absolute", inset: 0, zIndex: 1,
          width: "100%", height: "100%", m: 0, p: 0,
          border: "none", background: "none", appearance: "none",
          cursor: "pointer", borderRadius: "8px",
          "&:focus-visible": { outline: `3px solid ${colors.primary}`, outlineOffset: "-3px" },
        }}
      />
      {/* Thumbnail */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          paddingBottom: "66.67%",
          overflow: "hidden",
          bgcolor: "#f2f2f2",
        }}
      >
        {item.thumbnailUrl ? (
          <Image
            src={item.thumbnailUrl}
            alt=""
            fill
            style={{ objectFit: "cover" }}
            sizes="(max-width: 600px) 100vw, (max-width: 960px) 50vw, 33vw"
          />
        ) : (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "#E5E1D7",
            }}
          >
            <ImageIcon sx={{ color: "#C2BDB1", fontSize: 40 }} />
          </Box>
        )}
      </Box>

      {/* Content */}
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        {isLastLevel ? (
          /* Last level: description as bullet list */
          <Stack spacing={1.5}>
            <Typography
              variant="h6"
              component="h2"
              id={titleId}
              sx={{ fontSize: { xs: "1rem", sm: "1.1rem" }, fontWeight: 600, color: colors.text, lineHeight: 1.4 }}
            >
              {item.name}
            </Typography>
            {item.description && (
              <Box
                component="ul"
                sx={{
                  m: 0, pl: 2,
                  fontSize: { xs: "0.85rem", sm: "0.9rem" },
                  color: colors.lightText,
                  lineHeight: 1.4,
                  wordBreak: "break-word",
                }}
              >
                {item.description.split("\n").filter(Boolean).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </Box>
            )}
          </Stack>
        ) : (
          /* Other levels: description as info tooltip */
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Typography
              variant="h6"
              component="h2"
              id={titleId}
              sx={{ fontSize: { xs: "1rem", sm: "1.1rem" }, fontWeight: 600, color: colors.text, flex: 1, lineHeight: 1.4 }}
            >
              {item.name}
            </Typography>
            {item.description && (
              <Tooltip title={item.description} arrow placement="top">
                <IconButton
                  size="small"
                  aria-label={`More information about ${item.name}`}
                  sx={{
                    position: "relative", zIndex: 2,
                    color: colors.primary, width: 44, height: 44, m: "-10px",
                    "&:hover": { bgcolor: "rgba(0,0,84,0.1)" },
                    "&:focus-visible": { outline: `3px solid ${colors.primary}`, outlineOffset: -3 },
                  }}
                >
                  <InfoIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

// ── Step image (click to enlarge) ─────────────────────────────────────

function StepImage({ src, alt, onClick }: { src: string; alt: string; onClick: () => void }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-label={`Enlarge image${alt ? `: ${alt}` : ""}`}
      sx={{
        position: "relative", width: "100%", paddingBottom: "60%",
        overflow: "hidden", borderRadius: 1, bgcolor: "#f2f2f2",
        display: "block", m: 0, p: 0, border: "none",
        font: "inherit", appearance: "none",
        cursor: "pointer", transition: "all 0.2s ease",
        "&:hover": { boxShadow: colors.cardShadowHover },
        "&:focus-visible": { outline: `3px solid ${colors.primary}`, outlineOffset: 2 },
      }}
    >
      <Image
        src={src}
        alt=""
        fill
        style={{ objectFit: "contain" }}
        sizes="(max-width: 600px) 100vw, (max-width: 960px) 90vw, 800px"
      />
    </Box>
  );
}

// ── Path helpers ──────────────────────────────────────────────────────

type NavEntry = { levelId: string; itemId: string };

// Used inside loadData before state is stored in useState.
function resolvePathFromIds(selections: NavEntry[], st: TutorialState): string {
  if (selections.length === 0) return "/";
  const parts = selections.map((entry) => {
    const items = st.items[entry.levelId] ?? [];
    return items.find((i) => i.id === entry.itemId)?.slug ?? entry.itemId;
  });
  return "/" + parts.join("/");
}

// ── Main component ─────────────────────────────────────────────────────

export default function PublicApp({ initialSlugs }: { initialSlugs: string[] }) {
  const router = useRouter();

  const [state, setAppState] = useState<TutorialState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [selectionStack, setSelectionStack] = useState<NavEntry[]>([]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  // Debounced copy of activeStepIndex for the screen-reader status region,
  // so scroll jitter doesn't trigger a flood of announcements
  const [announcedStepIndex, setAnnouncedStepIndex] = useState(0);
  const [enlargedImage, setEnlargedImage] = useState<{ url: string; alt: string } | null>(null);
  const [imgZoom, setImgZoom] = useState(1);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const visibleStepsRef = useRef(new Map<number, number>());
  const mainRef = useRef<HTMLDivElement>(null);
  const isFirstRenderRef = useRef(true);
  const lastTrackedStep = useRef(-1);

  // ── Derived ─────────────────────────────────────────────────────────

  const activeLevels = useMemo(
    (): Level[] =>
      (state?.hierarchy.levels ?? [])
        .filter((l) => l.enabled)
        .sort((a, b) => a.order - b.order),
    [state],
  );

  const atSteps = selectionStack.length === activeLevels.length && activeLevels.length > 0;
  const currentLevel: Level | undefined = atSteps ? undefined : activeLevels[selectionStack.length];
  const parentEntry = selectionStack.length > 0 ? selectionStack[selectionStack.length - 1] : null;
  const parentLevel: Level | undefined =
    selectionStack.length > 0 ? activeLevels[selectionStack.length - 1] : undefined;

  const isLastSelectionLevel = !atSteps && currentLevel !== undefined &&
    activeLevels.indexOf(currentLevel) === activeLevels.length - 1;

  const visibleItems = useMemo((): Item[] => {
    if (!state || !currentLevel) return [];
    const all = state.items[currentLevel.id] ?? [];
    if (selectionStack.length === 0) return all;
    const relKey = selectionStack.length >= 2
      ? `${selectionStack[selectionStack.length - 2].itemId}:${parentEntry!.itemId}`
      : parentEntry!.itemId;
    const rels = (state.relationships[parentLevel!.id]?.[relKey] ?? []).slice() as RelationshipEntry[];
    rels.sort((a, b) => a.order - b.order);
    return rels
      .map((r) => all.find((i) => i.id === r.childItemId))
      .filter(Boolean) as Item[];
  }, [state, currentLevel, selectionStack, parentLevel, parentEntry]);

  const currentSteps = useMemo((): Step[] => {
    if (!state || !atSteps || !parentEntry) return [];
    return state.steps[parentEntry.itemId] ?? [];
  }, [state, atSteps, parentEntry]);

  // Name of whatever the user is looking at now, for the document title
  const currentPageName = useMemo((): string => {
    if (!state) return "";
    if (selectionStack.length === 0) return state.homepageTitle || activeLevels[0]?.name || "Guide";
    const parentItem = parentEntry
      ? (state.items[parentLevel?.id ?? ""] ?? []).find((i) => i.id === parentEntry.itemId)
      : undefined;
    return parentItem?.name ?? currentLevel?.sectionTitle ?? "";
  }, [state, selectionStack, activeLevels, parentEntry, parentLevel, currentLevel]);

  const itemPublishedMap = useMemo((): Record<string, boolean> => {
    if (!state || !currentLevel) return {};
    if (selectionStack.length === 0) {
      return Object.fromEntries(
        (state.items[currentLevel.id] ?? []).map((i) => [i.id, i.published]),
      );
    }
    const relKey = selectionStack.length >= 2
      ? `${selectionStack[selectionStack.length - 2].itemId}:${parentEntry!.itemId}`
      : parentEntry!.itemId;
    const rels = (state.relationships[parentLevel!.id]?.[relKey] ?? []) as RelationshipEntry[];
    return Object.fromEntries(rels.map((r) => [r.childItemId, r.published]));
  }, [state, currentLevel, selectionStack, parentLevel, parentEntry]);

  // ── Path builder (uses state closure) ────────────────────────────────

  function buildPath(stack: NavEntry[]): string {
    if (stack.length === 0) return "/";
    if (!state) return "/";
    const parts = stack.map((entry) => {
      const items = state.items[entry.levelId] ?? [];
      return items.find((i) => i.id === entry.itemId)?.slug ?? entry.itemId;
    });
    return "/" + parts.join("/");
  }

  // ── Data loading ─────────────────────────────────────────────────────

  useEffect(() => {
    async function loadData() {
      try {
        const params = new URLSearchParams(window.location.search);
        const previewToken = params.get("previewToken");

        const url = previewToken
          ? `/api/tutorial?previewToken=${encodeURIComponent(previewToken)}`
          : "/api/tutorial";

        const res = await fetch(url, { cache: "no-store" });
        const result = (await res.json()) as
          | { state: TutorialState; isPreviewMode?: boolean }
          | { error: string };

        if (!res.ok || "error" in result) {
          setError("Could not load guide data.");
          return;
        }

        const { state: newState, isPreviewMode: preview } = result as {
          state: TutorialState;
          isPreviewMode?: boolean;
        };

        setAppState(newState);
        setIsPreviewMode(!!preview);

        const levels = (newState.hierarchy.levels ?? [])
          .filter((l) => l.enabled)
          .sort((a, b) => a.order - b.order);

        // Preview mode: resolve from ?l1=id&l2=id query params
        if (preview) {
          const previewSelections: NavEntry[] = [];
          for (let i = 0; i < levels.length; i++) {
            const idParam = params.get(`l${i + 1}`);
            if (!idParam) break;
            previewSelections.push({ levelId: levels[i].id, itemId: idParam });
          }
          if (previewSelections.length > 0) setSelectionStack(previewSelections);
          return;
        }

        // Resolve from path-based slugs (primary flow)
        if (initialSlugs.length > 0) {
          const resolved: NavEntry[] = [];
          for (let i = 0; i < initialSlugs.length && i < levels.length; i++) {
            const item = (newState.items[levels[i].id] ?? []).find(
              (it) => it.slug === initialSlugs[i],
            );
            if (!item) { setNotFound(true); return; }
            resolved.push({ levelId: levels[i].id, itemId: item.id });
          }
          setSelectionStack(resolved);
          return;
        }

        // Backward compat: legacy ?l1=id params → redirect to slug path
        if (params.get("l1")) {
          const selections: NavEntry[] = [];
          for (let i = 0; i < levels.length; i++) {
            const idParam = params.get(`l${i + 1}`);
            if (!idParam) break;
            const matched = (newState.items[levels[i].id] ?? []).find((item) => item.id === idParam);
            if (!matched) break;
            selections.push({ levelId: levels[i].id, itemId: matched.id });
          }
          if (selections.length > 0) {
            setSelectionStack(selections);
            window.history.replaceState({}, "", resolvePathFromIds(selections, newState));
          }
          return;
        }

        // "View App" button from CMS — show homepage, skip saved progress
        if (params.get("home")) {
          window.history.replaceState({}, "", window.location.pathname);
          return;
        }

        // Restore saved progress from localStorage
        try {
          const stored = window.localStorage.getItem(PROGRESS_KEY);
          if (stored) {
            const parsed = JSON.parse(stored) as { selections?: NavEntry[] };
            if (parsed.selections?.length) {
              const valid = parsed.selections.every((entry, i) => {
                const level = levels[i];
                return level && (newState.items[level.id] ?? []).some((item) => item.id === entry.itemId);
              });
              if (valid) {
                setSelectionStack(parsed.selections);
                window.history.replaceState(
                  {},
                  "",
                  resolvePathFromIds(parsed.selections, newState),
                );
              }
            }
          }
        } catch { /* ignore */ }
      } catch {
        setError("Could not load guide data.");
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Popstate — browser back/forward ──────────────────────────────────

  useEffect(() => {
    if (!state) return;
    function onPopState() {
      const slugParts = window.location.pathname.split("/").filter(Boolean);
      const levels = (state!.hierarchy.levels ?? [])
        .filter((l) => l.enabled)
        .sort((a, b) => a.order - b.order);

      if (slugParts.length === 0) {
        setSelectionStack([]);
        setActiveStepIndex(0);
        window.scrollTo({ top: 0 });
        return;
      }

      const resolved: NavEntry[] = [];
      for (let i = 0; i < slugParts.length && i < levels.length; i++) {
        const item = (state!.items[levels[i].id] ?? []).find((it) => it.slug === slugParts[i]);
        if (!item) { setSelectionStack([]); return; }
        resolved.push({ levelId: levels[i].id, itemId: item.id });
      }
      setSelectionStack(resolved);
      setActiveStepIndex(0);
      window.scrollTo({ top: 0 });
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [state]);

  // ── Scroll / back-to-top ──────────────────────────────────────────────

  useEffect(() => {
    if (!atSteps) { setShowBackToTop(false); return; }
    function onScroll() { setShowBackToTop(window.scrollY > 400); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [atSteps]);

  // ── Step intersection observer ────────────────────────────────────────

  useEffect(() => {
    if (!atSteps || currentSteps.length === 0) return;
    visibleStepsRef.current.clear();
    lastTrackedStep.current = -1;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = Number(entry.target.getAttribute("data-step-index"));
          if (entry.isIntersecting) {
            visibleStepsRef.current.set(idx, entry.intersectionRatio);
          } else {
            visibleStepsRef.current.delete(idx);
          }
        });
        // Pick the most visible step (lowest index wins ties) so tall step
        // cards don't keep the previous step active after scrolling past it
        let best = -1;
        let bestRatio = -1;
        [...visibleStepsRef.current.entries()]
          .sort((a, b) => a[0] - b[0])
          .forEach(([idx, ratio]) => {
            if (ratio > bestRatio) { best = idx; bestRatio = ratio; }
          });
        if (best >= 0) setActiveStepIndex(best);
      },
      { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] },
    );

    stepRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [atSteps, currentSteps]);

  // ── Screen-reader step announcements (debounced) ──────────────────────

  useEffect(() => {
    const timer = setTimeout(() => setAnnouncedStepIndex(activeStepIndex), 800);
    return () => clearTimeout(timer);
  }, [activeStepIndex]);

  // ── Title + focus on in-app navigation ────────────────────────────────
  // A client-side navigation triggers no page load, so screen reader users
  // get no signal that anything changed unless we update the title and move
  // focus ourselves. Keyed on selectionStack (not currentPageName) so it only
  // fires on a real navigation, and skipped on the very first render.

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (!currentPageName) return;
    document.title = currentPageName;
    mainRef.current?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionStack]);

  // The catch-all route renders this view for unknown slugs, so it is the
  // app's real 404 page and needs its own title
  useEffect(() => {
    if (notFound) document.title = `Page not found · ${state?.homepageTitle || "PATH CI GraphicDesign"}`;
  }, [notFound, state?.homepageTitle]);

  // ── GA step tracking ──────────────────────────────────────────────────

  useEffect(() => {
    if (!atSteps || activeStepIndex === lastTrackedStep.current) return;
    lastTrackedStep.current = activeStepIndex;
    const step = currentSteps[activeStepIndex];
    if (step) {
      trackEvent("view_step", { step_number: activeStepIndex + 1, step_title: step.title });
    }
    if (currentSteps.length > 0 && activeStepIndex === currentSteps.length - 1) {
      trackEvent("complete_guide", { total_steps: currentSteps.length });
    }
  }, [activeStepIndex, atSteps, currentSteps]);

  // ── Navigation ────────────────────────────────────────────────────────

  const saveProgress = useCallback(
    (stack: NavEntry[]) => {
      if (isPreviewMode) return;
      try {
        window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({ selections: stack }));
      } catch { /* ignore */ }
    },
    [isPreviewMode],
  );

  function handleSelect(item: Item, levelId: string) {
    const newStack = [...selectionStack, { levelId, itemId: item.id }];
    setSelectionStack(newStack);
    setActiveStepIndex(0);
    stepRefs.current = [];
    lastTrackedStep.current = -1;

    if (!isPreviewMode) {
      window.history.pushState({}, "", buildPath(newStack));
    }

    trackEvent(`select_${activeLevels.find((l) => l.id === levelId)?.singularName?.toLowerCase() ?? "item"}`, {
      name: item.name, id: item.id,
    });

    saveProgress(newStack);
    scrollToTop();
  }

  function handleBack(targetDepth: number) {
    const newStack = selectionStack.slice(0, targetDepth);
    setSelectionStack(newStack);

    if (!isPreviewMode) {
      window.history.pushState({}, "", buildPath(newStack));
    }

    saveProgress(newStack);
    scrollToTop();
  }

  // ── Preview banner ────────────────────────────────────────────────────

  const previewBanner = isPreviewMode ? (
    <Box
      sx={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        zIndex: 1000,
        bgcolor: "#f59e0b",
        color: "#45443F",
        textAlign: "center",
        py: 0.75,
        px: 2,
        fontSize: "0.8rem",
        fontWeight: 700,
        letterSpacing: "0.06em",
      }}
    >
      PREVIEW MODE — Includes unpublished content
    </Box>
  ) : null;

  const previewPt = isPreviewMode
    ? { xs: "calc(2rem + 36px)", sm: "calc(2.5rem + 36px)", md: "calc(3.5rem + 36px)" }
    : undefined;

  // ── Loading ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box role="status" sx={{ position: "fixed", inset: 0, bgcolor: colors.lightBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Box component="span" sx={srOnlySx}>Loading guide…</Box>
        <Box aria-hidden="true" sx={{ position: "relative", display: "inline-flex" }}>
          <CircularProgress variant="determinate" value={100} size={48} thickness={4} sx={{ color: "rgba(0,0,84,0.15)" }} />
          <CircularProgress size={48} thickness={4} sx={{ color: colors.primary, position: "absolute", left: 0, "& .MuiCircularProgress-circle": { strokeLinecap: "round" } }} />
        </Box>
      </Box>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────

  if (notFound) {
    return (
      <Box component="main" sx={{ minHeight: "100vh", bgcolor: colors.lightBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Stack spacing={3} alignItems="center" sx={{ textAlign: "center", px: 3 }}>
          <Typography variant="h4" component="h1" fontWeight={700} color={colors.text}>Item not found</Typography>
          <Typography variant="body1" color={colors.lightText}>
            This link is no longer available or has been removed.
          </Typography>
          <Box
            component="button"
            onClick={() => router.push("/")}
            sx={{
              bgcolor: colors.primary, color: "#fff", fontWeight: 700,
              textTransform: "none", borderRadius: 2, px: 3, py: 1,
              border: "none", cursor: "pointer", fontSize: "1rem",
              "&:hover": { bgcolor: colors.darkBg },
            }}
          >
            Back to Homepage
          </Box>
        </Stack>
      </Box>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────

  if (error) {
    return (
      <Box component="main" sx={{ minHeight: "100vh", bgcolor: colors.lightBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!state?.hierarchyConfigured) {
    return (
      <Box component="main" sx={{ minHeight: "100vh", bgcolor: colors.lightBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Alert severity="info">This guide is not yet configured.</Alert>
      </Box>
    );
  }

  // ── Homepage (level 1 selection) ──────────────────────────────────────

  if (selectionStack.length === 0) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: colors.lightBg,
          pt: isPreviewMode ? { xs: "calc(4rem + 36px)", sm: "calc(5rem + 36px)", md: "calc(7rem + 36px)" } : { xs: 4, sm: 5, md: 7 },
          pb: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <SkipLink />
        {previewBanner}
        <Container maxWidth="md" component="main" id="main-content" ref={mainRef} tabIndex={-1} sx={mainFocusSx}>
          <Stack spacing={2} sx={{ mb: { xs: 5, sm: 6, md: 8 }, textAlign: "center" }}>
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: "2.25rem", sm: "2.75rem", md: "3.5rem" },
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: colors.text,
              }}
            >
              {state.homepageTitle || activeLevels[0]?.name || "Guide"}
            </Typography>
            <Typography
              variant="body1"
              sx={{ fontSize: { xs: "1rem", sm: "1.125rem" }, color: colors.lightText, lineHeight: 1.6 }}
            >
              {state.homepageDescription || `Select a ${(activeLevels[0]?.singularName ?? "item").toLowerCase()} to begin.`}
            </Typography>
          </Stack>

          {activeLevels[0]?.sectionSubtitle && (
            <Typography
              variant="body1"
              sx={{ fontSize: { xs: "0.95rem", sm: "1.05rem" }, color: colors.text, mb: { xs: 3, sm: 4 }, fontWeight: 500, textAlign: "center", letterSpacing: "0.01em" }}
            >
              {activeLevels[0].sectionSubtitle}
            </Typography>
          )}

          {visibleItems.length === 0 ? (
            <Alert severity="info">No items available yet.</Alert>
          ) : (
            <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
              {visibleItems.map((item) => (
                <Grid item xs={12} sm={6} md={4} key={item.id}>
                  <ItemCard
                    item={item}
                    isLastLevel={isLastSelectionLevel}
                    isPublished={itemPublishedMap[item.id] ?? false}
                    isPreview={isPreviewMode}
                    onClick={() => handleSelect(item, currentLevel!.id)}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Container>
        <Box sx={{ mt: "auto" }}>
          <Footer year={new Date().getFullYear()} isAdmin={false} />
        </Box>
      </Box>
    );
  }

  // ── Inner selection (level 2+) ────────────────────────────────────────

  if (!atSteps && currentLevel) {
    const level1Item = state.items[activeLevels[0]?.id ?? ""]?.find((i) => i.id === selectionStack[0]?.itemId);
    const level2Item = selectionStack.length > 1
      ? state.items[activeLevels[1]?.id ?? ""]?.find((i) => i.id === selectionStack[1]?.itemId)
      : null;

    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          bgcolor: colors.lightBg,
          pt: previewPt ?? { xs: 4, sm: 5, md: 7 },
          pb: 0,
        }}
      >
        <SkipLink />
        {previewBanner}
        <Container maxWidth="md">
          <Stack component="nav" aria-label="Guide navigation" direction="row" spacing={1.5} sx={{ mb: { xs: 4, sm: 5 }, alignItems: "center" }}>
            <NavIconButton onClick={() => handleBack(selectionStack.length - 1)} ariaLabel="Back">
              <ArrowBackIcon />
            </NavIconButton>
            <Stack spacing={0.25} sx={{ flex: 1, textAlign: "center" }}>
              <Typography variant="body2" sx={{ fontSize: { xs: "0.85rem", sm: "0.95rem" }, fontWeight: 500, color: colors.lightText }}>
                {level1Item?.name ?? ""}
              </Typography>
              {level2Item && (
                <Typography variant="caption" sx={{ fontSize: { xs: "0.75rem", sm: "0.8rem" }, fontWeight: 600, color: colors.primary, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  {level2Item.name}
                </Typography>
              )}
            </Stack>
            <NavIconButton onClick={() => handleBack(0)} ariaLabel="Home">
              <HomeIcon />
            </NavIconButton>
          </Stack>
          <Box component="main" id="main-content" ref={mainRef} tabIndex={-1} sx={mainFocusSx}>

            {!currentLevel.sectionTitle && (
              <Typography component="h1" sx={srOnlySx}>{currentLevel.name}</Typography>
            )}
            {(currentLevel.sectionTitle || currentLevel.sectionSubtitle) && (
              <Stack spacing={2} sx={{ mb: { xs: 4, sm: 5 }, textAlign: "center" }}>
                {currentLevel.sectionTitle && (
                  <Typography
                    variant="h2"
                    component="h1"
                    sx={{ fontSize: { xs: "1.75rem", sm: "2.25rem", md: "2.5rem" }, fontWeight: 800, letterSpacing: "-0.02em", color: colors.text }}
                  >
                    {currentLevel.sectionTitle}
                  </Typography>
                )}
                {currentLevel.sectionSubtitle && (
                  <Typography variant="body1" sx={{ fontSize: { xs: "0.95rem", sm: "1.05rem" }, color: colors.lightText, lineHeight: 1.5 }}>
                    {currentLevel.sectionSubtitle}
                  </Typography>
                )}
              </Stack>
            )}

            {visibleItems.length === 0 ? (
              <Alert severity="info">No items available yet.</Alert>
            ) : (
              <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
                {visibleItems.map((item) => (
                  <Grid item xs={12} sm={6} md={4} key={item.id}>
                    <ItemCard
                      item={item}
                      isLastLevel={isLastSelectionLevel}
                      isPublished={itemPublishedMap[item.id] ?? false}
                      isPreview={isPreviewMode}
                      onClick={() => handleSelect(item, currentLevel.id)}
                    />
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </Container>
        <Box sx={{ mt: "auto" }}>
          <Footer year={new Date().getFullYear()} isAdmin={false} />
        </Box>
      </Box>
    );
  }

  // ── Steps view ────────────────────────────────────────────────────────

  if (atSteps) {
    const level1Item = state.items[activeLevels[0]?.id ?? ""]?.find((i) => i.id === selectionStack[0]?.itemId);
    const level2Item = selectionStack.length > 1
      ? state.items[activeLevels[1]?.id ?? ""]?.find((i) => i.id === selectionStack[1]?.itemId)
      : null;
    const lastItem = parentEntry
      ? (state.items[parentLevel?.id ?? ""] ?? []).find((i) => i.id === parentEntry.itemId)
      : null;

    if (currentSteps.length === 0) {
      return (
        <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: colors.lightBg, py: { xs: 4, sm: 5, md: 7 }, pt: previewPt }}>
          <SkipLink />
          {previewBanner}
          <Container maxWidth="md">
            <Stack component="nav" aria-label="Guide navigation" direction="row" spacing={1.5} sx={{ mb: { xs: 4, sm: 5 }, alignItems: "center" }}>
              <NavIconButton onClick={() => handleBack(selectionStack.length - 1)} ariaLabel="Back">
                <ArrowBackIcon />
              </NavIconButton>
              <Stack spacing={0.25} sx={{ flex: 1, textAlign: "center" }}>
                <Typography variant="body2" sx={{ fontSize: { xs: "0.85rem", sm: "0.95rem" }, fontWeight: 500, color: colors.lightText }}>
                  {level1Item?.name ?? ""}
                </Typography>
                {level2Item && (
                  <Typography variant="caption" sx={{ fontSize: { xs: "0.75rem", sm: "0.8rem" }, fontWeight: 600, color: colors.primary, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    {level2Item.name}
                  </Typography>
                )}
              </Stack>
              <NavIconButton onClick={() => handleBack(0)} ariaLabel="Home">
                <HomeIcon />
              </NavIconButton>
            </Stack>
            <Box component="main" id="main-content" ref={mainRef} tabIndex={-1} sx={mainFocusSx}>
              <Stack alignItems="center" sx={{ mt: { xs: 6, sm: 8 }, textAlign: "center" }}>
                <Alert severity="info">Content unavailable, check with staff</Alert>
              </Stack>
            </Box>
          </Container>
          <Box sx={{ mt: "auto" }}>
            <Footer year={new Date().getFullYear()} isAdmin={false} />
          </Box>
        </Box>
      );
    }

    return (
      <Box sx={{ minHeight: "100vh", bgcolor: colors.lightBg }}>
        <SkipLink />
        {previewBanner}
        <Box sx={{ height: 3, bgcolor: colors.primary, mt: isPreviewMode ? "36px" : 0 }} />

        <Box sx={{ py: { xs: 4, sm: 5, md: 7 } }}>
          <Container maxWidth="md">
            <Stack component="nav" aria-label="Guide navigation" direction="row" spacing={1.5} sx={{ mb: { xs: 4, sm: 5 }, alignItems: "center" }}>
              <NavIconButton onClick={() => handleBack(selectionStack.length - 1)} ariaLabel="Back">
                <ArrowBackIcon />
              </NavIconButton>
              <Stack spacing={0.25} sx={{ flex: 1, textAlign: "center" }}>
                <Typography variant="body2" sx={{ fontSize: { xs: "0.85rem", sm: "0.95rem" }, fontWeight: 500, color: colors.lightText }}>
                  {level1Item?.name ?? ""}
                </Typography>
                {level2Item && (
                  <Typography variant="caption" sx={{ fontSize: { xs: "0.75rem", sm: "0.8rem" }, fontWeight: 600, color: colors.primary, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    {level2Item.name}
                  </Typography>
                )}
              </Stack>
              <NavIconButton onClick={() => handleBack(0)} ariaLabel="Home">
                <HomeIcon />
              </NavIconButton>
            </Stack>
            <Box component="main" id="main-content" ref={mainRef} tabIndex={-1} sx={mainFocusSx}>

              <Box
                sx={{
                  position: "sticky",
                  top: isPreviewMode ? "36px" : 0,
                  zIndex: 10,
                  bgcolor: colors.lightBg,
                  pb: 2, pt: 1,
                  mb: { xs: 2, sm: 3 },
                  textAlign: "center",
                }}
              >
                <Typography
                  variant="h2"
                  component="h1"
                  sx={{ fontSize: { xs: "1.75rem", sm: "2.25rem", md: "2.5rem" }, fontWeight: 800, letterSpacing: "-0.02em", color: colors.text, mb: 1 }}
                >
                  {lastItem?.name ?? ""}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ fontSize: { xs: "0.9rem", sm: "1rem" }, fontWeight: 600, color: colors.text, letterSpacing: "0.05em" }}
                >
                  STEP {currentSteps.length === 0 ? 0 : activeStepIndex + 1} OF {currentSteps.length}
                </Typography>
                {/* Debounced screen-reader announcement of the visual counter above */}
                <Box component="p" role="status" sx={srOnlySx}>
                  {currentSteps.length > 0 ? `Step ${announcedStepIndex + 1} of ${currentSteps.length}` : ""}
                </Box>
              </Box>

              <Stack spacing={{ xs: 3, sm: 4 }} sx={{ pb: { xs: 6, sm: 8 } }}>
                {currentSteps.map((step, index) => {
                  const embedUrl = step.videoUrl ? getVideoEmbedUrl(step.videoUrl) : null;
                  const isDirectVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(step.videoUrl ?? "");
                  return (
                    <Card
                      key={step.id}
                      ref={(el) => { stepRefs.current[index] = el; }}
                      data-step-index={index}
                      sx={{ borderRadius: "8px", border: "none", backgroundColor: colors.cardBg, boxShadow: colors.cardShadow, overflow: "hidden" }}
                    >
                      <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: { xs: 2, sm: 2.5 } }}>
                          <Box
                            sx={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              width: 40, height: 40, bgcolor: colors.darkBg, color: colors.lightBg,
                              fontWeight: 700, borderRadius: 1, fontSize: "1.1rem", flexShrink: 0,
                            }}
                          >
                            {index + 1}
                          </Box>
                          {step.title && (
                            <Typography variant="h6" component="h2" sx={{ fontSize: { xs: "1rem", sm: "1.1rem" }, fontWeight: 600, color: colors.primary }}>
                              {step.title}
                            </Typography>
                          )}
                        </Stack>

                        {step.contentHtml && (
                          <Box
                            sx={{
                              fontSize: { xs: "0.95rem", sm: "1rem" }, color: colors.text, lineHeight: 1.6,
                              mb: { xs: 2, sm: 3 }, wordBreak: "break-word",
                              "& p": { mb: 1 }, "& ul, & ol": { pl: 2, mb: 1 }, "& li": { mb: 0.5 },
                              "& strong, & b": { fontWeight: 700 }, "& em, & i": { fontStyle: "italic" },
                              "& a": { color: colors.primary, textDecoration: "underline", "&:hover": { opacity: 0.8 } },
                            }}
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(step.contentHtml) }}
                          />
                        )}

                        {embedUrl ? (
                          isDirectVideo ? (
                            <Box component="video" controls sx={{ width: "100%", borderRadius: 1 }}>
                              <source src={step.videoUrl} />
                            </Box>
                          ) : (
                            <Box sx={{ position: "relative", width: "100%", paddingBottom: "56.25%", borderRadius: 1, overflow: "hidden" }}>
                              <Box
                                component="iframe"
                                src={embedUrl}
                                title={step.title || "Step video"}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                sx={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                              />
                            </Box>
                          )
                        ) : step.imageUrl ? (
                          <StepImage
                            src={step.imageUrl}
                            alt={step.title}
                            onClick={() => { setEnlargedImage({ url: step.imageUrl!, alt: step.title || "Step image" }); setImgZoom(1); }}
                          />
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            </Box>
          </Container>
        </Box>

        <Footer year={new Date().getFullYear()} isAdmin={false} />

        {/* Image zoom modal */}
        <Modal
          open={!!enlargedImage}
          onClose={() => { setEnlargedImage(null); setImgZoom(1); }}
          sx={{ display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "rgba(0,0,0,0.85)" }}
        >
          <Box
            role="dialog"
            aria-modal="true"
            aria-label={enlargedImage ? `Enlarged image: ${enlargedImage.alt}` : "Enlarged image"}
            sx={{ position: "relative", outline: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}
          >
            <IconButton
              onClick={() => { setEnlargedImage(null); setImgZoom(1); }}
              aria-label="Close image viewer"
              sx={{
                position: "absolute", top: 8, right: 8, zIndex: 1,
                color: "white", width: 44, height: 44,
                bgcolor: "rgba(0,0,0,0.6)",
                "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
              }}
            >
              <CloseIcon />
            </IconButton>
            <Box
              // A scrollable region must be keyboard operable: focusable with a
              // name while zoomed, so the arrow keys pan the image
              tabIndex={imgZoom > 1 ? 0 : undefined}
              role={imgZoom > 1 ? "group" : undefined}
              aria-label={imgZoom > 1 ? "Zoomed image. Use the arrow keys to pan." : undefined}
              sx={{
                overflow: "auto", maxWidth: "90vw", maxHeight: "80vh", borderRadius: "8px", bgcolor: "#111", lineHeight: 0,
                "&:focus-visible": { outline: "3px solid #fff", outlineOffset: 2 },
              }}
            >
              {enlargedImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={enlargedImage.url}
                  alt={enlargedImage.alt}
                  style={{ display: "block", width: `${imgZoom * 100}%`, height: "auto", cursor: imgZoom > 1 ? "zoom-out" : "zoom-in" }}
                  onClick={() => setImgZoom((z) => (z > 1 ? 1 : 1.5))}
                />
              )}
            </Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ bgcolor: "rgba(0,0,0,0.6)", borderRadius: 2, px: 1.5, py: 0.5 }}>
              <IconButton
                onClick={() => setImgZoom((z) => Math.max(1, z - 0.5))}
                disabled={imgZoom <= 1}
                aria-label="Zoom out"
                sx={{ color: "white", width: 44, height: 44, "&.Mui-disabled": { color: "rgba(255,255,255,0.4)" } }}
              >
                <RemoveIcon fontSize="small" />
              </IconButton>
              <Typography variant="caption" sx={{ color: "white", minWidth: 36, textAlign: "center" }}>
                {Math.round(imgZoom * 100)}%
              </Typography>
              <IconButton
                onClick={() => setImgZoom((z) => Math.min(1.5, z + 0.5))}
                disabled={imgZoom >= 1.5}
                aria-label="Zoom in"
                sx={{ color: "white", width: 44, height: 44, "&.Mui-disabled": { color: "rgba(255,255,255,0.4)" } }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Box>
        </Modal>

        {showBackToTop && (
          <Fab
            size="small"
            onClick={scrollToTop}
            aria-label="Back to top"
            sx={{
              position: "fixed", bottom: 72, right: 24, zIndex: 20,
              bgcolor: colors.primary, color: "#ffffff",
              "&:hover": { bgcolor: colors.darkBg },
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          >
            <KeyboardArrowUpIcon />
          </Fab>
        )}
      </Box>
    );
  }

  return null;
}
