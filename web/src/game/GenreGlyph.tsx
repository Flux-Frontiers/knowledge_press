import type { CSSProperties } from "react";
import { glyphFor } from "./genreMarks";

/**
 * A genre's glyph alone, as an inline SVG in the current text color, for the
 * book list and the atlas. Set `color` to the grove's color to match its mark.
 */
export function GenreGlyph({ genre, className, style }: { genre: string; className?: string; style?: CSSProperties }) {
  const g = glyphFor(genre);
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth={g.width} strokeLinecap="round" strokeLinejoin="round">
      <title>{g.name}</title>
      {g.strokes.map((s, i) => (
        // An ink fill hides what is behind it on the mark; here that is the panel.
        <path key={i} d={s.d} fill={s.fill === "paper" ? "currentColor" : s.fill === "ink" ? "var(--color-surface, #1c1c1c)" : "none"} />
      ))}
    </svg>
  );
}
