import React from "react";

interface MarkdownViewProps {
  text: string;
  className?: string;
}

/** Renders limited markup: **bold**, <u>underline</u>, and combinations, plus lists. */
export const MarkdownView: React.FC<MarkdownViewProps> = ({ text, className = "" }) => {
  if (!text) return null;

  const renderInline = (src: string): React.ReactNode => {
    if (!src) return null;
    // Process <u> and ** in a way that allows nesting by recursive replacement
    const parts: React.ReactNode[] = [];
    const re = /(<u>([\s\S]*?)<\/u>|\*\*([\s\S]*?)\*\*)/g;
    let last = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = re.exec(src)) !== null) {
      if (match.index > last) parts.push(src.slice(last, match.index));
      if (match[1].startsWith("<u>")) {
        parts.push(<u key={key++}>{renderInline(match[2])}</u>);
      } else {
        parts.push(<strong key={key++}>{renderInline(match[3])}</strong>);
      }
      last = match.index + match[0].length;
    }
    if (last < src.length) parts.push(src.slice(last));
    return parts.length ? parts : src;
  };

  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = () => {
    if (!listItems.length || !listType) return;
    const Tag = listType === "ul" ? "ul" : "ol";
    blocks.push(
      <Tag key={`list-${blocks.length}`} className={listType === "ul" ? "list-disc ml-5 my-1 space-y-0.5" : "list-decimal ml-5 my-1 space-y-0.5"}>
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </Tag>
    );
    listItems = [];
    listType = null;
  };

  lines.forEach((line, idx) => {
    const bullet = /^[-*]\s+(.*)/.exec(line);
    const numbered = /^\d+\.\s+(.*)/.exec(line);
    if (bullet) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listItems.push(bullet[1]);
    } else if (numbered) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listItems.push(numbered[1]);
    } else {
      flushList();
      if (line.trim() === "") {
        blocks.push(<div key={`sp-${idx}`} className="h-2" />);
      } else {
        blocks.push(
          <p key={`p-${idx}`} className="my-0.5">
            {renderInline(line)}
          </p>
        );
      }
    }
  });
  flushList();

  return <div className={`leading-relaxed ${className}`}>{blocks}</div>;
};

export default MarkdownView;
