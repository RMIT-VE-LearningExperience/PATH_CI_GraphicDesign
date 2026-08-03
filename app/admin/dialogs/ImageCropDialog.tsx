"use client";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import { Refresh as RefreshIcon } from "@mui/icons-material";
import React, { useEffect, useRef, useState } from "react";
import { DIALOG_TITLE_SX, CANCEL_BTN_SX, PRIMARY_BTN_SX } from "./dialogStyles";

type Props = {
  open: boolean;
  onClose: () => void;
  imageDataUrl: string;
  originalDataUrl: string;
  onApply: (croppedDataUrl: string) => void;
};

export default function ImageCropDialog({ open, onClose, imageDataUrl, originalDataUrl, onApply }: Props) {
  const [workingImage, setWorkingImage] = useState("");
  const [imgNaturalW, setImgNaturalW] = useState(0);
  const [imgNaturalH, setImgNaturalH] = useState(0);
  const [boxX, setBoxX] = useState(0);
  const [boxY, setBoxY] = useState(0);
  const [boxW, setBoxW] = useState(0);
  const [boxH, setBoxH] = useState(0);
  const [imgReady, setImgReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartY, setDragStartY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement>(null);

  function loadImageIntoState(src: string) {
    setImgReady(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImgNaturalW(img.width);
      setImgNaturalH(img.height);
      setBoxX(0);
      setBoxY(0);
      setBoxW(img.width);
      setBoxH(img.height);
      setWorkingImage(src);
    };
    img.onerror = () => console.error("ImageCropDialog: failed to load image");
    img.src = src;
  }

  useEffect(() => {
    if (open && imageDataUrl) {
      loadImageIntoState(imageDataUrl);
    }
    if (!open) {
      setImgReady(false);
      setWorkingImage("");
      setIsDragging(false);
      setIsResizing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, imageDataUrl]);

  function handleReset() {
    if (originalDataUrl) loadImageIntoState(originalDataUrl);
  }

  function handleMouseDown(e: React.MouseEvent, isHandle: boolean) {
    e.stopPropagation();
    e.preventDefault();
    if (isHandle) setIsResizing(true);
    else setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartY(e.clientY);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging && !isResizing) return;
    if (!containerRef.current) return;
    const imgEl = imgRef.current;
    if (!imgEl) return;
    const imgRect = imgEl.getBoundingClientRect();
    if (!imgRect.width || !imgRect.height) return;
    const scaleX = imgNaturalW / imgRect.width;
    const scaleY = imgNaturalH / imgRect.height;
    const dx = (e.clientX - dragStartX) * scaleX;
    const dy = (e.clientY - dragStartY) * scaleY;

    if (isDragging) {
      setBoxX((x) => Math.max(0, Math.min(x + dx, Math.max(0, imgNaturalW - boxW))));
      setBoxY((y) => Math.max(0, Math.min(y + dy, Math.max(0, imgNaturalH - boxH))));
    } else {
      setBoxW((w) => { const nw = w + dx; return nw > 50 && boxX + nw <= imgNaturalW ? nw : w; });
      setBoxH((h) => { const nh = h + dy; return nh > 50 && boxY + nh <= imgNaturalH ? nh : h; });
    }
    setDragStartX(e.clientX);
    setDragStartY(e.clientY);
  }

  function handleMouseUp() {
    setIsDragging(false);
    setIsResizing(false);
  }

  function handleApply() {
    if (!workingImage || !outputCanvasRef.current || !boxW || !boxH) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = outputCanvasRef.current!;
      const outputW = 400;
      const outputH = Math.max(1, Math.round(outputW * (boxH / boxW)));
      canvas.width = outputW;
      canvas.height = outputH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, boxX, boxY, boxW, boxH, 0, 0, outputW, outputH);
      onApply(canvas.toDataURL("image/jpeg", 0.9));
      onClose();
    };
    img.onerror = () => onClose();
    img.src = workingImage;
  }

  function getCropBoxPixels() {
    if (!containerRef.current || !imgNaturalW || !imgNaturalH || !imgReady) return null;
    const imgEl = imgRef.current;
    if (!imgEl) return null;
    const containerRect = containerRef.current.getBoundingClientRect();
    const imgRect = imgEl.getBoundingClientRect();
    if (!imgRect.width || !imgRect.height) return null;
    const scaleX = imgRect.width / imgNaturalW;
    const scaleY = imgRect.height / imgNaturalH;
    const imgOffsetX = imgRect.left - containerRect.left + (containerRef.current.scrollLeft || 0);
    const imgOffsetY = imgRect.top - containerRect.top + (containerRef.current.scrollTop || 0);
    return {
      x: imgOffsetX + boxX * scaleX,
      y: imgOffsetY + boxY * scaleY,
      w: boxW * scaleX,
      h: boxH * scaleY,
    };
  }

  const px = getCropBoxPixels();

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, overflow: "visible" } }}
      >
        <DialogTitle sx={DIALOG_TITLE_SX}>Crop Image</DialogTitle>
        <DialogContent sx={{ paddingTop: "24px !important", pb: 3, bgcolor: "#ffffff" }}>
          <Box sx={{ mb: 2 }}>
            {workingImage && (
              <Box
                ref={containerRef}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                sx={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "4/3",
                  overflow: "auto",
                  borderRadius: 1,
                  border: "1px solid #E5E1D7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "#FDF9F1",
                  userSelect: "none",
                  cursor: isDragging ? "grabbing" : "default",
                }}
              >
                <Box
                  component="img"
                  ref={imgRef}
                  src={workingImage}
                  alt="Crop preview"
                  onLoad={() => setImgReady(true)}
                  sx={{ maxWidth: "100%", maxHeight: "100%", display: "block" }}
                />

                {px && (
                  <>
                    <Box
                      onMouseDown={(e) => handleMouseDown(e, false)}
                      sx={{
                        position: "absolute",
                        left: `${px.x}px`, top: `${px.y}px`,
                        width: `${px.w}px`, height: `${px.h}px`,
                        border: "2px solid #3D8078",
                        bgcolor: "rgba(61,128,120,0.1)",
                        cursor: isDragging ? "grabbing" : "grab",
                        boxSizing: "border-box",
                      }}
                    >
                      <Box
                        onMouseDown={(e) => handleMouseDown(e as React.MouseEvent, true)}
                        sx={{
                          position: "absolute", width: 12, height: 12,
                          bgcolor: "#3D8078", borderRadius: "50%",
                          bottom: -6, right: -6,
                          cursor: "se-resize", zIndex: 10,
                        }}
                      />
                    </Box>
                    <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, height: `${px.y}px`, bgcolor: "rgba(0,0,0,0.5)", pointerEvents: "none" }} />
                    <Box sx={{ position: "absolute", top: `${px.y}px`, left: 0, width: `${px.x}px`, height: `${px.h}px`, bgcolor: "rgba(0,0,0,0.5)", pointerEvents: "none" }} />
                    <Box sx={{ position: "absolute", top: `${px.y}px`, left: `${px.x + px.w}px`, right: 0, height: `${px.h}px`, bgcolor: "rgba(0,0,0,0.5)", pointerEvents: "none" }} />
                    <Box sx={{ position: "absolute", top: `${px.y + px.h}px`, left: 0, right: 0, bottom: 0, bgcolor: "rgba(0,0,0,0.5)", pointerEvents: "none" }} />
                  </>
                )}
              </Box>
            )}
          </Box>
          <Typography variant="body2" color="text.secondary">
            Drag the crop box to reposition it. Drag the bottom-right handle to resize freely.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid #E5E1D7", pt: 2, pb: 2, px: 3, bgcolor: "#FDF9F1", justifyContent: "space-between" }}>
          <Tooltip title="Reset to original">
            <IconButton onClick={handleReset} sx={{ color: "#3D8078" }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button onClick={onClose} sx={CANCEL_BTN_SX}>Cancel</Button>
            <Button onClick={handleApply} variant="contained" sx={PRIMARY_BTN_SX}>
              Apply Crop
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
      <canvas ref={outputCanvasRef} style={{ display: "none" }} />
    </>
  );
}
