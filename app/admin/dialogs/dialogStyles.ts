export const DIALOG_PAPER_SX = {
  borderRadius: 2,
  boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
} as const;

export const DIALOG_TITLE_SX = {
  bgcolor: "#FDF9F1",
  borderBottom: "2px solid #E5E1D7",
  fontWeight: 700,
  color: "#3D8078",
  fontSize: "1.1rem",
  py: 2.5,
} as const;

export const DIALOG_ACTIONS_SX = {
  borderTop: "1px solid #E5E1D7",
  bgcolor: "#FDF9F1",
  pt: 2,
  pb: 2,
  px: 3,
} as const;

export const PRIMARY_BTN_SX = {
  bgcolor: "#3D8078",
  color: "#fff",
  fontWeight: 600,
  textTransform: "none" as const,
  "&:hover": { bgcolor: "#2D6059" },
};

export const CANCEL_BTN_SX = {
  color: "#3D8078",
  fontWeight: 600,
  textTransform: "none" as const,
};

export const UPLOAD_BTN_SX = {
  border: "2px solid #3D8078",
  borderRadius: 1,
  p: 1.5,
  color: "#3D8078",
  "&:hover": { bgcolor: "rgba(61,128,120,0.08)" },
} as const;
