"use client";

import { CssBaseline, ThemeProvider, createTheme, responsiveFontSizes } from "@mui/material";
import type { ReactNode } from "react";
import { AuthProvider } from "./auth-provider";

const baseTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#000054",
    },
    secondary: {
      main: "#62615C",
    },
    background: {
      default: "#f2f2f2",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#45443F",
      secondary: "#62615C",
    },
    success: {
      main: "#1A7A2E",
    },
    error: {
      main: "#C4321A",
    },
    warning: {
      main: "#f59e0b",
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: {
      fontSize: "3rem",
      fontWeight: 800,
      lineHeight: 1.1,
      letterSpacing: "-0.02em",
    },
    h2: {
      fontSize: "2.5rem",
      fontWeight: 800,
      lineHeight: 1.15,
      letterSpacing: "-0.02em",
    },
    h3: {
      fontSize: "2rem",
      fontWeight: 700,
      lineHeight: 1.2,
    },
    h4: {
      fontSize: "1.75rem",
      fontWeight: 700,
      lineHeight: 1.25,
    },
    h5: {
      fontSize: "1.25rem",
      fontWeight: 700,
      lineHeight: 1.3,
    },
    h6: {
      fontSize: "1.1rem",
      fontWeight: 600,
      lineHeight: 1.4,
    },
    subtitle1: {
      fontSize: "1rem",
      fontWeight: 500,
      lineHeight: 1.5,
    },
    subtitle2: {
      fontSize: "0.875rem",
      fontWeight: 600,
      lineHeight: 1.5,
    },
    body1: {
      fontSize: "1rem",
      fontWeight: 400,
      lineHeight: 1.6,
    },
    body2: {
      fontSize: "0.875rem",
      fontWeight: 400,
      lineHeight: 1.5,
    },
    caption: {
      fontSize: "0.75rem",
      fontWeight: 400,
      lineHeight: 1.4,
    },
    overline: {
      fontSize: "0.75rem",
      fontWeight: 800,
      lineHeight: 1.4,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
    },
    button: {
      fontSize: "0.875rem",
      fontWeight: 600,
      letterSpacing: "0.02em",
      textTransform: "none",
    },
  },
});

const theme = responsiveFontSizes(baseTheme);

type ProvidersProps = {
  children: ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AuthProvider>
  );
}
