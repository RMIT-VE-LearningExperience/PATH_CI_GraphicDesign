"use client";

import { Box, IconButton, Stack, Typography } from "@mui/material";
import {
  FormatBold as FormatBoldIcon,
  FormatItalic as FormatItalicIcon,
  FormatUnderlined as FormatUnderlinedIcon,
  List as ListIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
} from "@mui/icons-material";
import { useEffect, useId, useRef } from "react";

type Props = {
  label: string;
  value: string;
  onChange: (html: string) => void;
};

export default function RichTextEditor({ label, value, onChange }: Props) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const labelId = useId();

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML ?? "");
  }

  function insertLink() {
    const urlInput = window.prompt("Enter URL (https://...)");
    if (!urlInput) return;
    const url = /^(https?:)?\/\//i.test(urlInput) ? urlInput : `https://${urlInput}`;
    runCommand("createLink", url);
  }

  return (
    <Box>
      <Typography id={labelId} variant="body2" fontWeight={500} sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Stack role="toolbar" aria-label={`${label} formatting`} direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: "wrap" }}>
        {[
          { icon: <FormatBoldIcon />, cmd: "bold", title: "Bold" },
          { icon: <FormatItalicIcon />, cmd: "italic", title: "Italic" },
          { icon: <FormatUnderlinedIcon />, cmd: "underline", title: "Underline" },
          { icon: <ListIcon />, cmd: "insertUnorderedList", title: "Bullets" },
        ].map(({ icon, cmd, title }) => (
          <IconButton
            key={cmd}
            size="small"
            // mousedown is prevented so the editor keeps its selection;
            // click (also fired by Enter/Space) runs the command
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runCommand(cmd)}
            aria-label={title}
            title={title}
            sx={{ color: "#000054" }}
          >
            {icon}
          </IconButton>
        ))}
        <IconButton
          size="small"
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertLink}
          aria-label="Insert link"
          title="Insert link"
          sx={{ color: "#000054" }}
        >
          <LinkIcon />
        </IconButton>
        <IconButton
          size="small"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCommand("unlink")}
          aria-label="Remove link"
          title="Remove link"
          sx={{ color: "#000054" }}
        >
          <LinkOffIcon />
        </IconButton>
      </Stack>
      <Box
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelId}
        suppressContentEditableWarning
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        }}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          px: 1.5,
          py: 1.25,
          minHeight: 170,
          outline: "none",
          "&:focus": {
            borderColor: "primary.main",
            boxShadow: (theme) => `0 0 0 1px ${theme.palette.primary.main}`,
          },
        }}
      />
    </Box>
  );
}
