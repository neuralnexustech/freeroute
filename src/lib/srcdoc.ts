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
    // 1. Error Reporting Bridge
    window.addEventListener('error', function(e) {
      e.stopPropagation();
      var errorMsg = e.message || 'Script runtime exception';
      var filename = e.filename ? e.filename.split('/').pop() : '';
      var lineNo = e.lineno || '';
      var stack = e.error ? (e.error.stack || '') : '';
      
      if (errorMsg === 'Script error.') {
        errorMsg = 'External resource or syntax exception (Script error)';
      }

      window.parent.postMessage({
        type: 'freeroute:preview-error',
        message: errorMsg,
        filename: filename,
        lineno: lineNo,
        stack: stack,
        time: Date.now()
      }, '*');
    });

    window.addEventListener('unhandledrejection', function(e) {
      var reason = e.reason ? (e.reason.message || String(e.reason)) : 'Unhandled Promise Rejection';
      var stack = e.reason && e.reason.stack ? e.reason.stack : '';
      window.parent.postMessage({
        type: 'freeroute:preview-error',
        message: reason,
        stack: stack,
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

    // 2. Mouse Inspector Mode Bridge
    var inspectorEnabled = false;
    var overlay = null;
    var badge = null;

    function ensureInspectorUI() {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.pointerEvents = 'none';
        overlay.style.border = '2px solid #3b82f6';
        overlay.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
        overlay.style.borderRadius = '3px';
        overlay.style.zIndex = '999999';
        overlay.style.display = 'none';
        overlay.style.transition = 'all 0.05s ease-out';
        document.body.appendChild(overlay);

        badge = document.createElement('div');
        badge.style.position = 'absolute';
        badge.style.bottom = '100%';
        badge.style.left = '0';
        badge.style.transform = 'translateY(-4px)';
        badge.style.backgroundColor = '#1e40af';
        badge.style.color = '#ffffff';
        badge.style.padding = '2px 6px';
        badge.style.fontSize = '11px';
        badge.style.fontFamily = 'monospace';
        badge.style.borderRadius = '3px';
        badge.style.whiteSpace = 'nowrap';
        badge.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        overlay.appendChild(badge);
      }
    }

    window.addEventListener('message', function(evt) {
      if (!evt.data) return;
      if (evt.data.type === 'freeroute:set-inspector') {
        inspectorEnabled = !!evt.data.enabled;
        ensureInspectorUI();
        if (!inspectorEnabled && overlay) {
          overlay.style.display = 'none';
        }
      }
    });

    document.addEventListener('mousemove', function(e) {
      if (!inspectorEnabled) return;
      ensureInspectorUI();
      var target = e.target;
      if (!target || target === overlay || target === badge || target === document.body || target === document.documentElement) {
        overlay.style.display = 'none';
        return;
      }

      var rect = target.getBoundingClientRect();
      overlay.style.display = 'block';
      overlay.style.top = rect.top + 'px';
      overlay.style.left = rect.left + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';

      var tag = target.tagName.toLowerCase();
      var cls = target.className && typeof target.className === 'string' ? '.' + target.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';
      badge.textContent = '<' + tag + cls + '> ' + Math.round(rect.width) + '×' + Math.round(rect.height);
    }, true);

    document.addEventListener('click', function(e) {
      if (!inspectorEnabled) return;
      e.preventDefault();
      e.stopPropagation();

      var target = e.target;
      if (!target || target === overlay || target === badge) return;

      var tag = target.tagName.toLowerCase();
      var cls = target.className && typeof target.className === 'string' ? target.className : '';
      var outer = target.outerHTML || '';
      // Truncate cleanly if massive
      if (outer.length > 1200) {
        outer = outer.slice(0, 1200) + '...';
      }

      window.parent.postMessage({
        type: 'freeroute:element-selected',
        tag: tag,
        classes: cls,
        snippet: outer,
        text: (target.innerText || '').slice(0, 100),
        time: Date.now()
      }, '*');

      // Flash feedback
      if (overlay) {
        overlay.style.backgroundColor = 'rgba(16, 185, 129, 0.3)';
        overlay.style.borderColor = '#10b981';
        badge.style.backgroundColor = '#065f46';
        setTimeout(function() {
          if (overlay) {
            overlay.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
            overlay.style.borderColor = '#3b82f6';
            badge.style.backgroundColor = '#1e40af';
          }
        }, 400);
      }
    }, true);
  })();
</script>
`;

/**
 * Universal SVG Icon & Lucide Dictionary
 */
const LUCIDE_PATH_MAP: Record<string, string> = {
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  arrowright: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  arrowupright: '<path d="M7 17L17 7M7 7h10v10"/>',
  chevronright: '<path d="m9 18 6-6-6-6"/>',
  chevronleft: '<path d="m15 18-6-6 6-6"/>',
  chevrondown: '<path d="m6 9 6 6 6-6"/>',
  chevronup: '<path d="m18 15-6-6-6 6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  trendingup: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  trendingdown: '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
  dollarsign: '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  barchart: '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>',
  barchart2: '<line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>',
  barchart3: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  piechart: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  sparkles: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  refreshcw: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M3 21v-5h5"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  sliders: '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="8" y2="8"/><line x1="17" x2="23" y1="16" y2="16"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>',
  server: '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>',
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  pause: '<rect width="4" height="16" x="6" y="4"/><rect width="4" height="16" x="14" y="4"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  share2: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
  externallink: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>',
  mappin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  alertcircle: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/>',
  smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/>',
  laptop: '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>',
};

/**
 * Universal SVG Icon Proxy & Auto-Unescape Post-Processor
 */
const ICON_HELPER_SCRIPT = `
<script>
  (function() {
    var pathMap = ${JSON.stringify(LUCIDE_PATH_MAP)};

    window.__getLucideSvg = function(name, size, color, className) {
      size = size || 18;
      color = color || 'currentColor';
      className = className || '';
      var cleanKey = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      var path = pathMap[cleanKey] || pathMap['sparkles'] || '<circle cx="12" cy="12" r="9" opacity="0.2"></circle><path d="M12 8v8M8 12h8"></path>';
      return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' + className + '">' + path + '</svg>';
    };

    window.__createIconSvg = function(name, size) {
      return window.__getLucideSvg(name, size, 'currentColor', '');
    };

    // Auto-unescape any text nodes containing raw markup strings
    window.__autoRenderUnescapedMarkup = function(rootNode) {
      if (!rootNode) return;
      try {
        var walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, null, false);
        var nodesToReplace = [];
        var node;
        while ((node = walker.nextNode())) {
          var val = (node.nodeValue || '').trim();
          if ((val.indexOf('<svg') === 0 || val.indexOf('<span') === 0 || val.indexOf('&lt;svg') === 0) &&
              (val.indexOf('</svg>') !== -1 || val.indexOf('</span>') !== -1 || val.indexOf('&gt;') !== -1)) {
            nodesToReplace.push(node);
          }
        }
        for (var i = 0; i < nodesToReplace.length; i++) {
          var textNode = nodesToReplace[i];
          var parent = textNode.parentNode;
          if (parent && parent.nodeName !== 'SCRIPT' && parent.nodeName !== 'STYLE' && parent.nodeName !== 'CODE' && parent.nodeName !== 'PRE') {
            var span = document.createElement('span');
            var raw = textNode.nodeValue
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"');
            span.innerHTML = raw;
            parent.replaceChild(span, textNode);
          }
        }
      } catch (_) {}
    };

    // Install DOM MutationObserver to dynamically sanitize any raw JSX string output
    if (typeof MutationObserver === 'function') {
      var obs = new MutationObserver(function() {
        window.__autoRenderUnescapedMarkup(document.getElementById('root') || document.body);
      });
      window.addEventListener('DOMContentLoaded', function() {
        var target = document.getElementById('root') || document.body;
        if (target) {
          obs.observe(target, { childList: true, subtree: true });
          window.__autoRenderUnescapedMarkup(target);
        }
      });
    }
  })();
</script>
`;

/**
 * Built-in Keyframe Animations and Workable Utility Classes
 */
const BUILTIN_ANIMATIONS_CSS = `
  @keyframes od-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
  @keyframes od-pulse-glow { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.85; } }
  @keyframes od-slide-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes od-fade-in { from { opacity: 0; } to { opacity: 1; } }
  .animate-float { animation: od-float 3s ease-in-out infinite; }
  .animate-pulse-glow { animation: od-pulse-glow 2s ease-in-out infinite; }
  .animate-slide-in { animation: od-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .animate-fade-in { animation: od-fade-in 0.3s ease-out forwards; }
  .hover-lift { transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
  .hover-lift:hover { transform: translateY(-2px); }
  .glassmorphism { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
  .dark .glassmorphism { background: rgba(15, 23, 42, 0.75); }
`;

/**
 * Check if the content is a React / JSX / TSX source component
 */
export function isReactComponentSource(source: string, filename?: string): boolean {
  if (!source) return false;
  const lower = (filename || "").toLowerCase();
  if (lower.endsWith(".tsx") || lower.endsWith(".jsx")) return true;
  if (/^<!doctype\s+html/i.test(source.trim()) || /^<html\b/i.test(source.trim())) return false;
  return (
    /import\s+[\s\S]*?from\s+['"]react['"]/i.test(source) ||
    /import\s+[\s\S]*?from\s+['"]lucide-react['"]/i.test(source) ||
    /export\s+default\s+function/i.test(source) ||
    /export\s+default\s+class/i.test(source) ||
    /function\s+(?:App|Dashboard|Component|Page|Main)\s*\(/i.test(source) ||
    /(?:useState|useEffect|useRef|useMemo|useCallback)\s*\(/i.test(source)
  );
}

function reactImportReplacement(specifier: string): string {
  const bindings: string[] = [];
  const trimmed = specifier.trim();
  const namespaceMatch = trimmed.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/);
  const namespaceName = namespaceMatch?.[1];
  if (namespaceName) {
    bindings.push(`const ${namespaceName} = window.React;`);
    return bindings.join("\n");
  }

  const namedMatch = trimmed.match(/\{([\s\S]*)\}/);
  const namedPart = namedMatch?.[1]?.trim() ?? "";
  const defaultPart = trimmed
    .replace(/\{[\s\S]*\}/, "")
    .replace(/,\s*$/, "")
    .trim();

  if (defaultPart) bindings.push(`const ${defaultPart} = window.React;`);
  if (namedPart) {
    const namedBindings = namedPart
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => !part.startsWith("type "))
      .map((part) => part.replace(/\s+as\s+/g, ": "))
      .join(", ");
    if (namedBindings) bindings.push(`const { ${namedBindings} } = window.React;`);
  }

  return bindings.join("\n");
}

function lucideImportReplacement(specifier: string): string {
  const match = specifier.match(/\{([\s\S]*)\}/);
  if (!match) return "";
  const names = match[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !s.startsWith("type "));

  return names
    .map((name) => {
      return `const ${name} = function(props) {
        const p = props || {};
        const size = p.size || p.width || 18;
        const color = p.color || 'currentColor';
        const cls = p.className || '';
        const svgString = window.__getLucideSvg('${name}', size, color, cls);
        return window.React.createElement('span', {
          style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle' },
          className: cls,
          dangerouslySetInnerHTML: { __html: svgString }
        });
      };`;
    })
    .join("\n");
}

function transformExports(source: string): { code: string; defaultName: string | null } {
  let defaultName: string | null = null;
  let firstNamedExport: string | null = null;
  let code = source;

  code = code.replace(
    /export\s+default\s+function\s+([A-Za-z_$][\w$]*)?\s*\(/g,
    (_match, name: string | undefined) => {
      defaultName = name || "FreerouteComponent";
      return `function ${defaultName}(`;
    }
  );
  code = code.replace(
    /export\s+default\s+class\s+([A-Za-z_$][\w$]*)?\s*/g,
    (_match, name: string | undefined) => {
      defaultName = name || "FreerouteComponent";
      return `class ${defaultName} `;
    }
  );
  code = code.replace(/export\s+default\s+([A-Za-z_$][\w$]*)\s*;?/g, (_match, name: string) => {
    defaultName = name;
    return "";
  });
  code = code.replace(/export\s+default\s+/g, () => {
    defaultName = "FreerouteComponent";
    return "const FreerouteComponent = ";
  });
  code = code.replace(/export\s+(const|let|var)\s+([A-Za-z_$][\w$]*)/g, (_match, kind: string, name: string) => {
    firstNamedExport ||= name;
    return `${kind} ${name}`;
  });
  code = code.replace(/export\s+function\s+([A-Za-z_$][\w$]*)/g, (_match, name: string) => {
    firstNamedExport ||= name;
    return `function ${name}`;
  });
  code = code.replace(/export\s+class\s+([A-Za-z_$][\w$]*)/g, (_match, name: string) => {
    firstNamedExport ||= name;
    return `class ${name}`;
  });
  code = code.replace(/export\s*\{([^}]*)\};?/g, (_match, specifiers: string) => {
    for (const rawSpecifier of specifiers.split(",")) {
      const specifier = rawSpecifier.trim();
      const defaultMatch = specifier.match(/^([A-Za-z_$][\w$]*)\s+as\s+default$/);
      const reexportedDefaultName = defaultMatch?.[1];
      if (reexportedDefaultName) {
        defaultName = reexportedDefaultName;
        continue;
      }
      const namedMatch = specifier.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+[A-Za-z_$][\w$]*)?$/);
      const exportedName = namedMatch?.[1];
      if (exportedName) firstNamedExport ||= exportedName;
    }
    return "";
  });

  return { code, defaultName: defaultName || firstNamedExport };
}

function componentFallbackExpression(defaultName: string | null): string {
  const names = [defaultName, "App", "Dashboard", "Component", "Preview", "Page", "Main"].filter(
    (value, index, list): value is string => Boolean(value) && list.indexOf(value) === index
  );
  return names
    .map((name) => `(typeof ${name} !== 'undefined' ? ${name} : null)`)
    .concat("null")
    .join(" || ");
}

export function prepareReactComponentSource(source: string): string {
  let code = source
    .replace(/^\s*import\s+type\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?\s*$/gm, "")
    .replace(/^\s*import\s+([\s\S]*?)\s+from\s+['"]react['"];?\s*$/gm, (_match, specifier) => {
      return reactImportReplacement(specifier);
    })
    .replace(/^\s*import\s+([\s\S]*?)\s+from\s+['"]lucide-react['"];?\s*$/gm, (_match, specifier) => {
      return lucideImportReplacement(specifier);
    })
    .replace(/^\s*import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?\s*$/gm, "")
    .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, "");

  const { code: transformedCode, defaultName } = transformExports(code);

  return `${transformedCode}
window.__FreerouteComponent = window.__FreerouteComponent || (${componentFallbackExpression(defaultName)});`;
}

/**
 * Build dynamic in-browser React 18 + Babel Standalone runtime srcdoc
 */
export function buildReactComponentSrcdoc(
  source: string,
  options: SrcdocOptions = {}
): string {
  const safeTitle = sanitizeTitle(options.title || "React Component");
  const prepared = prepareReactComponentSource(source);
  const sourceJson = JSON.stringify(prepared);

  return `<!doctype html>
<html lang="en" class="${options.theme === "dark" ? "dark" : ""}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
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
    <!-- Chart.js for data visualization -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      html, body, #root { min-height: 100%; margin: 0; padding: 0; }
      body {
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        background: ${options.theme === "dark" ? "#0b0c10" : "#ffffff"};
        color: ${options.theme === "dark" ? "#f8fafc" : "#0f172a"};
        -webkit-font-smoothing: antialiased;
      }
      .od-react-error {
        margin: 20px;
        padding: 16px 20px;
        border: 1px solid #fecaca;
        border-radius: 12px;
        background: #fff1f2;
        color: #991b1b;
        font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        white-space: pre-wrap;
      }
      .od-react-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        gap: 12px;
        color: #64748b;
        font-family: sans-serif;
        font-size: 14px;
      }
      .od-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid rgba(99, 102, 241, 0.2);
        border-top-color: #6366f1;
        border-radius: 50%;
        animation: od-spin 0.8s linear infinite;
      }
      @keyframes od-spin { to { transform: rotate(360deg); } }
      ${BUILTIN_ANIMATIONS_CSS}
    </style>
    ${OBSERVABILITY_BRIDGE_SCRIPT}
    ${ICON_HELPER_SCRIPT}
  </head>
  <body>
    <div id="root">
      <div class="od-react-loading">
        <div class="od-spinner"></div>
        <div>Mounting interactive component...</div>
      </div>
    </div>

    <!-- React 18 UMD & Babel Standalone -->
    <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <!-- Lucide Icons UMD -->
    <script src="https://cdn.jsdelivr.net/npm/lucide@0.469.0/dist/umd/lucide.min.js"></script>

    <script>
      (function(){
        var root = document.getElementById('root');
        function showError(err) {
          root.innerHTML = '';
          var el = document.createElement('pre');
          el.className = 'od-react-error';
          el.textContent = '⚠️ Component Runtime Notice:\\n\\n' + (err && (err.stack || err.message) ? (err.stack || err.message) : String(err));
          root.appendChild(el);
          window.parent.postMessage({ type: 'freeroute:preview-error', message: String(err) }, '*');
        }

        if (!window.React || !window.ReactDOM || !window.Babel) {
          showError(new Error('React/Babel runtime failed to load from CDN. Please verify internet connection.'));
          return;
        }

        var compiled;
        try {
          compiled = window.Babel.transform(${sourceJson}, {
            filename: 'artifact.tsx',
            presets: ['typescript', 'react'],
          }).code;
        } catch (err) {
          showError(err);
          return;
        }

        try {
          (0, eval)(compiled);
          var Component = window.__FreerouteComponent ||
            window.__OpenDesignComponent ||
            (typeof App !== 'undefined' ? App : null) ||
            (typeof Component !== 'undefined' ? Component : null) ||
            (typeof Dashboard !== 'undefined' ? Dashboard : null) ||
            (typeof Preview !== 'undefined' ? Preview : null) ||
            (typeof Page !== 'undefined' ? Page : null) ||
            (typeof Main !== 'undefined' ? Main : null);

          if (!Component) {
            throw new Error('No React component export found. Define a component like: function App() { return <div>...</div> }');
          }

          root.innerHTML = '';
          window.ReactDOM.createRoot(root).render(window.React.createElement(Component));

          setTimeout(function() {
            if (typeof window.__autoRenderUnescapedMarkup === 'function') {
              window.__autoRenderUnescapedMarkup(root);
            }
          }, 60);
          setTimeout(function() {
            if (typeof window.__autoRenderUnescapedMarkup === 'function') {
              window.__autoRenderUnescapedMarkup(root);
            }
          }, 350);

          window.parent.postMessage({ type: 'freeroute:preview-ready', title: document.title, time: Date.now() }, '*');
        } catch (err) {
          showError(err);
        }
      })();
    </script>
  </body>
</html>`;
}

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

  // 1. Check if it's a React / TSX / JSX component
  if (isReactComponentSource(content, options.title)) {
    return buildReactComponentSrcdoc(content, options);
  }

  const isFullDoc = /<!doctype\s+html/i.test(content) || /<html\b/i.test(content);

  // 2. If it's already a full HTML document
  if (isFullDoc) {
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

    // Inject Chart.js if missing and document has canvas
    if (result.includes("<canvas") && !result.includes("chart.js")) {
      const chartScript = `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>\n`;
      if (result.includes("<head>")) {
        result = result.replace("<head>", `<head>\n  ${chartScript}`);
      }
    }

    // Inject built-in animations, observability bridge, and icon helpers into <head>
    const injectionHead = `
  <style>${BUILTIN_ANIMATIONS_CSS}</style>
  ${OBSERVABILITY_BRIDGE_SCRIPT}
  ${ICON_HELPER_SCRIPT}
`;
    if (result.includes("</head>")) {
      result = result.replace("</head>", `${injectionHead}\n</head>`);
    } else if (result.includes("<body")) {
      result = result.replace("<body", `${injectionHead}\n<body`);
    } else {
      result = `${injectionHead}\n${result}`;
    }

    // Embed reload key if provided
    if (options.reloadKey !== undefined) {
      result = result.replace(/(<html\b)([^>]*>)/i, `$1 data-reload-key="${options.reloadKey}"$2`);
    }

    return result;
  }

  // 3. Fragment-shaped HTML: wrap into a clean, modern HTML5 shell with Tailwind and Google Fonts
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
  <!-- Chart.js for data visualization -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
  <style>
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
      margin: 0;
      padding: 0;
      min-height: 100vh;
    }
    ${BUILTIN_ANIMATIONS_CSS}
  </style>
  ${OBSERVABILITY_BRIDGE_SCRIPT}
  ${ICON_HELPER_SCRIPT}
</head>
<body class="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen">
  ${content}
</body>
</html>`;
}

export const buildSandboxedSrcDoc = buildSrcdoc;
