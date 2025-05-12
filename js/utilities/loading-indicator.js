// loading-indicator.js

// Inject HTML and CSS once when imported
(function setupLoadingOverlay() {
    const css = `
    #loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: rgba(0, 0, 0, 0.6);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      backdrop-filter: blur(2px);
      pointer-events: all;
      opacity: 0;
      transition: opacity 0.3s ease;
      visibility: hidden;
    }

    #loading-overlay.active {
      opacity: 1;
      visibility: visible;
    }

    .loader {
      width: 50px;
      height: 50px;
      border: 6px solid #ccc;
      border-top: 6px solid #00ffcc;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;

    const styleEl = document.createElement("style");
    styleEl.innerHTML = css;
    document.head.appendChild(styleEl);

    const overlay = document.createElement("div");
    overlay.id = "loading-overlay";
    overlay.innerHTML = `<div class="loader"></div>`;
    document.body.appendChild(overlay);
})();

// Control functions
export function showLoading() {
    document.getElementById("loading-overlay")?.classList.add("active");
}

export function hideLoading() {
    document.getElementById("loading-overlay")?.classList.remove("active");
}
