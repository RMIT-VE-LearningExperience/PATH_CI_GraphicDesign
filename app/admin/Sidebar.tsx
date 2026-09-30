"use client";

import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ArrowBackIosNew as CollapseIcon,
  ArrowForwardIos as ExpandIcon,
  AutoAwesome as AutoAwesomeIcon,
  Check as CheckIcon,
  DeleteOutline as DeleteOutlineIcon,
  Home as HomeIcon,
  Image as ImageIcon,
  Inventory as InventoryIcon,
  MoreVert as MoreVertIcon,
  Pageview as PageviewIcon,
  Palette as PaletteIcon,
  Save as SaveIcon,
  Visibility as VisibilityIcon,
} from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";
import type { AppSettings, Item, Level } from "../../lib/tutorial-store";

type NavEntry = { levelId: string; itemId: string; itemName: string };

type Props = {
  activeLevels: Level[];
  features: AppSettings["features"];
  navStack: NavEntry[];
  onGoHome: () => void;
  onGlobalList: (levelId: string) => void;
  globalListLevelId: string | null;
  onShowDeleted: () => void;
  showDeleted: boolean;
  homepageTitle: string;
  homepageDescription: string;
  onSaveHomepage: (title: string, description: string) => void;
  homepageSaving: boolean;
  homepageSaved: boolean;
  onPreview: () => void;
  previewLoading: boolean;
  level1Items: Item[];
  onNavigateLevel1: (item: Item) => void;
  onLevel1ItemMenu: (item: Item, anchorEl: HTMLElement) => void;
};

const BG = "#45443F";
const TEXT = "#E5E1D7";
const MUTED = "#C2BDB1";
const ACTIVE_BG = "rgba(184, 184, 209, 0.25)";
const HOVER_BG = "rgba(255, 255, 255, 0.1)";
const ACTIVE_TEXT = "#f2f2f2";
const TEAL = "#000054"; // fills behind white text
// Navy is too dark to read against the sidebar background, so text, borders
// and focus indicators drawn on it use this light tint instead (>4.5:1)
const ACCENT = "#b8b8d1";
const focusRingSx = {
  "& button:focus-visible, & a:focus-visible, & [role='button']:focus-visible": {
    outline: `2px solid ${ACCENT}`,
    outlineOffset: 2,
  },
};
const EXPANDED_WIDTH = 300;
const COLLAPSED_WIDTH = 80;

function levelIcon(type: Level["type"]) {
  if (type === "type1") return <InventoryIcon sx={{ fontSize: 20 }} />;
  if (type === "type2") return <PaletteIcon sx={{ fontSize: 20 }} />;
  return <InventoryIcon sx={{ fontSize: 20 }} />;
}

export default function Sidebar({
  activeLevels,
  features,
  navStack,
  onGoHome,
  onGlobalList,
  globalListLevelId,
  onShowDeleted,
  showDeleted,
  homepageTitle,
  homepageDescription,
  onSaveHomepage,
  homepageSaving,
  homepageSaved,
  onPreview,
  previewLoading,
  level1Items,
  onNavigateLevel1,
  onLevel1ItemMenu,
}: Props) {
  const atHome = navStack.length === 0 && !showDeleted && globalListLevelId === null;

  const [localTitle, setLocalTitle] = useState(homepageTitle);
  const [localDesc, setLocalDesc] = useState(homepageDescription);
  const savedTitle = useRef(homepageTitle);
  const savedDesc = useRef(homepageDescription);

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("adminSidebarCollapsed") === "true";
  });

  useEffect(() => {
    setLocalTitle(homepageTitle);
    setLocalDesc(homepageDescription);
    savedTitle.current = homepageTitle;
    savedDesc.current = homepageDescription;
  }, [homepageTitle, homepageDescription]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("adminSidebarCollapsed", String(next));
      return next;
    });
  }

  function cancelHomepage() {
    setLocalTitle(savedTitle.current);
    setLocalDesc(savedDesc.current);
  }

  const homepageDirty =
    localTitle !== homepageTitle || localDesc !== homepageDescription;

  const sidebarLevels = activeLevels.slice(1);
  const shownItems = level1Items.slice(0, 3);
  const extraCount = level1Items.length - 3;
  const level1Name = activeLevels[0]?.name?.toUpperCase() ?? "ITEMS";

  const currentLevel1ItemId =
    !globalListLevelId && !showDeleted ? (navStack[0]?.itemId ?? null) : null;

  const outlinedBtnSx = {
    justifyContent: "flex-start",
    color: TEXT,
    borderColor: "rgba(255, 255, 255, 0.2)",
    textTransform: "none" as const,
    "&:hover": { bgcolor: HOVER_BG },
  };

  // ── Collapsed ─────────────────────────────────────────────────────────

  if (collapsed) {
    return (
      <Box
        component="nav"
        aria-label="Dashboard navigation"
        sx={{
          ...focusRingSx,
          width: COLLAPSED_WIDTH,
          minHeight: "100vh",
          bgcolor: BG,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flexShrink: 0,
          py: 1,
        }}
      >
        <Box sx={{ width: "100%", display: "flex", justifyContent: "flex-end", px: 1, mb: 1 }}>
          <Tooltip title="Expand sidebar" placement="right">
            <IconButton size="small" aria-label="Expand sidebar" onClick={toggleCollapsed} sx={{ color: MUTED, "&:hover": { color: TEXT } }}>
              <ExpandIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>

        <Stack spacing={1.5} alignItems="center" sx={{ width: "100%" }}>
          {/* Home */}
          <Tooltip title="Home" placement="right">
            <IconButton
              onClick={onGoHome}
              aria-label="Home"
              aria-current={atHome ? "page" : undefined}
              sx={{
                width: 50, height: 50, borderRadius: 1,
                color: atHome ? ACTIVE_TEXT : MUTED,
                bgcolor: atHome ? ACTIVE_BG : "transparent",
                "&:hover": { bgcolor: HOVER_BG },
              }}
            >
              <HomeIcon sx={{ fontSize: 24 }} />
            </IconButton>
          </Tooltip>

          {/* VIEW APP */}
          <Tooltip title="Preview from Start" placement="right">
            <IconButton
              onClick={() => window.open("/?home=1", "_blank")}
              aria-label="Preview from start (opens in a new tab)"
              sx={{ width: 50, height: 50, borderRadius: 1, color: MUTED, "&:hover": { bgcolor: HOVER_BG } }}
            >
              <VisibilityIcon sx={{ fontSize: 24 }} />
            </IconButton>
          </Tooltip>

          {/* PREVIEW CURRENT PAGE */}
          <Tooltip title="Preview Current Page" placement="right">
            <IconButton
              onClick={onPreview}
              aria-label="Preview current page"
              sx={{ width: 50, height: 50, borderRadius: 1, color: MUTED, "&:hover": { bgcolor: HOVER_BG } }}
            >
              <PageviewIcon sx={{ fontSize: 24 }} />
            </IconButton>
          </Tooltip>
        </Stack>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.15)", width: "80%", my: 1.5 }} />

        {/* Level 1 items */}
        <Stack spacing={1.5} alignItems="center" sx={{ width: "100%" }}>
          {shownItems.map((item) => (
            <Tooltip key={item.id} title={item.name} placement="right">
              <Box
                component="button"
                type="button"
                onClick={() => onNavigateLevel1(item)}
                aria-label={item.name}
                aria-current={currentLevel1ItemId === item.id ? "page" : undefined}
                sx={{ display: "flex", justifyContent: "center", cursor: "pointer", background: "none", border: "none", p: 0, borderRadius: 1 }}
              >
                <Avatar
                  src={item.thumbnailUrl}
                  alt=""
                  variant="rounded"
                  sx={{
                    width: 40, height: 40,
                    border: currentLevel1ItemId === item.id ? "2px solid" : "1px solid transparent",
                    borderColor: ACCENT,
                    bgcolor: currentLevel1ItemId === item.id ? ACTIVE_BG : "#62615C",
                    transition: "all 180ms ease",
                    "&:hover": { boxShadow: `0 0 0 2px rgba(0,0,84,0.4)` },
                  }}
                >
                  <ImageIcon sx={{ fontSize: 18, color: MUTED }} />
                </Avatar>
              </Box>
            </Tooltip>
          ))}
          {extraCount > 0 && (
            <Tooltip title="More…" placement="right">
              <IconButton
                onClick={onGoHome}
                size="small"
                aria-label="More"
                sx={{ width: 40, height: 40, borderRadius: 1, color: ACCENT, "&:hover": { bgcolor: ACTIVE_BG } }}
              >
                ⋯
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        {features.fullItemListView && sidebarLevels.length > 0 && (
          <>
            <Divider sx={{ borderColor: "rgba(255,255,255,0.15)", width: "80%", my: 1.5 }} />
            <Stack spacing={1.5} alignItems="center" sx={{ width: "100%" }}>
              {sidebarLevels.map((level) => (
                <Tooltip
                  key={level.id}
                  title={level.type === "type1" ? `Full ${level.name} List` : `${level.name} Management`}
                  placement="right"
                >
                  <IconButton
                    onClick={() => onGlobalList(level.id)}
                    aria-label={level.type === "type1" ? `Full ${level.name} List` : `${level.name} Management`}
                    aria-current={globalListLevelId === level.id ? "page" : undefined}
                    sx={{
                      width: 50, height: 50, borderRadius: 1,
                      color: globalListLevelId === level.id ? ACTIVE_TEXT : MUTED,
                      bgcolor: globalListLevelId === level.id ? ACTIVE_BG : "transparent",
                      "&:hover": { bgcolor: HOVER_BG },
                    }}
                  >
                    {levelIcon(level.type)}
                  </IconButton>
                </Tooltip>
              ))}
            </Stack>
          </>
        )}

        <Divider sx={{ borderColor: "rgba(255,255,255,0.15)", width: "80%", my: 1.5 }} />

        <Tooltip title="Image Alt Text (VAL)" placement="right">
          <IconButton
            onClick={() => { window.location.assign("/admin/alt-text"); }}
            aria-label="Image Alt Text (VAL)"
            sx={{
              width: 50, height: 50, borderRadius: 1, color: MUTED,
              "&:hover": { bgcolor: HOVER_BG },
            }}
          >
            <AutoAwesomeIcon sx={{ fontSize: 24 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Deleted Items" placement="right">
          <IconButton
            onClick={onShowDeleted}
            aria-label="Deleted Items"
            aria-current={showDeleted ? "page" : undefined}
            sx={{
              width: 50, height: 50, borderRadius: 1,
              color: showDeleted ? ACTIVE_TEXT : MUTED,
              bgcolor: showDeleted ? ACTIVE_BG : "transparent",
              "&:hover": { bgcolor: HOVER_BG },
            }}
          >
            <DeleteOutlineIcon sx={{ fontSize: 24 }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  // ── Expanded ──────────────────────────────────────────────────────────

  return (
    <Box
      component="nav"
      aria-label="Dashboard navigation"
      sx={{
        ...focusRingSx,
        width: EXPANDED_WIDTH,
        minHeight: "100vh",
        bgcolor: BG,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        p: 2,
      }}
    >
      {/* Header row */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box
          component="button"
          onClick={onGoHome}
          sx={{
            display: "flex", alignItems: "center", gap: 0.75,
            background: "none", border: "none", cursor: "pointer",
            color: TEXT, fontWeight: 600, fontSize: "1.1rem",
            textAlign: "left", p: 0, flex: 1,
            "&:hover": { color: ACCENT },
          }}
        >
          <HomeIcon sx={{ fontSize: 22 }} />
          Dashboard
        </Box>
        <Tooltip title="Collapse sidebar">
          <IconButton
            size="small"
            onClick={toggleCollapsed}
            aria-label="Collapse sidebar"
            sx={{ p: 0.5, color: TEXT, "&:hover": { bgcolor: HOVER_BG } }}
          >
            <CollapseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* VIEW APP + PREVIEW */}
      <Stack spacing={1}>
        <Button
          fullWidth
          startIcon={<VisibilityIcon />}
          variant="outlined"
          onClick={() => window.open("/?home=1", "_blank")}
          sx={outlinedBtnSx}
        >
          VIEW APP
        </Button>
        <Button
          fullWidth
          startIcon={<PageviewIcon />}
          variant="outlined"
          onClick={onPreview}
          disabled={previewLoading}
          sx={outlinedBtnSx}
        >
          {previewLoading ? "Opening preview…" : "PREVIEW CURRENT PAGE"}
        </Button>
      </Stack>

      <Divider sx={{ my: 1.5, borderColor: "rgba(255,255,255,0.15)" }} />

      {/* Homepage fields — only at home view */}
      {atHome && (
        <>
          <Stack spacing={2} sx={{ mb: 2 }}>
            <TextField
              label="Homepage Header"
              size="small"
              fullWidth
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              sx={{
                "& .MuiInputBase-input": { color: TEXT },
                "& .MuiOutlinedInput-root": {
                  "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                  "&:hover fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                  "&.Mui-focused fieldset": { borderColor: ACCENT },
                },
                "& .MuiInputLabel-root": {
                  color: "rgba(255,255,255,0.6)",
                  "&.Mui-focused": { color: ACCENT },
                },
              }}
            />
            <TextField
              label="Homepage Description"
              size="small"
              fullWidth
              multiline
              rows={3}
              value={localDesc}
              onChange={(e) => setLocalDesc(e.target.value)}
              sx={{
                "& .MuiInputBase-input": { color: TEXT },
                "& .MuiOutlinedInput-root": {
                  "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                  "&:hover fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                  "&.Mui-focused fieldset": { borderColor: ACCENT },
                },
                "& .MuiInputLabel-root": {
                  color: "rgba(255,255,255,0.6)",
                  "&.Mui-focused": { color: ACCENT },
                },
              }}
            />

            {(homepageDirty || homepageSaving || homepageSaved) && (
              <Stack direction="row" spacing={1} alignItems="center" role="status">
                {homepageSaving ? (
                  <CircularProgress size={16} sx={{ color: ACCENT }} />
                ) : homepageSaved ? (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <CheckIcon aria-hidden="true" sx={{ fontSize: 16, color: "#7FD98F" }} />
                    <Typography variant="caption" sx={{ color: "#7FD98F" }}>Saved</Typography>
                  </Stack>
                ) : (
                  <>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => onSaveHomepage(localTitle, localDesc)}
                      startIcon={<SaveIcon sx={{ fontSize: "14px !important" }} />}
                      sx={{
                        fontSize: "0.7rem", py: 0.4, px: 1, minWidth: 0,
                        bgcolor: TEAL, "&:hover": { bgcolor: "#00003f" },
                        textTransform: "none",
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      onClick={cancelHomepage}
                      sx={{
                        fontSize: "0.7rem", py: 0.4, px: 1, minWidth: 0,
                        color: "rgba(255,255,255,0.6)",
                        "&:hover": { color: TEXT, bgcolor: HOVER_BG },
                        textTransform: "none",
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </Stack>
            )}
          </Stack>

          <Divider sx={{ my: 1.5, borderColor: "rgba(255,255,255,0.15)" }} />
        </>
      )}

      {/* Level 1 items section */}
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box
            component="button"
            type="button"
            onClick={onGoHome}
            sx={{
              background: "none", border: "none", p: 0,
              color: TEXT, textTransform: "uppercase", textAlign: "left",
              fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.5px", fontFamily: "inherit",
              cursor: "pointer", "&:hover": { color: ACCENT },
            }}
          >
            {level1Name}
          </Box>
        </Box>

        {level1Items.length > 0 ? (
          <>
            <List sx={{ p: 0, borderRadius: 1 }}>
              {shownItems.map((item) => (
                <ListItem
                  key={item.id}
                  disablePadding
                  secondaryAction={
                    <IconButton
                      size="small"
                      edge="end"
                      aria-label={`More actions for ${item.name}`}
                      aria-haspopup="menu"
                      onClick={(e) => { onLevel1ItemMenu(item, e.currentTarget); }}
                      sx={{ color: TEXT, "&:hover": { color: ACCENT } }}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemButton
                    selected={currentLevel1ItemId === item.id}
                    aria-current={currentLevel1ItemId === item.id ? "page" : undefined}
                    onClick={() => onNavigateLevel1(item)}
                    sx={{
                      borderRadius: 1,
                      transition: "all 180ms ease",
                      bgcolor: currentLevel1ItemId === item.id ? ACTIVE_BG : "transparent",
                      color: currentLevel1ItemId === item.id ? ACTIVE_TEXT : TEXT,
                      "&:hover": { bgcolor: HOVER_BG },
                      "&.Mui-selected": { bgcolor: ACTIVE_BG },
                      "&.Mui-selected:hover": { bgcolor: ACTIVE_BG },
                    }}
                  >
                    <ListItemAvatar sx={{ minWidth: 40 }}>
                      <Avatar
                        src={item.thumbnailUrl}
                        alt=""
                        variant="rounded"
                        sx={{
                          width: 32, height: 32, bgcolor: "#62615C",
                          border: currentLevel1ItemId === item.id ? `2px solid ${ACCENT}` : "1px solid transparent",
                        }}
                      >
                        <ImageIcon sx={{ fontSize: 14 }} />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={item.name}
                      sx={{ "& .MuiListItemText-primary": { color: "inherit", fontSize: "0.875rem" } }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>

            {extraCount > 0 && (
              <Button
                fullWidth
                size="small"
                onClick={onGoHome}
                sx={{
                  mt: 0.5, textTransform: "none", color: ACCENT,
                  "&:hover": { bgcolor: HOVER_BG },
                }}
              >
                More
              </Button>
            )}
          </>
        ) : (
          <Typography variant="body2" sx={{ p: 2, textAlign: "center", color: "rgba(255,255,255,0.38)" }}>
            No {activeLevels[0]?.name?.toLowerCase() ?? "items"} yet
          </Typography>
        )}
      </Box>

      {features.fullItemListView && sidebarLevels.length > 0 && (
        <>
          <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.15)" }} />
          <Stack spacing={1}>
            {sidebarLevels.map((level) => {
              const active = globalListLevelId === level.id;
              const label = level.type === "type1" ? `Full ${level.name} List` : `${level.name} Management`;
              return (
                <Button
                  key={level.id}
                  fullWidth
                  startIcon={levelIcon(level.type)}
                  variant={active ? "contained" : "outlined"}
                  onClick={() => onGlobalList(level.id)}
                  sx={{
                    justifyContent: "flex-start",
                    bgcolor: active ? TEAL : "transparent",
                    color: active ? "#fff" : TEXT,
                    borderColor: "rgba(255,255,255,0.2)",
                    textTransform: "none",
                    "&:hover": { bgcolor: active ? "#00003f" : HOVER_BG },
                  }}
                >
                  {label}
                </Button>
              );
            })}
          </Stack>
        </>
      )}

      <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.15)" }} />

      <Button
        fullWidth
        startIcon={<AutoAwesomeIcon />}
        variant="outlined"
        onClick={() => { window.location.assign("/admin/alt-text"); }}
        sx={{ ...outlinedBtnSx, mb: 1 }}
      >
        Image Alt Text (VAL)
      </Button>

      <Button
        fullWidth
        startIcon={<DeleteOutlineIcon />}
        variant={showDeleted ? "contained" : "outlined"}
        onClick={onShowDeleted}
        sx={{
          justifyContent: "flex-start",
          bgcolor: showDeleted ? TEAL : "transparent",
          color: showDeleted ? "#fff" : TEXT,
          borderColor: "rgba(255,255,255,0.2)",
          textTransform: "none",
          "&:hover": { bgcolor: showDeleted ? "#00003f" : HOVER_BG },
        }}
      >
        Deleted Items
      </Button>

      {/* Footer */}
      <Box sx={{ mt: "auto", pt: 3 }}>
        <div style={{ fontSize: 11, color: "#C2BDB1", letterSpacing: "0.3px" }}>
          © {new Date().getFullYear()} Designed by the{" "}
          <a href="mailto:dmd.cove@rmit.edu.au" style={{ color: "#fff", textDecoration: "underline" }}>
            Digital Design &amp; Media Team
          </a>
          {" "}· Learning &amp; Teaching Innovation · RMIT College of Vocational Education
        </div>
      </Box>
    </Box>
  );
}
