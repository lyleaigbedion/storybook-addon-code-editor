import * as React from 'react';
import { EsModules, evalModule } from './evalModule';
import { errorStyle } from './ErrorBoundary';

interface PreviewProps {
  availableImports: EsModules;
  code: string;
  componentProps?: any;
}

/**
 * Renders a raw DOM element (HTMLElement) into a React ref container.
 * Used for Rapid Solid (createGtkElement returns HTMLElement) and
 * R+ widgets (widget.elem is an HTMLElement).
 */
function DomPreview({ element }: { element: HTMLElement }) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = ref.current;
    if (!container) return;
    container.innerHTML = '';
    container.appendChild(element);
    return () => { container.innerHTML = ''; };
  }, [element]);

  return <div ref={ref} style={{ width: '100%', minHeight: '20px' }} />;
}

/**
 * Renders an R+ widget by creating a sys-ui-web WidgetRoot.
 * Falls back to appending widget.elem if createRoot is unavailable.
 */
function WidgetPreview({ widget }: { widget: any }) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = ref.current;
    if (!container) return;
    container.innerHTML = '';

    // Try sys-ui-web createRoot for full widget context (styles, events, etc.)
    try {
      const createRoot = (globalThis as any).__bbkitCreateRoot;
      if (createRoot) {
        const root = createRoot(container);
        root.mount();
        root.container.content = widget;
        return () => {
          try { root.unmount(); } catch { /* ignore */ }
          container.innerHTML = '';
        };
      }
    } catch { /* fall through */ }

    // Fallback: append widget.elem directly
    if (widget.elem instanceof HTMLElement) {
      container.appendChild(widget.elem);
    }
    return () => { container.innerHTML = ''; };
  }, [widget]);

  return <div ref={ref} style={{ width: '100%', minHeight: '20px' }} />;
}

export default function Preview({ availableImports, code, componentProps }: PreviewProps) {
  let DefaultExport: any;

  try {
    DefaultExport = code ? evalModule(code, availableImports).default : undefined;
    if (DefaultExport === undefined || DefaultExport === null) {
      throw new TypeError('Default export is undefined');
    }
  } catch (error) {
    return <pre style={errorStyle}>{String(error)}</pre>;
  }

  // HTMLElement — Rapid Solid (createGtkElement returns HTMLElement)
  if (DefaultExport instanceof HTMLElement) {
    return <DomPreview element={DefaultExport} />;
  }

  // R+ widget — has .elem property from sys-ui-web-standalone
  if (typeof DefaultExport === 'object' && 'elem' in DefaultExport && !(typeof DefaultExport.$$typeof === 'symbol')) {
    return <WidgetPreview widget={DefaultExport} />;
  }

  // Function that returns HTMLElement or widget (factory pattern)
  if (typeof DefaultExport === 'function') {
    try {
      const result = DefaultExport(componentProps ?? {});
      if (result instanceof HTMLElement) return <DomPreview element={result} />;
      if (result && typeof result === 'object' && 'elem' in result) return <WidgetPreview widget={result} />;
      // React component — render normally
    } catch {
      // If calling as function fails, try as React component below
    }
  }

  // React component (original behavior)
  const isObject = DefaultExport && typeof DefaultExport === 'object';
  const isFunction = typeof DefaultExport === 'function';
  if (!isObject && !isFunction) {
    return <pre style={errorStyle}>Default export is not a React component, HTMLElement, or widget</pre>;
  }

  return <DefaultExport {...componentProps} />;
}
