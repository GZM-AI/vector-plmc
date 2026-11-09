import React, { useRef, useEffect } from "react";
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

  const insertMarkdown = (before: string, after: string = "") => {
    if (disabled || !textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.substring(start, end);
    const newValue =
      value.substring(0, start) + before + selected + after + value.substring(end);
    onChange(newValue);
    setTimeout(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + selected.length;
    }, 0);
  };

  const handleBold = () => insertMarkdown("**", "**");
  const handleUnderline = () => insertMarkdown("<u>", "</u>");
  const handleBullet = () => {
    if (disabled || !textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const newValue = value.substring(0, lineStart) + "- " + value.substring(lineStart);
    onChange(newValue);
    setTimeout(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + 2;
    }, 0);
  };
  const handleNumbered = () => {
    if (disabled || !textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const newValue = value.substring(0, lineStart) + "1. " + value.substring(lineStart);
    onChange(newValue);
    setTimeout(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + 3;
    }, 0);
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if (disabled) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        handleBold();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "u") {
        e.preventDefault();
        handleUnderline();
      }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [value, disabled]);

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
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={`w-full ${minHeight} bg-transparent px-4 py-3 text-sm text-zinc-200 leading-relaxed focus:outline-none resize-y disabled:opacity-70`}
      />
    </div>
  );
};

export default MarkdownEditor;
