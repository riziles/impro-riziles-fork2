import katex from "/js/lib/katex.js";

// Matches $...$ (inline) and $$...$$ (display) LaTeX math, excluding code blocks
// $ must not be preceded or followed by another $ (to distinguish from $$)
const LATEX_INLINE_REGEX = /(?<!\$)\$(?!\$)((?:[^\n$]|\\\$)+?)(?<!\$)\$(?!\$)/g;
const LATEX_DISPLAY_REGEX = /\$\$([^$]*?)\$\$/g;

/**
 * Throws if LaTeX has an error, just to keep it from blowing up
 * @param {string} formula
 * @param {object} options
 * @returns {string} HTML string
 */
export function renderLatexInline(formula) {
  try {
    return katex.renderToString(formula, {
      throwOnError: false,
      strict: false,
      displayMode: false,
      trust: true,
    });
  } catch (e) {
    console.warn("KaTeX inline render failed:", formula, e);
    return `<span class="latex-error">$${formula}$</span>`;
  }
}

/**
 * @param {string} formula
 * @returns {string} HTML string
 */
export function renderLatexDisplay(formula) {
  try {
    return katex.renderToString(formula, {
      throwOnError: false,
      strict: false,
      displayMode: true,
      trust: true,
    });
  } catch (e) {
    console.warn("KaTeX display render failed:", formula, e);
    return `<div class="latex-error">$$${formula}$$</div>`;
  }
}

/**
 * Splits a text string into segments, identifying LaTeX math blocks.
 * Returns an array of { type: "text" | "latex-inline" | "latex-display", value: string }
 *
 * @param {string} text
 * @returns {Array<{type: string, value: string}>}
 */
export function detectLatexSegments(text) {
  if (!text || !text.includes("$")) {
    return [{ type: "text", value: text }];
  }

  const segments = [];
  let lastIndex = 0;

  // Combined regex that matches both $$...$$ and $...$
  // Need to try display first ($$) to avoid conflicting with inline ($)
  const combinedRegex =
    /(\$\$(.*?)\$\$)|(?<!\$)\$(?!\$)((?:[^\n$]|\\\$)+?)(?<!\$)\$(?!\$)/gs;

  let match;
  while ((match = combinedRegex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before) {
      // Check prior text for any $ that might be standalone (e.g., currency)
      segments.push({ type: "text", value: before });
    }

    if (match[1]) {
      // Display math: $$...$$
      const formula = match[2] || "";
      segments.push({ type: "latex-display", value: formula.trim() });
    } else if (match[3] !== undefined) {
      // Inline math: $...$
      const formula = match[3] || "";
      segments.push({ type: "latex-inline", value: formula.trim() });
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = text.slice(lastIndex);
  if (remaining) {
    segments.push({ type: "text", value: remaining });
  }

  return segments;
}
