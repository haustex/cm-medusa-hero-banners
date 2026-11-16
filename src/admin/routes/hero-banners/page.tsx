import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Photo } from "@medusajs/icons"
import { Button, Container, Heading, Input, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { BannerList } from "../../components/banner-list"
import { CreditFooter } from "../../components/credit-footer"
import { Field, Loading } from "../../components/states"
import { HbStyles } from "../../components/styles"
import { api, CONFIG_KEY, errorOf, KEY, listKey, splitLocales } from "../../lib/api"

const BannersPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: config } = useQuery({ queryKey: CONFIG_KEY, queryFn: api.config, staleTime: Infinity })
  const placements = config?.placements ?? []
  const [placement, setPlacement] = useState<string | undefined>(undefined)
  const current = placement ?? placements[0]
  const { data, isLoading, isError } = useQuery({ queryKey: listKey(current), queryFn: () => api.list(current), enabled: !!config })
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [locales, setLocales] = useState("")
  const create = useMutation({
    mutationFn: () => {
      const l = splitLocales(locales || (config?.locales ?? ["en"]).join(","))
      return api.create({ name, placement: current, locales: l, translations: { [l[0] ?? "en"]: { title: name } } })
    },
    onSuccess: (r) => {
      toast.success(t("hb.banner.created"))
      qc.invalidateQueries({ queryKey: KEY })
      navigate(`/hero-banners/${r.banner.id}`)
    },
    onError: (e) => {
      const { code } = errorOf(e)
      toast.error(t(code ? `hb.errors.${code}` : "hb.errors.unknown"))
    },
  })
  const banners = data?.banners ?? []
  return (
    <div className="flex flex-col gap-y-3">
      <HbStyles />
      <Container className="divide-y p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex flex-col">
            <Heading level="h1">{t("hb.title")}</Heading>
            <Text size="small" className="text-ui-fg-subtle">{t("hb.description")}</Text>
          </div>
          <div className="flex items-center gap-2">
            {placements.length > 1 && (
              <div className="hb-seg" role="tablist" aria-label={t("hb.placement")}>
                {placements.map((p) => (
                  <button key={p} type="button" role="tab" aria-pressed={p === current} aria-selected={p === current} onClick={() => setPlacement(p)}>{p}</button>
                ))}
              </div>
            )}
            <Button onClick={() => { setCreating(true); if (!locales) setLocales((config?.locales ?? ["en"]).join(", ")) }} style={{ minHeight: 40 }} data-testid="hb-new">{t("hb.newBanner")}</Button>
          </div>
        </div>
        {creating && (
          <form
            className="flex flex-col gap-3 px-6 py-4"
            onSubmit={(e) => {
              e.preventDefault()
              create.mutate()
            }}
          >
            <div className="hb-cols-2">
              <Field label={t("hb.banner.name")} hint={t("hb.banner.nameHint")}>
                <Input required autoFocus maxLength={120} value={name} onChange={(e) => setName(e.target.value)} style={{ height: 44 }} data-testid="hb-new-name" />
              </Field>
              <Field label={t("hb.banner.locales")} hint={t("hb.banner.localesHint")}>
                <Input required value={locales} autoCapitalize="none" spellCheck={false} onChange={(e) => setLocales(e.target.value)} style={{ height: 44 }} />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button type="submit" isLoading={create.isPending} style={{ minHeight: 40 }}>{t("hb.add")}</Button>
              <Button type="button" variant="secondary" onClick={() => setCreating(false)} style={{ minHeight: 40 }}>{t("hb.cancel")}</Button>
            </div>
          </form>
        )}
        {isLoading || !config ? <Loading /> : isError ? <Text size="small" className="text-ui-fg-error px-6 py-4">{t("hb.loadError")}</Text> : <BannerList banners={banners} placement={current} />}
      </Container>
      <CreditFooter />
    </div>
  )
}

export const config = defineRouteConfig({ label: "Banners", icon: Photo })
export const handle = { breadcrumb: () => "Banners" }
export default BannersPage
