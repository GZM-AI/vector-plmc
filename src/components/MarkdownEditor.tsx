import React, { useRef, useEffect, useCallback } from "react";
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
  const lastExternalValue = useRef(value);
  const isInternalChange = useRef(false);

  // Only sync from outside when the prop actually changes from an external source
  // (e.g. switching entities), not from our own onChange
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      lastExternalValue.current = value;
      return;
    }
    if (value !== lastExternalValue.current && textareaRef.current) {
      const el = textareaRef.current;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      el.value = value;
      // Restore selection if the element still has focus
      if (document.activeElement === el) {
        el.setSelectionRange(start, end);
      }
      lastExternalValue.current = value;
    }
  }, [value]);

  const notify = useCallback(
    (newValue: string) => {
      isInternalChange.current = true;
      lastExternalValue.current = newValue;
      onChange(newValue);
    },
    [onChange]
  );

  const applyWrap = useCallback(
    (before: string, after: string) => {
      if (disabled || !textareaRef.current) return;
      const el = textareaRef.current;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const current = el.value;
      const selected = current.substring(start, end);

      const alreadyWrapped =
        selected.startsWith(before) &&
        selected.endsWith(after) &&
        selected.length > before.length + after.length;

      let newValue: string;
      let newStart: number;
      let newEnd: number;

      if (alreadyWrapped) {
        const inner = selected.slice(before.length, selected.length - after.length);
        newValue = current.substring(0, start) + inner + current.substring(end);
        newStart = start;
        newEnd = start + inner.length;
      } else {
        newValue = current.substring(0, start) + before + selected + after + current.substring(end);
        newStart = start + before.length;
        newEnd = start + before.length + selected.length;
      }

      el.value = newValue;
      el.focus();
      el.setSelectionRange(newStart, newEnd);
      notify(newValue);
    },
    [notify, disabled]
  );

  const prefixLine = useCallback(
    (prefix: string) => {
      if (disabled || !textareaRef.current) return;
      const el = textareaRef.current;
      const start = el.selectionStart;
      const current = el.value;
      const lineStart = current.lastIndexOf("\n", start - 1) + 1;
      const lineEndIdx = current.indexOf("\n", lineStart);
      const lineEnd = lineEndIdx === -1 ? current.length : lineEndIdx;
      const line = current.slice(lineStart, lineEnd);

      let newValue: string;
      let newPos: number;

      if (line.startsWith(prefix)) {
        newValue = current.slice(0, lineStart) + line.slice(prefix.length) + current.slice(lineEnd);
        newPos = Math.max(lineStart, start - prefix.length);
      } else {
        newValue = current.slice(0, lineStart) + prefix + current.slice(lineStart);
        newPos = start + prefix.length;
      }

      el.value = newValue;
      el.focus();
      el.setSelectionRange(newPos, newPos);
      notify(newValue);
    },
    [notify, disabled]
  );

  const handleBold = () => applyWrap("**", "**");
  const handleUnderline = () => applyWrap("<u>", "</u>");
  const handleBullet = () => prefixLine("- ");
  const handleNumbered = () => prefixLine("1. ");

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    notify(e.target.value);
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
        defaultValue={value}
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
