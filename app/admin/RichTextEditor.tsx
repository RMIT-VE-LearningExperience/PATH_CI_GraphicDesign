"use client";

import { Box, IconButton, Stack, Typography } from "@mui/material";
import {
  FormatBold as FormatBoldIcon,
  FormatIndentDecrease as FormatIndentDecreaseIcon,
  FormatIndentIncrease as FormatIndentIncreaseIcon,
  FormatItalic as FormatItalicIcon,
  FormatUnderlined as FormatUnderlinedIcon,
  FormatListNumbered as FormatListNumberedIcon,
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

  // Plain text indents by wrapping it in a <blockquote>, and a list item nests its list.
  // Cap the plain-text depth so the text cannot be pushed off the page.
  const MAX_INDENT = 3;

  function indentDepth(): number {
    const root = editorRef.current;
    let node: Node | null = window.getSelection()?.anchorNode ?? null;
    let depth = 0;
    while (node && node !== root) {
      if (node.nodeName === "BLOCKQUOTE") depth += 1;
      node = node.parentNode;
    }
    return depth;
  }

  // The browser nests an indented list item as a list placed directly inside the
  // parent list (<ul><li>One</li><ul>…</ul></ul>), which is invalid HTML and is
  // announced badly by screen readers. Move each such list inside the item before it.
  function fixNestedLists() {
    const root = editorRef.current;
    if (!root) return;
    const selection = window.getSelection();
    const anchor = selection?.anchorNode ?? null;
    const offset = selection?.anchorOffset ?? 0;
    root.querySelectorAll("ul > ul, ul > ol, ol > ul, ol > ol").forEach((nested) => {
      const previous = nested.previousElementSibling;
      if (previous && previous.tagName === "LI") {
        previous.appendChild(nested);
      } else {
        const item = document.createElement("li");
        nested.parentNode?.insertBefore(item, nested);
        item.appendChild(nested);
      }
    });
    // Outdenting a nested item can leave a list item inside another list item; lift it out
    root.querySelectorAll("li > li").forEach((inner) => {
      const outer = inner.parentElement;
      if (outer?.parentNode) outer.parentNode.insertBefore(inner, outer.nextSibling);
    });
    // Moving nodes drops the caret; put it back where it was
    if (anchor && root.contains(anchor)) selection?.collapse(anchor, Math.min(offset, anchor.textContent?.length ?? offset));
  }

  function changeIndent(direction: "indent" | "outdent") {
    editorRef.current?.focus();
    if (direction === "indent" && indentDepth() >= MAX_INDENT) return;
    document.execCommand(direction);
    fixNestedLists();
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
          { icon: <FormatListNumberedIcon />, cmd: "insertOrderedList", title: "Numbered list" },
          { icon: <FormatIndentDecreaseIcon />, cmd: "outdent", title: "Decrease indent" },
          { icon: <FormatIndentIncreaseIcon />, cmd: "indent", title: "Increase indent" },
        ].map(({ icon, cmd, title }) => (
          <IconButton
            key={cmd}
            size="small"
            // mousedown is prevented so the editor keeps its selection;
            // click (also fired by Enter/Space) runs the command
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (cmd === "indent" || cmd === "outdent" ? changeIndent(cmd) : runCommand(cmd))}
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
          "& ul, & ol": { pl: 3, my: 0.5 },
          // Indented text: one step per level, without the browser's quote styling
          "& blockquote": { m: 0, ml: 5, p: 0, border: "none" },
          "&:focus": {
            borderColor: "primary.main",
            boxShadow: (theme) => `0 0 0 1px ${theme.palette.primary.main}`,
          },
        }}
      />
    </Box>
  );
}
