"use client";

import { Box, Button, Stack, Typography } from "@mui/material";
import Link from "next/link";

export default function NotFound() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f2f2f2",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Stack spacing={3} alignItems="center" sx={{ textAlign: "center", px: 3 }}>
        <Typography variant="h4" fontWeight={700} sx={{ color: "#45443F" }}>
          Page not found
        </Typography>
        <Typography variant="body1" sx={{ color: "#62615C" }}>
          This link is no longer available or has been removed.
        </Typography>
        <Button
          component={Link}
          href="/"
          variant="contained"
          sx={{
            bgcolor: "#000054",
            color: "#fff",
            fontWeight: 700,
            textTransform: "none",
            borderRadius: 2,
            px: 3,
            py: 1,
            "&:hover": { bgcolor: "#45443F" },
          }}
        >
          Back to Homepage
        </Button>
      </Stack>
    </Box>
  );
}
