import { Trash } from "@medusajs/icons"
import { Button, IconButton, Text, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { api, bannerKey, errorOf, KEY, type AdminBanner, type AdminConfig, type Focus, type ImageSlot } from "../lib/api"

type Props = {
  banner: AdminBanner
  slot: ImageSlot
  config: AdminConfig | undefined
  /** Current image URL (the form's draft, so a pasted URL shows at once) */
  url: string
  /** Width / height the preview keeps */
  ratio: number
  focus: Focus | null
  onFocus: (f: Focus) => void
  /** After an upload or a removal: the banner as the server returns it */
  onBanner: (b: AdminBanner) => void
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif"

/**
 * One image of the banner: drop zone / file picker, preview with a focal point the admin sets by clicking, remove.
 * The upload goes straight to the backend (File Module, scaled down there) and replaces the slot's previous file;
 * the focal point is saved with the form.
 */
export function UploadSlot({ banner, slot, config, url, ratio, focus, onFocus, onBanner }: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const maxMb = Math.round((config?.upload.max_bytes ?? 12 * 1024 * 1024) / 1024 / 1024)
  const done = (r: { banner: AdminBanner }) => {
    onBanner(r.banner)
    qc.setQueryData<{ banner: AdminBanner }>(bannerKey(banner.id), (old) => (old ? { banner: { ...old.banner, ...r.banner } } : old))
    qc.invalidateQueries({ queryKey: KEY })
  }
  const failed = (e: unknown) => {
    const { code } = errorOf(e)
    toast.error(t(code ? `hb.errors.${code}` : "hb.errors.unknown"))
  }
  const upload = useMutation({ mutationFn: (file: File) => api.upload(banner.id, slot, file), onSuccess: (r) => { toast.success(t("hb.upload.uploaded")); done(r) }, onError: failed })
  const remove = useMutation({ mutationFn: () => api.removeUpload(banner.id, slot), onSuccess: (r) => { toast.success(t("hb.upload.removed")); done(r) }, onError: failed })
  const pick = (files: FileList | null) => {
    const f = files?.[0]
    if (!f) return
    if (f.size > (config?.upload.max_bytes ?? Infinity)) return toast.error(t("hb.errors.file_too_large"))
    if (!ACCEPT.split(",").includes(f.type)) return toast.error(t("hb.errors.invalid_image"))
    upload.mutate(f)
  }
  const setFocus = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    onFocus({ x: Math.round(((e.clientX - r.left) / r.width) * 100), y: Math.round(((e.clientY - r.top) / r.height) * 100) })
  }
  const f = focus ?? { x: 50, y: 50 }
  const width = ratio >= 1 ? 360 : 160
  const busy = upload.isPending || remove.isPending
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start gap-3">
        <div
          className={`hb-drop ${over ? "hb-drop-over" : ""}`}
          style={{ width, aspectRatio: String(ratio) }}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files) }}
          data-testid={`hb-drop-${slot}`}
        >
          {url ? (
            <button type="button" className="hb-focus" onClick={setFocus} title={t("hb.upload.focusHint")} aria-label={t("hb.upload.focus")} style={{ cursor: "crosshair" }}>
              <img src={url} alt="" style={{ objectPosition: `${f.x}% ${f.y}%` }} />
              <span className="hb-focus-dot" style={{ left: `${f.x}%`, top: `${f.y}%` }} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className="hb-drop-empty" onClick={() => input.current?.click()} disabled={busy}>
              <Text size="xsmall" className="text-ui-fg-muted text-center">{busy ? t("hb.loading") : t("hb.upload.drop")}</Text>
            </button>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="small" isLoading={upload.isPending} onClick={() => input.current?.click()} style={{ minHeight: 36 }}>{url ? t("hb.upload.replace") : t("hb.upload.choose")}</Button>
            {url && <IconButton type="button" variant="transparent" size="small" aria-label={t("hb.upload.remove")} isLoading={remove.isPending} onClick={() => remove.mutate()} style={{ minHeight: 36, minWidth: 36 }}><Trash /></IconButton>}
          </div>
          <Text size="xsmall" className="text-ui-fg-muted">{t("hb.upload.hint", { mb: maxMb })}</Text>
          {url && <Text size="xsmall" className="text-ui-fg-muted">{t("hb.upload.focusHint")}</Text>}
          {url && !banner.uploads[slot] && <Text size="xsmall" className="text-ui-fg-muted break-all">{t("hb.upload.external")}</Text>}
        </div>
      </div>
      <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => { pick(e.target.files); e.target.value = "" }} />
    </div>
  )
}
