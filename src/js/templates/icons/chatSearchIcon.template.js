import { html } from "/js/lib/lit-html.js";
import { classnames } from "/js/utils.js";

// Chat bubble + magnifying glass
export function chatSearchIconTemplate({ filled = false } = ({} = {})) {
  return html`<div class=${classnames("icon chat-search-icon", { filled })}>
    ${filled
      ? html`<svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            fill="currentColor"
            fill-rule="evenodd"
            d="M12 3a8 8 0 0 0-6.32 12.906L4 20l4.094-1.68A8 8 0 1 0 12 3zm0 2a6 6 0 0 0-4.47 10.21l.52.44-2.09.86.86-2.09.44.52A6 6 0 0 0 12 5z"
            clip-rule="evenodd"
          />
          <circle fill="currentColor" cx="16" cy="16" r="4" />
          <path
            fill="var(--background-color, white)"
            d="M17.5 14.5h-3v1h1.3l-1.9 1.9.7.7 1.9-1.9v1.3h1v-3z"
          />
        </svg>`
      : html`<svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 20a8 8 0 1 0-6.32-12.906L4 20l4.094-1.68A7.97 7.97 0 0 0 12 20z"
          />
          <circle
            cx="16"
            cy="16"
            r="3"
            stroke="currentColor"
            stroke-width="2"
          />
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M18.1 18.1 19 19"
          />
        </svg>`}
  </div>`;
}
