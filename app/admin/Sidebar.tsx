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
const ACTIVE_BG = "rgba(61, 128, 120, 0.25)";
const HOVER_BG = "rgba(255, 255, 255, 0.1)";
const ACTIVE_TEXT = "#FDF9F1";
const TEAL = "#3D8078";
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
        sx={{
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
            <IconButton size="small" onClick={toggleCollapsed} sx={{ color: MUTED, "&:hover": { color: TEXT } }}>
              <ExpandIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>

        <Stack spacing={1.5} alignItems="center" sx={{ width: "100%" }}>
          {/* Home */}
          <Tooltip title="Home" placement="right">
            <IconButton
              onClick={onGoHome}
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
              sx={{ width: 50, height: 50, borderRadius: 1, color: MUTED, "&:hover": { bgcolor: HOVER_BG } }}
            >
              <VisibilityIcon sx={{ fontSize: 24 }} />
            </IconButton>
          </Tooltip>

          {/* PREVIEW CURRENT PAGE */}
          <Tooltip title="Preview Current Page" placement="right">
            <IconButton
              onClick={onPreview}
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
                onClick={() => onNavigateLevel1(item)}
                sx={{ display: "flex", justifyContent: "center", cursor: "pointer" }}
              >
                <Avatar
                  src={item.thumbnailUrl}
                  variant="rounded"
                  sx={{
                    width: 40, height: 40,
                    border: currentLevel1ItemId === item.id ? "2px solid" : "1px solid transparent",
                    borderColor: TEAL,
                    bgcolor: currentLevel1ItemId === item.id ? ACTIVE_BG : "#62615C",
                    transition: "all 180ms ease",
                    "&:hover": { boxShadow: `0 0 0 2px rgba(61,128,120,0.4)` },
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
                sx={{ width: 40, height: 40, borderRadius: 1, color: TEAL, "&:hover": { bgcolor: ACTIVE_BG } }}
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

        <Tooltip title="Deleted Items" placement="right">
          <IconButton
            onClick={onShowDeleted}
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
      sx={{
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
            "&:hover": { color: TEAL },
          }}
        >
          <HomeIcon sx={{ fontSize: 22 }} />
          Dashboard
        </Box>
        <Tooltip title="Collapse sidebar">
          <IconButton
            size="small"
            onClick={toggleCollapsed}
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
                  "&.Mui-focused fieldset": { borderColor: TEAL },
                },
                "& .MuiInputLabel-root": {
                  color: "rgba(255,255,255,0.6)",
                  "&.Mui-focused": { color: TEAL },
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
                  "&.Mui-focused fieldset": { borderColor: TEAL },
                },
                "& .MuiInputLabel-root": {
                  color: "rgba(255,255,255,0.6)",
                  "&.Mui-focused": { color: TEAL },
                },
              }}
            />

            {(homepageDirty || homepageSaving || homepageSaved) && (
              <Stack direction="row" spacing={1} alignItems="center">
                {homepageSaving ? (
                  <CircularProgress size={16} sx={{ color: TEAL }} />
                ) : homepageSaved ? (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <CheckIcon sx={{ fontSize: 16, color: "#1A7A2E" }} />
                    <Typography variant="caption" sx={{ color: "#1A7A2E" }}>Saved</Typography>
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
                        bgcolor: TEAL, "&:hover": { bgcolor: "#2D6059" },
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
          <Typography
            variant="subtitle2"
            fontWeight={600}
            onClick={onGoHome}
            sx={{
              color: TEXT, textTransform: "uppercase",
              fontSize: "0.75rem", letterSpacing: "0.5px",
              cursor: "pointer", "&:hover": { color: TEAL },
            }}
          >
            {level1Name}
          </Typography>
        </Box>

        {level1Items.length > 0 ? (
          <>
            <List sx={{ p: 0, borderRadius: 1 }}>
              {shownItems.map((item) => (
                <ListItem key={item.id} disablePadding>
                  <ListItemButton
                    selected={currentLevel1ItemId === item.id}
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
                        variant="rounded"
                        sx={{
                          width: 32, height: 32, bgcolor: "#62615C",
                          border: currentLevel1ItemId === item.id ? "2px solid #3D8078" : "1px solid transparent",
                        }}
                      >
                        <ImageIcon sx={{ fontSize: 14 }} />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={item.name}
                      sx={{ "& .MuiListItemText-primary": { color: "inherit", fontSize: "0.875rem" } }}
                    />
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); onLevel1ItemMenu(item, e.currentTarget); }}
                      sx={{ ml: 0.5, color: "inherit", "&:hover": { color: TEAL } }}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
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
                  mt: 0.5, textTransform: "none", color: TEAL,
                  borderColor: "rgba(61,128,120,0.25)",
                  "&:hover": { bgcolor: "rgba(61,128,120,0.1)", borderColor: "rgba(61,128,120,0.4)" },
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
                    "&:hover": { bgcolor: active ? "#2D6059" : HOVER_BG },
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
        startIcon={<DeleteOutlineIcon />}
        variant={showDeleted ? "contained" : "outlined"}
        onClick={onShowDeleted}
        sx={{
          justifyContent: "flex-start",
          bgcolor: showDeleted ? TEAL : "transparent",
          color: showDeleted ? "#fff" : TEXT,
          borderColor: "rgba(255,255,255,0.2)",
          textTransform: "none",
          "&:hover": { bgcolor: showDeleted ? "#2D6059" : HOVER_BG },
        }}
      >
        Deleted Items
      </Button>

      {/* Footer */}
      <Box sx={{ mt: "auto", pt: 3 }}>
        <div style={{ fontSize: 11, color: "#fff", opacity: 0.5, letterSpacing: "0.3px" }}>
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
