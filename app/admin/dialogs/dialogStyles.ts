export const DIALOG_PAPER_SX = {
  borderRadius: 2,
  boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
} as const;

export const DIALOG_TITLE_SX = {
  bgcolor: "#f2f2f2",
  borderBottom: "2px solid #E5E1D7",
  fontWeight: 700,
  color: "#000054",
  fontSize: "1.1rem",
  py: 2.5,
} as const;

export const DIALOG_ACTIONS_SX = {
  borderTop: "1px solid #E5E1D7",
  bgcolor: "#f2f2f2",
  pt: 2,
  pb: 2,
  px: 3,
} as const;

export const PRIMARY_BTN_SX = {
  bgcolor: "#000054",
  color: "#fff",
  fontWeight: 600,
  textTransform: "none" as const,
  "&:hover": { bgcolor: "#00003f" },
};

export const CANCEL_BTN_SX = {
  color: "#000054",
  fontWeight: 600,
  textTransform: "none" as const,
};

export const UPLOAD_BTN_SX = {
  border: "2px solid #000054",
  borderRadius: 1,
  p: 1.5,
  color: "#000054",
  "&:hover": { bgcolor: "rgba(0,0,84,0.08)" },
} as const;
