/**
 * freeroute Design Studio — Sandboxed Preview Runtime (srcdoc engine)
 * 
 * Inspired by modern sandboxed artifact runtimes:
 * - Injects Tailwind CSS, modern Google Fonts (Inter / Plus Jakarta Sans), and Lucide SVG icons.
 * - Injects a non-intrusive error-isolation bridge (catches runtime errors and reports via postMessage).
 * - Redirect-loop guard prevents infinite meta-refresh loops.
 * - Standardizes HTML fragments into full, responsive HTML5 documents.
 */

export interface SrcdocOptions {
  title?: string;
  theme?: "light" | "dark";
  baseHref?: string;
  reloadKey?: number;
}

/**
 * Sanitize document title for export filenames and tab display
 */
export function sanitizeTitle(text: string): string {
  return text
    .replace(/[:#%&*{}\\<>?/+|"]+/g, "-")
    .replace(/^~\$/, "")
    .trim() || "Untitled Project";
}

/**
 * In-iframe error and communication bridge script
 */
const OBSERVABILITY_BRIDGE_SCRIPT = `
<script>
  (function() {
    window.addEventListener('error', function(e) {
      // Prevent error from crashing parent window
      e.stopPropagation();
      var errorMsg = e.message || 'Script runtime exception';
      var filename = e.filename ? e.filename.split('/').pop() : '';
      var lineNo = e.lineno || '';
      
      // If error message is generic "Script error.", try to grab meaningful details
      if (errorMsg === 'Script error.') {
        errorMsg = 'External resource or syntax exception (Script error)';
      }

      window.parent.postMessage({
        type: 'freeroute:preview-error',
        message: errorMsg,
        filename: filename,
        lineno: lineNo,
        time: Date.now()
      }, '*');
    });

    window.addEventListener('unhandledrejection', function(e) {
      var reason = e.reason ? (e.reason.message || String(e.reason)) : 'Unhandled Promise Rejection';
      window.parent.postMessage({
        type: 'freeroute:preview-error',
        message: reason,
        time: Date.now()
      }, '*');
    });

    // Notify parent that document is loaded and responsive
    window.addEventListener('DOMContentLoaded', function() {
      window.parent.postMessage({
        type: 'freeroute:preview-ready',
        title: document.title,
        time: Date.now()
      }, '*');
    });
  })();
</script>
`;

/**
 * Universal SVG Icon Proxy for in-browser lucide-react or generic icons
 */
const ICON_HELPER_SCRIPT = `
<script>
  // Ensure basic icons or interactive helpers are available
  window.__createIconSvg = function(name, size) {
    size = size || 18;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" opacity="0.2"></circle><path d="M12 8v8M8 12h8"></path></svg>';
  };
</script>
`;

/**
 * Build a robust, sandboxed srcdoc HTML string from raw artifact content
 */
export function buildSrcdoc(rawContent: string, options: SrcdocOptions = {}): string {
  if (!rawContent || !rawContent.trim()) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-50 text-slate-500 font-sans flex items-center justify-center min-h-screen">
  <div class="text-center p-6">
    <div class="w-8 h-8 mx-auto mb-3 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin"></div>
    <p class="text-sm font-medium">Ready to render prototype...</p>
  </div>
</body>
</html>`;
  }

  let content = rawContent.replace(/^﻿/, "").trim();

  // Guard against meta-refresh infinite redirect loops
  content = content.replace(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*>/gi, "<!-- [meta refresh disabled] -->");

  const isFullDoc = /<!doctype\s+html/i.test(content) || /<html\b/i.test(content);

  // If it's already a full HTML document
  if (isFullDoc) {
    // Ensure viewport and Tailwind CDN exist
    let result = content;

    // Inject Tailwind CDN if missing
    if (!result.includes("cdn.tailwindcss.com")) {
      const tailwindScript = `<script src="https://cdn.tailwindcss.com"></script>\n`;
      if (result.includes("<head>")) {
        result = result.replace("<head>", `<head>\n  ${tailwindScript}`);
      } else if (result.includes("<head ")) {
        result = result.replace(/<head[^>]*>/, `$& \n  ${tailwindScript}`);
      }
    }

    // Inject Observability bridge and Icon helpers into <head>
    if (result.includes("</head>")) {
      result = result.replace("</head>", `  ${OBSERVABILITY_BRIDGE_SCRIPT}\n  ${ICON_HELPER_SCRIPT}\n</head>`);
    } else if (result.includes("<body")) {
      result = result.replace("<body", `${OBSERVABILITY_BRIDGE_SCRIPT}\n<body`);
    } else {
      result = `${OBSERVABILITY_BRIDGE_SCRIPT}\n${result}`;
    }

    // Embed reload key if provided
    if (options.reloadKey !== undefined) {
      result = result.replace(/(<html\b)([^>]*>)/i, `$1 data-reload-key="${options.reloadKey}"$2`);
    }

    return result;
  }

  // Fragment-shaped content: wrap into a clean, modern HTML5 shell
  const safeTitle = sanitizeTitle(options.title || "Prototype Preview");

  return `<!DOCTYPE html>
<html lang="en" class="${options.theme === "dark" ? "dark" : ""}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <!-- Google Fonts: Inter & Plus Jakarta Sans -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
          },
          colors: {
            brand: {
              50: '#eef2ff',
              100: '#e0e7ff',
              500: '#6366f1',
              600: '#4f46e5',
              700: '#4338ca',
            }
          }
        }
      }
    };
  </script>
  <style>
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
      margin: 0;
      padding: 0;
      min-height: 100vh;
    }
  </style>
  ${OBSERVABILITY_BRIDGE_SCRIPT}
  ${ICON_HELPER_SCRIPT}
</head>
<body class="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen">
  ${content}
</body>
</html>`;
}
