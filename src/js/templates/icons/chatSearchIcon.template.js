import { html } from "/js/lib/lit-html.js";
import { classnames } from "/js/utils.js";

// Speech bubble with magnifying glass inside (instead of the usual dots)
export function chatSearchIconTemplate({ filled = false } = ({} = {})) {
  return html`<div class=${classnames("icon chat-search-icon", { filled })}>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
      ${filled
        ? html`
            <path
              fill="currentColor"
              fill-rule="evenodd"
              d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10a9.96 9.96 0 0 1-4.935-1.3l-3.749 1.249a1 1 0 0 1-1.265-1.265l1.25-3.749A9.959 9.959 0 0 1 2 12z"
              clip-rule="evenodd"
            />
            <!-- magnifying glass cutout -->
            <circle
              cx="11"
              cy="11"
              r="3.5"
              fill="var(--background-color, white)"
            />
            <path
              fill="var(--background-color, white)"
              d="M13.5 13.5 16 16"
              stroke="var(--background-color, white)"
              stroke-width="2"
              stroke-linecap="round"
            />
            <!-- magnifying glass outline -->
            <circle
              cx="11"
              cy="11"
              r="3"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            />
            <path
              d="M13.5 13.5 16 16"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          `
        : html`
            <path
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 12a9 9 0 0 1-13.815 7.605L3 21l1.395-4.185A9 9 0 1 1 21 12z"
            />
            <circle
              cx="10.5"
              cy="10.5"
              r="3"
              stroke="currentColor"
              stroke-width="2"
            />
            <path
              d="M13 13 16 16"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          `}
    </svg>
  </div>`;
}
