import { ArrowUpRightOnBox } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Text, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router-dom"
import { BannerForm } from "../../../components/banner-form"
import { CreditFooter } from "../../../components/credit-footer"
import { Loading } from "../../../components/states"
import { HbStyles } from "../../../components/styles"
import { api, bannerKey, CONFIG_KEY, errorOf, KEY } from "../../../lib/api"

const VIS_COLOR = { live: "green", scheduled: "orange", hidden: "grey", expired: "red" } as const

const BannerEditor = () => {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const prompt = usePrompt()
  const { data, isLoading, isError } = useQuery({ queryKey: bannerKey(id), queryFn: () => api.get(id!), enabled: !!id })
  const { data: config } = useQuery({ queryKey: CONFIG_KEY, queryFn: api.config, staleTime: Infinity })
  const remove = useMutation({
    mutationFn: () => api.delete(id!),
    onSuccess: () => {
      toast.success(t("hb.banner.deleted"))
      qc.invalidateQueries({ queryKey: KEY })
      navigate("/hero-banners")
    },
    onError: (e) => {
      const { code } = errorOf(e)
      toast.error(t(code ? `hb.errors.${code}` : "hb.errors.unknown"))
    },
  })
  if (isLoading) return <Loading />
  if (isError || !data) return <Text size="small" className="text-ui-fg-error px-6 py-4">{t("hb.loadError")}</Text>
  const { banner } = data
  const leads = banner.urls?.[banner.default_locale]
  return (
    <div className="flex flex-col gap-y-3">
      <HbStyles />
      <Link to="/hero-banners" className="txt-compact-small text-ui-fg-subtle flex items-center gap-1" style={{ minHeight: 32 }}>← {t("hb.back")}</Link>
      <Container className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2">
              <Heading level="h1" className="truncate">{banner.name}</Heading>
              <Badge size="2xsmall" color={VIS_COLOR[banner.visibility]}>{t(`hb.${banner.visibility}`)}</Badge>
            </div>
            {leads && (
              <a href={leads} target="_blank" rel="noopener noreferrer" className="text-ui-fg-subtle hover:text-ui-fg-base flex items-center gap-1 text-xs">
                {leads} <ArrowUpRightOnBox />
              </a>
            )}
          </div>
          <Button
            variant="danger"
            size="small"
            onClick={async () => {
              const ok = await prompt({ title: t("hb.delete"), description: t("hb.banner.deleteConfirm"), confirmText: t("hb.delete"), cancelText: t("hb.cancel") })
              if (ok) remove.mutate()
            }}
            style={{ minHeight: 36 }}
          >
            {t("hb.delete")}
          </Button>
        </div>
        <BannerForm key={banner.id + banner.updated_at} banner={banner} config={config} />
      </Container>
      <CreditFooter />
    </div>
  )
}

export const handle = { breadcrumb: () => "Banners" }
export default BannerEditor
