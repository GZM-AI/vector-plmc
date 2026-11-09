import React from "react";

interface MarkdownViewProps {
  text: string;
  className?: string;
}

/** Renders the limited markup stored by MarkdownEditor: **bold**, <u>underline</u>, - bullets, 1. numbered. */
export const MarkdownView: React.FC<MarkdownViewProps> = ({ text, className = "" }) => {
  if (!text) return null;

  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let listItems: { type: "ul" | "ol"; content: string }[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = () => {
    if (!listItems.length) return;
    const items = listItems.map((item, i) => (
      <li key={i} className="ml-5">{renderInline(item.content)}</li>
    ));
    if (listType === "ul") {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="list-disc my-1 space-y-0.5">
          {items}
        </ul>
      );
    } else {
      blocks.push(
        <ol key={`ol-${blocks.length}`} className="list-decimal my-1 space-y-0.5">
          {items}
        </ol>
      );
    }
    listItems = [];
    listType = null;
  };

  const renderInline = (line: string): React.ReactNode => {
    // Handle <u>...</u> and **...**
    const parts: React.ReactNode[] = [];
    const re = /(<u>(.*?)<\/u>|\*\*(.*?)\*\*)/g;
    let last = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = re.exec(line)) !== null) {
      if (match.index > last) {
        parts.push(line.slice(last, match.index));
      }
      if (match[1].startsWith("<u>")) {
        parts.push(<u key={key++}>{match[2]}</u>);
      } else {
        parts.push(<strong key={key++}>{match[3]}</strong>);
      }
      last = match.index + match[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return parts.length ? parts : line;
  };

  lines.forEach((raw, idx) => {
    const line = raw;
    const bullet = /^[-*]\s+(.*)/.exec(line);
    const numbered = /^\d+\.\s+(.*)/.exec(line);

    if (bullet) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listItems.push({ type: "ul", content: bullet[1] });
    } else if (numbered) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listItems.push({ type: "ol", content: numbered[1] });
    } else {
      flushList();
      if (line.trim() === "") {
        blocks.push(<div key={`br-${idx}`} className="h-2" />);
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
