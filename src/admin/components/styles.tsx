/**
 * Layout rules the plugin needs that the Admin's own stylesheet may not contain (arbitrary grid templates); the
 * utility classes used elsewhere exist because @medusajs/admin-bundler scans the plugin's Admin bundle.
 */
export const HbStyles = () => (
  <style>{`
.hb-cols-editor { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
.hb-cols-2 { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.hb-row { display: grid; grid-template-columns: 24px 72px minmax(0, 1fr) auto; gap: 12px; align-items: center; }
.hb-thumb { width: 72px; height: 30px; border-radius: 6px; overflow: hidden; background: var(--bg-subtle); border: 1px solid var(--border-base); display: flex; align-items: center; justify-content: center; }
.hb-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }
.hb-thumb-text { background: #111; color: #fff; font-size: 10px; letter-spacing: .04em; text-transform: uppercase; }
.hb-drag { cursor: grab; touch-action: none; color: var(--fg-muted); }
.hb-drag:active { cursor: grabbing }
.hb-drop { position: relative; flex: none; max-width: 100%; overflow: hidden; border: 1px dashed var(--border-strong); border-radius: 10px; background: var(--bg-subtle); }
.hb-drop-over { border-color: var(--fg-interactive); background: var(--bg-interactive); }
.hb-drop-empty, .hb-focus { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 8px; border: 0; background: transparent; font: inherit; }
.hb-focus img { display: block; width: 100%; height: 100%; object-fit: cover; }
.hb-focus-dot { position: absolute; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.6), inset 0 0 0 1px rgba(0,0,0,.6); pointer-events: none; }
.hb-preview { position: relative; aspect-ratio: 12 / 5; border-radius: 12px; overflow: hidden; background: #111 center / cover no-repeat; color: #fff; }
.hb-preview-scrim { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,.75), rgba(0,0,0,.35) 50%, rgba(0,0,0,.1)); }
.hb-preview-copy { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; gap: 8px; padding: 20px; }
.hb-preview-copy h3 { margin: 0; font-size: 22px; line-height: 1.1; font-weight: 600; letter-spacing: -.01em; max-width: 24ch; text-wrap: balance; }
.hb-preview-copy p { margin: 0; font-size: 13px; opacity: .9; max-width: 44ch; }
.hb-preview-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
.hb-preview-copy span { display: inline-flex; align-items: center; width: fit-content; height: 32px; padding: 0 14px; border-radius: 8px; background: #fff; color: #111; font-size: 12px; font-weight: 500; }
.hb-preview-copy span.hb-preview-secondary { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,.7); }
.hb-preview-text .hb-preview-copy { justify-content: center; }
.hb-seg { display: inline-flex; padding: 2px; border-radius: 8px; background: var(--bg-subtle); border: 1px solid var(--border-base); }
.hb-seg button { min-height: 36px; padding: 0 12px; border: 0; border-radius: 6px; background: transparent; font: inherit; color: var(--fg-subtle); cursor: pointer; }
.hb-seg button[aria-pressed="true"] { background: var(--bg-base); color: var(--fg-base); box-shadow: 0 1px 2px rgba(0,0,0,.08); }
@media (min-width: 1024px) {
  .hb-cols-editor { grid-template-columns: minmax(0, 1fr) 420px; }
  .hb-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`}</style>
)
