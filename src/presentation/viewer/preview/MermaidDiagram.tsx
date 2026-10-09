import {
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useState,
} from "react";
import { renderMermaidDiagram } from "./renderMermaidDiagram.ts";
import { usePrefersDarkScheme } from "./usePrefersDarkScheme.ts";

interface MermaidDiagramProps {
  source: string;
  // The block as an ordinary code block. Shown until the diagram is ready and
  // in its place when the source does not parse, so nothing the author wrote
  // ever disappears.
  fallback: ReactNode;
}

type RenderResult =
  | { source: string; svg: string }
  | { source: string; failed: true };

export function MermaidDiagram({ source, fallback }: MermaidDiagramProps) {
  // Tokens resolve differently per scheme, so a scheme change redraws the
  // diagram with the other palette.
  const darkMode = usePrefersDarkScheme();
  const [result, setResult] = useState<RenderResult>();

  useEffect(() => {
    let isCurrent = true;
    renderMermaidDiagram(source, darkMode).then(
      (svg) => {
        if (isCurrent) setResult({ source, svg });
      },
      () => {
        if (isCurrent) setResult({ source, failed: true });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [source, darkMode]);

  // A result for an older source is stale; a redraw for a scheme change keeps
  // showing the previous diagram until the new one replaces it.
  if (result?.source !== source) return fallback;

  if ("failed" in result) {
    return (
      <div className="markdown-preview__mermaid-failed">
        <p
          className="markdown-preview__mermaid-error"
          role="status"
          data-find-ignore
        >
          Could not render this Mermaid diagram.
        </p>
        {fallback}
      </div>
    );
  }

  return (
    <div
      className="markdown-preview__mermaid"
      // Mermaid builds the SVG under securityLevel "strict", which sanitises
      // every label it contains, and the renderer strips every navigation
      // target from it.
      dangerouslySetInnerHTML={{ __html: result.svg }}
      // A backstop for anything the stripping misses. A diagram has nothing
      // to activate, so every default action is cancelled. Keyboard
      // activation of a link or button also arrives as a click.
      onClickCapture={preventDefault}
      onAuxClickCapture={preventDefault}
      onSubmitCapture={preventDefault}
      onDragStartCapture={preventDefault}
    />
  );
}

function preventDefault(event: SyntheticEvent) {
  event.preventDefault();
}
