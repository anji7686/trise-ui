import { SortedSelect } from '@trise/ui';
import { useEffect, useRef, useState, type MouseEvent } from "react";

const allowedTags = new Set(["P", "BR", "STRONG", "EM", "B", "I", "UL", "OL", "LI", "H3", "H4", "DIV", "SPAN", "FONT"]);
const allowedFontFamilies = new Set(["Arial", "Helvetica", "Georgia", "Verdana", "Times New Roman", "Courier New"]);
const allowedFontSizes = new Set(["10px", "11px", "12px", "13px", "14px", "15px", "16px", "18px", "20px", "22px", "24px", "28px", "32px"]);
const colorPresets = [
  ["Navy", "#102A43"],
  ["Blue", "#1D4ED8"],
  ["Teal", "#0F766E"],
  ["Amber", "#B45309"],
  ["Red", "#C0392B"],
  ["Black", "#111827"],
] as const;
const richTextColorTokens = new Map(
  colorPresets.map(([name, color]) => [color, name.toLowerCase()] as [string, string]),
);

function richTextColorToken(value: string) {
  const normalized = value.trim();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) {
    return richTextColorTokens.get(normalized.toUpperCase()) || "";
  }
  const match = normalized.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (!match) return "";
  const hex = match.slice(1).map((component) => Number(component).toString(16).padStart(2, "0")).join("");
  return richTextColorTokens.get(`#${hex.toUpperCase()}`) || "";
}

function safeInlineStyle(value: string) {
  return value
    .split(";")
    .flatMap((declaration) => {
      const [property, ...rest] = declaration.split(":");
      const normalizedProperty = property?.trim().toLowerCase();
      const rawValue = rest.join(":").trim();
      if (normalizedProperty === "color" && (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(rawValue) || /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i.test(rawValue))) {
        const normalizedColor = rawValue.startsWith("#") ? rawValue.toUpperCase() : rawValue.replaceAll(/\s+/g, " ");
        const colorToken = richTextColorToken(normalizedColor);
        // Keep the authored color available to the dark-theme presentation
        // layer while retaining the original color for light/PDF output.
        return [`color: ${normalizedColor}; --rich-text-source-color: ${normalizedColor}${colorToken ? `; --rich-text-color-token: ${colorToken}` : ""}`];
      }
      if (normalizedProperty === "font-size") {
        const sizeMap: Record<string, string> = { "xx-small": "10px", "x-small": "11px", small: "12px", medium: "14px", large: "18px", "x-large": "20px", "xx-large": "24px", "1": "10px", "2": "12px", "3": "14px", "4": "16px", "5": "20px", "6": "24px", "7": "32px" };
        const normalizedSize = sizeMap[rawValue] || rawValue;
        return allowedFontSizes.has(normalizedSize) ? [`font-size: ${normalizedSize}`] : [];
      }
      if (normalizedProperty === "font-style" && ["normal", "italic"].includes(rawValue)) return [`font-style: ${rawValue}`];
      if (normalizedProperty === "font-weight" && ["normal", "bold"].includes(rawValue)) return [`font-weight: ${rawValue}`];
      if (normalizedProperty === "font-family") {
        const family = rawValue.replaceAll(/["']/g, "");
        const allowed = [...allowedFontFamilies].find((item) => item.toLowerCase() === family.toLowerCase());
        return allowed ? [`font-family: ${allowed.includes(" ") ? `"${allowed}"` : allowed}`] : [];
      }
      return [];
    })
    .join("; ");
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function safeRichTextHtml(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (!/<\/?(p|br|strong|em|b|i|ul|ol|li|h3|h4|div|span|font)(\s|>)/i.test(raw)) {
    return raw.split(/\r?\n+/).filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`).join("");
  }
  const template = document.createElement("template");
  template.innerHTML = raw;
  template.content.querySelectorAll("*").forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(document.createTextNode(element.textContent || ""));
      return;
    }
    if (element.tagName === "FONT") {
      const span = document.createElement("span");
      const face = element.getAttribute("face");
      const color = element.getAttribute("color");
      const size = element.getAttribute("size");
      if (face && [...allowedFontFamilies].some((item) => item.toLowerCase() === face.replaceAll(/["']/g, "").toLowerCase())) span.style.fontFamily = face;
      if (color && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) {
        span.style.color = color;
        span.style.setProperty("--rich-text-source-color", color);
        const colorToken = richTextColorToken(color);
        if (colorToken) span.setAttribute("data-rich-text-color", colorToken);
      }
      if (size) span.style.fontSize = ({ "1": "10px", "2": "12px", "3": "14px", "4": "16px", "5": "20px", "6": "24px", "7": "32px" } as Record<string, string>)[size] || "";
      span.innerHTML = element.innerHTML;
      element.replaceWith(span);
      return;
    }
    if (element.tagName === "B" || element.tagName === "I") {
      const replacement = document.createElement(element.tagName === "B" ? "strong" : "em");
      replacement.innerHTML = element.innerHTML;
      element.replaceWith(replacement);
      return;
    }
    if (element.tagName === "SPAN") {
      const style = safeInlineStyle(element.getAttribute("style") || "");
      if (style) {
        element.setAttribute("style", style);
        const colorSource = style.match(/--rich-text-source-color:\s*([^;]+)/i)?.[1] || "";
        const colorToken = richTextColorToken(colorSource);
        if (colorToken) element.setAttribute("data-rich-text-color", colorToken);
        else element.removeAttribute("data-rich-text-color");
      } else {
        element.removeAttribute("style");
        element.removeAttribute("data-rich-text-color");
      }
    } else {
      Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name));
    }
  });
  return template.innerHTML;
}

export function RichTextViewer({ value }: { value: unknown }) {
  const html = safeRichTextHtml(value);
  if (!html) return <span>—</span>;
  return <div className="rich-text-viewer" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function RichTextEditor({
  label,
  value,
  onChange,
  help = "Use bold, italic, headings, lists, approved fonts, sizes and colors. The server keeps only safe formatting.",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastInternalValueRef = useRef<string | null>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!editorRef.current) return;
    const nextHtml = safeRichTextHtml(value);
    // Keep the browser's caret and active selection while the user types. A
    // plain first character is emitted as text, while the safe initial-value
    // normalizer wraps plain values in <p>; rewriting that value on every
    // keystroke moves the caret and makes the editor appear uneditable.
    if (lastInternalValueRef.current === value && editorRef.current.innerHTML) {
      return;
    }
    if (editorRef.current.innerHTML !== nextHtml) editorRef.current.innerHTML = nextHtml;
    lastInternalValueRef.current = value;
  }, [previewing, value]);

  const rememberSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.startContainer) && editor.contains(range.endContainer)) {
      const startRange = document.createRange();
      startRange.selectNodeContents(editor);
      startRange.setEnd(range.startContainer, range.startOffset);
      const endRange = document.createRange();
      endRange.selectNodeContents(editor);
      endRange.setEnd(range.endContainer, range.endOffset);
      const offsets = { start: startRange.toString().length, end: endRange.toString().length };
      // Focusing a native select/color input can temporarily collapse the
      // browser selection. Keep the prior highlighted range in that case so
      // a user can apply family, size and color one after another.
      if (!range.collapsed || !selectionRef.current || selectionRef.current.start === selectionRef.current.end) {
        selectionRef.current = offsets;
      }
    }
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    const offsets = selectionRef.current;
    if (!editor || !offsets) return;
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      textNodes.push(current as Text);
      current = walker.nextNode();
    }
    if (!textNodes.length) return;
    const resolve = (offset: number) => {
      let cursor = 0;
      for (const node of textNodes) {
        const next = cursor + node.data.length;
        if (offset <= next) return { node, offset: Math.max(0, offset - cursor) };
        cursor = next;
      }
      const last = textNodes[textNodes.length - 1];
      return { node: last, offset: last.data.length };
    };
    const start = resolve(offsets.start);
    const end = resolve(offsets.end);
    const browserSelection = window.getSelection();
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    browserSelection?.removeAllRanges();
    browserSelection?.addRange(range);
  };

  const preserveSelection = (event: MouseEvent<HTMLElement>) => {
    rememberSelection();
    event.preventDefault();
  };

  const rememberSelectionOnly = () => {
    rememberSelection();
  };

  const command = (name: string, valueArg?: string) => {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(name, false, valueArg);
    const html = safeRichTextHtml(editorRef.current?.innerHTML || "");
    restoreSelection();
    lastInternalValueRef.current = html;
    onChange(html);
    // Parent state updates can briefly move focus away from contentEditable;
    // restore the range once React has committed the new value as well.
    window.requestAnimationFrame(restoreSelection);
  };

  return (
    <div className="rich-text-field">
      <span className="rich-text-label">{label}</span>
      <div className="rich-text-toolbar" role="toolbar" aria-label={`${label} formatting`}>
        <button type="button" onMouseDown={preserveSelection} onClick={() => command("bold")} aria-label="Bold"><strong>B</strong></button>
        <button type="button" onMouseDown={preserveSelection} onClick={() => command("italic")} aria-label="Italic"><em>I</em></button>
        <button type="button" onMouseDown={preserveSelection} onClick={() => command("formatBlock", "<h3>")} aria-label="Heading">H</button>
        <button type="button" onMouseDown={preserveSelection} onClick={() => command("insertUnorderedList")} aria-label="Bulleted list">• List</button>
        <button type="button" onMouseDown={preserveSelection} onClick={() => command("insertOrderedList")} aria-label="Numbered list">1. List</button>
        <SortedSelect className="rich-text-font-family" aria-label="Font family" title="Choose font family" defaultValue="" onFocus={rememberSelection} onMouseDown={rememberSelectionOnly} onChange={(event) => { if (event.target.value) command("fontName", event.target.value); }}>
          <option value="">Font family</option>
          <option value="Arial">Arial</option>
          <option value="Helvetica">Helvetica</option>
          <option value="Georgia">Georgia</option>
          <option value="Verdana">Verdana</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Courier New">Courier New</option>
        </SortedSelect>
        <SortedSelect className="rich-text-font-size" aria-label="Font size" title="Choose font size" defaultValue="" onFocus={rememberSelection} onMouseDown={rememberSelectionOnly} onChange={(event) => { if (event.target.value) command("fontSize", event.target.value); }}>
          <option value="">Font size</option>
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="4">Large</option>
          <option value="5">Extra large</option>
          <option value="6">Display</option>
        </SortedSelect>
        <div className="rich-text-color-control" role="group" aria-label="Text color">
          <span>Color</span>
          <span className="rich-text-color-presets">
            {colorPresets.map(([name, color]) => (
              <button
                key={color}
                type="button"
                className="rich-text-color-swatch"
                style={{ backgroundColor: color }}
                title={`${name} text`}
                aria-label={`${name} text color`}
                onMouseDown={preserveSelection}
                onClick={() => command("foreColor", color)}
              />
            ))}
          </span>
          <label className="rich-text-custom-color" title="Choose custom text color">
            <span className="sr-only">Custom text color</span>
            <input type="color" aria-label="Custom text color" title="Choose custom text color" defaultValue="#102A43" onFocus={rememberSelection} onMouseDown={rememberSelectionOnly} onChange={(event) => command("foreColor", event.target.value)} />
          </label>
        </div>
        <button
          type="button"
          className="rich-text-preview-toggle"
          onMouseDown={preserveSelection}
          onClick={() => setPreviewing((current) => !current)}
          aria-pressed={previewing}
          aria-label={previewing ? `Edit ${label}` : `Preview ${label}`}
        >
          {previewing ? "Edit" : "Preview"}
        </button>
      </div>
      {previewing ? (
        <div key="preview" className="rich-text-preview" role="region" aria-label={`${label} preview`}>
          {value.trim() ? <RichTextViewer value={value} /> : <p className="rich-text-preview-empty">Nothing to preview yet. Switch back to Edit and enter the terms.</p>}
        </div>
      ) : (
        <div
          key="editor"
          ref={editorRef}
          className="rich-text-editor"
          contentEditable
          role="textbox"
          aria-label={label}
          aria-multiline="true"
          onInput={() => {
            const html = editorRef.current?.innerHTML || "";
            lastInternalValueRef.current = html;
            onChange(html);
          }}
          suppressContentEditableWarning
        />
      )}
      <small>{help}</small>
    </div>
  );
}
