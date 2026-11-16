import { Button, Input, Select, Switch, Text, Textarea, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { api, bannerKey, errorOf, fromLocalInput, KEY, splitLocales, toLocalInput, type AdminBanner, type AdminBannerInput, type AdminConfig, type Focus } from "../lib/api"
import { Field } from "./states"
import { UploadSlot } from "./upload-slot"

type Tr = { title: string; subtitle: string; cta: string; secondary_cta: string; alt: string }
type Draft = {
  name: string
  placement: string
  enabled: boolean
  locales: string
  href: string
  secondary_href: string
  image_desktop: string
  image_mobile: string
  focus: { desktop: Focus | null; mobile: Focus | null }
  starts_at: string
  ends_at: string
  translations: Record<string, Tr>
}

const EMPTY_TR: Tr = { title: "", subtitle: "", cta: "", secondary_cta: "", alt: "" }

const fromBanner = (b: AdminBanner): Draft => ({
  name: b.name,
  placement: b.placement,
  enabled: b.enabled,
  locales: b.locales.join(", "),
  href: b.href ?? "",
  secondary_href: b.secondary_href ?? "",
  image_desktop: b.image.desktop ?? "",
  image_mobile: b.image.mobile ?? "",
  focus: { desktop: b.focus.desktop ?? null, mobile: b.focus.mobile ?? null },
  starts_at: toLocalInput(b.starts_at),
  ends_at: toLocalInput(b.ends_at),
  translations: Object.fromEntries(b.locales.map((l) => [l, { title: b.translations[l]?.title ?? "", subtitle: b.translations[l]?.subtitle ?? "", cta: b.translations[l]?.cta ?? "", secondary_cta: b.translations[l]?.secondary_cta ?? "", alt: b.translations[l]?.alt ?? "" }])),
})

function toInput(d: Draft): AdminBannerInput {
  const locales = splitLocales(d.locales)
  const translations: AdminBannerInput["translations"] = {}
  for (const [l, t] of Object.entries(d.translations)) if (locales.includes(l)) translations[l] = { title: t.title, subtitle: t.subtitle || null, cta: t.cta || null, secondary_cta: t.secondary_cta || null, alt: t.alt || null }
  return {
    name: d.name,
    placement: d.placement,
    enabled: d.enabled,
    locales,
    href: d.href || null,
    secondary_href: d.secondary_href || null,
    image_desktop: d.image_desktop || null,
    image_mobile: d.image_mobile || null,
    focus: d.focus,
    starts_at: fromLocalInput(d.starts_at),
    ends_at: fromLocalInput(d.ends_at),
    translations,
  }
}

const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-3 border-t px-6 py-4">
    <div className="flex flex-col">
      <Text size="small" weight="plus">{title}</Text>
      {hint && <Text size="xsmall" className="text-ui-fg-muted">{hint}</Text>}
    </div>
    {children}
  </div>
)

/** Rough rendering of the slide (desktop proportions, default locale) from the draft */
export function Preview({ d }: { d: Draft }) {
  const { t } = useTranslation()
  const locales = splitLocales(d.locales)
  const tr = d.translations[locales[0]] ?? EMPTY_TR
  const image = d.image_desktop || d.image_mobile
  const f = d.image_desktop ? d.focus.desktop : d.focus.mobile
  return (
    <div className={`hb-preview ${image ? "" : "hb-preview-text"}`} style={image ? { backgroundImage: `url("${image}")`, backgroundPosition: `${f?.x ?? 50}% ${f?.y ?? 50}%` } : undefined} data-testid="hb-preview">
      {image && <div className="hb-preview-scrim" aria-hidden="true" />}
      <div className="hb-preview-copy">
        <h3>{tr.title || d.name || t("hb.untitled")}</h3>
        {tr.subtitle && <p>{tr.subtitle}</p>}
        <div className="hb-preview-buttons">
          {d.href && <span>{tr.cta || t("hb.banner.ctaHint").replace(/^[^“]*“|”.*$/g, "")}</span>}
          {d.secondary_href && tr.secondary_cta && <span className="hb-preview-secondary">{tr.secondary_cta}</span>}
        </div>
      </div>
    </div>
  )
}

export function BannerForm({ banner, config }: { banner: AdminBanner; config: AdminConfig | undefined }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [d, setD] = useState<Draft>(() => fromBanner(banner))
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }))
  const setT = (l: string, k: keyof Tr, v: string) => setD((x) => ({ ...x, translations: { ...x.translations, [l]: { ...(x.translations[l] ?? EMPTY_TR), [k]: v } } }))
  /** After an upload/removal the server already stored the URL; only the image fields of the draft follow (other edits stay) */
  const fromUpload = (b: AdminBanner) => setD((x) => ({ ...x, image_desktop: b.image.desktop ?? "", image_mobile: b.image.mobile ?? "", focus: { desktop: b.image.desktop ? x.focus.desktop : null, mobile: b.image.mobile ? x.focus.mobile : null } }))
  const locales = splitLocales(d.locales)
  const save = useMutation({
    mutationFn: () => api.update(banner.id, toInput(d)),
    onSuccess: (r) => {
      toast.success(t("hb.saved"))
      setD(fromBanner(r.banner))
      qc.setQueryData(bannerKey(banner.id), r)
      qc.invalidateQueries({ queryKey: KEY })
    },
    onError: (e) => {
      const { code } = errorOf(e)
      toast.error(t(code ? `hb.errors.${code}` : "hb.errors.unknown"))
    },
  })
  const placements = config?.placements ?? [d.placement]
  const leads = banner.urls?.[locales[0]] ?? null
  const leads2 = banner.secondary_urls?.[locales[0]] ?? null
  return (
    <form
      className="flex flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
      data-testid="hb-form"
    >
      <div className="flex flex-col gap-3 px-6 py-4">
        <label className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <Text size="small" weight="plus">{t("hb.banner.enabled")}</Text>
            <Text size="xsmall" className="text-ui-fg-muted">{t("hb.banner.enabledHint")}</Text>
          </span>
          <Switch checked={d.enabled} onCheckedChange={(v) => set({ enabled: v })} data-testid="hb-enabled" />
        </label>
        <Field label={t("hb.banner.name")} hint={t("hb.banner.nameHint")}>
          <Input required maxLength={120} value={d.name} onChange={(e) => set({ name: e.target.value })} style={{ height: 44 }} />
        </Field>
        {placements.length > 1 && (
          <Field label={t("hb.placement")}>
            <Select value={d.placement} onValueChange={(v) => set({ placement: v })}>
              <Select.Trigger style={{ height: 44 }}><Select.Value /></Select.Trigger>
              <Select.Content>
                {placements.map((p) => <Select.Item key={p} value={p}>{p}</Select.Item>)}
              </Select.Content>
            </Select>
          </Field>
        )}
        <Field label={t("hb.banner.href")} hint={leads && d.href === (banner.href ?? "") ? t("hb.banner.hrefLeads", { url: leads }) : t("hb.banner.hrefHint")}>
          <Input value={d.href} autoCapitalize="none" spellCheck={false} placeholder="/store" onChange={(e) => set({ href: e.target.value })} style={{ height: 44 }} data-testid="hb-href" />
        </Field>
        <Field label={t("hb.banner.secondaryHref")} hint={leads2 && d.secondary_href === (banner.secondary_href ?? "") ? t("hb.banner.hrefLeads", { url: leads2 }) : t("hb.banner.secondaryHrefHint")}>
          <Input value={d.secondary_href} autoCapitalize="none" spellCheck={false} placeholder="/custom" onChange={(e) => set({ secondary_href: e.target.value })} style={{ height: 44 }} data-testid="hb-secondary-href" />
        </Field>
        <Field label={t("hb.banner.locales")} hint={t("hb.banner.localesHint")}>
          <Input required value={d.locales} autoCapitalize="none" spellCheck={false} onChange={(e) => set({ locales: e.target.value })} style={{ height: 44 }} />
        </Field>
      </div>

      <Section title={t("hb.banner.schedule")} hint={t("hb.banner.scheduleHint")}>
        <div className="hb-cols-2">
          <Field label={t("hb.banner.startsAt")}>
            <Input type="datetime-local" value={d.starts_at} onChange={(e) => set({ starts_at: e.target.value })} style={{ height: 44 }} />
          </Field>
          <Field label={t("hb.banner.endsAt")}>
            <Input type="datetime-local" value={d.ends_at} onChange={(e) => set({ ends_at: e.target.value })} style={{ height: 44 }} />
          </Field>
        </div>
      </Section>

      <Section title={t("hb.banner.images")} hint={t("hb.banner.imagesHint")}>
        <Field label={t("hb.banner.desktop")} hint={t("hb.banner.desktopHint")}>
          <UploadSlot banner={banner} slot="desktop" config={config} url={d.image_desktop} ratio={12 / 5} focus={d.focus.desktop} onFocus={(f) => set({ focus: { ...d.focus, desktop: f } })} onBanner={fromUpload} />
        </Field>
        <Field label={t("hb.banner.imageUrl")}>
          <Input type="url" inputMode="url" value={d.image_desktop} onChange={(e) => set({ image_desktop: e.target.value })} placeholder="https://" style={{ height: 44 }} />
        </Field>
        <Field label={t("hb.banner.mobile")} hint={t("hb.banner.mobileHint")}>
          <UploadSlot banner={banner} slot="mobile" config={config} url={d.image_mobile} ratio={4 / 5} focus={d.focus.mobile} onFocus={(f) => set({ focus: { ...d.focus, mobile: f } })} onBanner={fromUpload} />
        </Field>
        <Field label={t("hb.banner.imageUrl")}>
          <Input type="url" inputMode="url" value={d.image_mobile} onChange={(e) => set({ image_mobile: e.target.value })} placeholder="https://" style={{ height: 44 }} />
        </Field>
      </Section>

      {locales.map((l) => (
        <Section key={l} title={`${t("hb.banner.text")} · ${l}${l === locales[0] ? ` (${t("hb.defaultLocale").toLowerCase()})` : ""}`}>
          <Field label={t("hb.banner.title")}>
            <Input required={l === locales[0]} maxLength={160} value={d.translations[l]?.title ?? ""} onChange={(e) => setT(l, "title", e.target.value)} style={{ height: 44 }} data-testid={`hb-title-${l}`} />
          </Field>
          <Field label={t("hb.banner.subtitle")}>
            <Textarea rows={2} maxLength={400} value={d.translations[l]?.subtitle ?? ""} onChange={(e) => setT(l, "subtitle", e.target.value)} />
          </Field>
          <div className="hb-cols-2">
            <Field label={t("hb.banner.cta")} hint={t("hb.banner.ctaHint")}>
              <Input maxLength={60} value={d.translations[l]?.cta ?? ""} onChange={(e) => setT(l, "cta", e.target.value)} style={{ height: 44 }} />
            </Field>
            <Field label={t("hb.banner.secondaryCta")} hint={t("hb.banner.secondaryCtaHint")}>
              <Input maxLength={60} value={d.translations[l]?.secondary_cta ?? ""} onChange={(e) => setT(l, "secondary_cta", e.target.value)} style={{ height: 44 }} />
            </Field>
          </div>
          <Field label={t("hb.banner.alt")}>
            <Input maxLength={300} value={d.translations[l]?.alt ?? ""} onChange={(e) => setT(l, "alt", e.target.value)} style={{ height: 44 }} />
          </Field>
        </Section>
      ))}

      <Section title={t("hb.banner.preview")} hint={t("hb.banner.previewHint")}>
        <Preview d={d} />
      </Section>

      <div className="flex justify-end border-t px-6 py-4">
        <Button type="submit" isLoading={save.isPending} style={{ minHeight: 40 }} data-testid="hb-save">{t("hb.save")}</Button>
      </div>
    </form>
  )
}
