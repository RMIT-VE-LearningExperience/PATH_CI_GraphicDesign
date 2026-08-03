"use client";

import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

type AnalyticsData = {
  summary: {
    pageViews: number;
    activeUsers: number;
    sessions: number;
    bounceRate: number;
    avgSessionDuration: number;
  };
  topPages: { path: string; views: number }[];
  dailyViews: { date: string; views: number }[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  getAuthToken: () => Promise<string>;
};

function DailyViewsChart({ rows }: { rows: { date: string; views: number }[] }) {
  const max = Math.max(...rows.map((r) => r.views), 1);
  const chartH = 120;
  const barW = 14;
  const gap = 4;
  const chartW = rows.length * (barW + gap);

  return (
    <Box sx={{ overflowX: "auto" }}>
      <svg width={chartW} height={chartH + 20} style={{ display: "block" }}>
        {rows.map((row, i) => {
          const barH = Math.max(2, Math.round((row.views / max) * chartH));
          const x = i * (barW + gap);
          const y = chartH - barH;
          return (
            <g key={row.date}>
              <rect x={x} y={y} width={barW} height={barH} rx={2} fill="#000054" />
              <title>{`${row.date}: ${row.views}`}</title>
              <text
                x={x + barW / 2}
                y={chartH + 14}
                textAnchor="middle"
                fontSize={9}
                fill="#888"
              >
                {row.date.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
    </Box>
  );
}

export default function StatsModal({ open, onClose, getAuthToken }: Props) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    setData(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    getAuthToken()
      .then((token) =>
        fetch("/api/analytics", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }),
      )
      .then(async (res) => {
        clearTimeout(timeout);
        if (!res.ok) {
          const d = (await res.json()) as { error?: string };
          setError(d.error ?? "Failed to load analytics");
          return;
        }
        const d = (await res.json()) as AnalyticsData;
        setData(d);
      })
      .catch((err: unknown) => {
        clearTimeout(timeout);
        if ((err as { name?: string }).name !== "AbortError") {
          setError("Failed to load analytics");
        }
      })
      .finally(() => setLoading(false));

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [open, getAuthToken]);

  function fmtDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Statistics</DialogTitle>
      <DialogContent>
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress size={36} />
          </Box>
        )}

        {!loading && error && (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
            {error === "Analytics not configured on this environment"
              ? "Analytics is not configured for this environment."
              : error}
          </Typography>
        )}

        {!loading && data && (
          <Stack spacing={3}>
            {/* Summary metrics */}
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              {[
                { label: "Page Views", value: data.summary.pageViews.toLocaleString() },
                { label: "Active Users", value: data.summary.activeUsers.toLocaleString() },
                { label: "Sessions", value: data.summary.sessions.toLocaleString() },
                { label: "Bounce Rate", value: `${(data.summary.bounceRate * 100).toFixed(1)}%` },
                { label: "Avg. Session", value: fmtDuration(data.summary.avgSessionDuration) },
              ].map(({ label, value }) => (
                <Box
                  key={label}
                  sx={{
                    flex: "1 1 140px",
                    p: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    textAlign: "center",
                  }}
                >
                  <Typography variant="h6" fontWeight={600}>
                    {value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                </Box>
              ))}
            </Stack>

            <Divider />

            {/* 14-day chart */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                Daily Views (last 14 days)
              </Typography>
              <DailyViewsChart rows={data.dailyViews} />
            </Box>

            <Divider />

            {/* Top pages */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Top Pages (last 30 days)
              </Typography>
              <Stack spacing={0.5}>
                {data.topPages.map(({ path, views }) => (
                  <Stack
                    key={path}
                    direction="row"
                    justifyContent="space-between"
                    sx={{ py: 0.5, borderBottom: "1px solid", borderColor: "divider" }}
                  >
                    <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                      {path}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {views.toLocaleString()}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
