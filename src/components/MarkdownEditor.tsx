import React, { useRef, useLayoutEffect, useCallback } from "react";
import { Bold, Underline, List, ListOrdered } from "lucide-react";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minHeight?: string;
  rows?: number;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = "Enter text...",
  disabled = false,
  className = "",
  minHeight = "min-h-[120px]",
  rows = 6,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);

  // Restore cursor after value updates from toolbar actions
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || !pendingSelection.current) return;
    const { start, end } = pendingSelection.current;
    el.focus();
    el.setSelectionRange(start, end);
    pendingSelection.current = null;
  }, [value]);

  const applyWrap = useCallback(
    (before: string, after: string) => {
      if (disabled || !textareaRef.current) return;
      const el = textareaRef.current;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const selected = value.substring(start, end);

      // If selection is already wrapped by this marker, unwrap it
      const alreadyWrapped =
        selected.startsWith(before) && selected.endsWith(after) && selected.length > before.length + after.length;

      let newValue: string;
      let newStart: number;
      let newEnd: number;

      if (alreadyWrapped) {
        const inner = selected.slice(before.length, selected.length - after.length);
        newValue = value.substring(0, start) + inner + value.substring(end);
        newStart = start;
        newEnd = start + inner.length;
      } else {
        newValue = value.substring(0, start) + before + selected + after + value.substring(end);
        newStart = start + before.length;
        newEnd = start + before.length + selected.length;
      }

      pendingSelection.current = { start: newStart, end: newEnd };
      onChange(newValue);
    },
    [value, onChange, disabled]
  );

  const handleBold = () => applyWrap("**", "**");
  const handleUnderline = () => applyWrap("<u>", "</u>");

  const prefixLine = useCallback(
    (prefix: string) => {
      if (disabled || !textareaRef.current) return;
      const el = textareaRef.current;
      const start = el.selectionStart;
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const line = value.slice(lineStart, value.indexOf("\n", lineStart) === -1 ? value.length : value.indexOf("\n", lineStart));

      // Toggle if already prefixed
      if (line.startsWith(prefix)) {
        const newValue = value.slice(0, lineStart) + line.slice(prefix.length) + value.slice(lineStart + line.length);
        pendingSelection.current = { start: start - prefix.length, end: start - prefix.length };
        onChange(newValue);
      } else {
        const newValue = value.slice(0, lineStart) + prefix + value.slice(lineStart);
        pendingSelection.current = { start: start + prefix.length, end: start + prefix.length };
        onChange(newValue);
      }
    },
    [value, onChange, disabled]
  );

  const handleBullet = () => prefixLine("- ");
  const handleNumbered = () => prefixLine("1. ");

  // Preserve cursor on normal typing as well (controlled input)
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    pendingSelection.current = { start: el.selectionStart, end: el.selectionEnd };
    onChange(el.value);
  };

  return (
    <div className={`border border-zinc-600 rounded-2xl overflow-hidden bg-zinc-950 ${className}`}>
      {!disabled && (
        <div className="flex gap-1 p-1.5 border-b border-zinc-800 bg-zinc-900/50">
          <button type="button" onClick={handleBold} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-300" title="Bold (Ctrl+B)">
            <Bold size={14} />
          </button>
          <button type="button" onClick={handleUnderline} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-300" title="Underline (Ctrl+U)">
            <Underline size={14} />
          </button>
          <button type="button" onClick={handleBullet} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-300" title="Bullet list">
            <List size={14} />
          </button>
          <button type="button" onClick={handleNumbered} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-300" title="Numbered list">
            <ListOrdered size={14} />
          </button>
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={`w-full ${minHeight} bg-transparent px-4 py-3 text-sm text-zinc-200 leading-relaxed focus:outline-none resize-y disabled:opacity-70`}
      />
    </div>
  );
};

export default MarkdownEditor;
