import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { DotsSix, PencilSquare, Trash } from "@medusajs/icons"
import { Badge, IconButton, Switch, Text, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { api, errorOf, KEY, type AdminBanner } from "../lib/api"

const VIS_COLOR: Record<AdminBanner["visibility"], "green" | "orange" | "grey" | "red"> = { live: "green", scheduled: "orange", hidden: "grey", expired: "red" }

export const bannerTitle = (b: AdminBanner, fallback: string) => b.translations[b.default_locale]?.title || Object.values(b.translations).find((x) => x.title)?.title || fallback

function Row({ b, onToggle, onDelete }: { b: AdminBanner; onToggle: (v: boolean) => void; onDelete: () => void }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: b.id })
  const image = b.image.desktop ?? b.image.mobile
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }} className="hb-row bg-ui-bg-base px-3 py-2" data-testid="hb-row">
      <button ref={setActivatorNodeRef} type="button" className="hb-drag flex items-center justify-center" aria-label={t("hb.dragHint")} title={t("hb.dragHint")} style={{ minHeight: 44 }} {...attributes} {...listeners}>
        <DotsSix />
      </button>
      <Link to={`/hero-banners/${b.id}`} className={`hb-thumb ${image ? "" : "hb-thumb-text"}`} aria-hidden="true" tabIndex={-1}>
        {image ? <img src={image} alt="" style={{ objectPosition: `${b.focus.desktop?.x ?? 50}% ${b.focus.desktop?.y ?? 50}%` }} /> : <span>{t("hb.textOnly")}</span>}
      </Link>
      <Link to={`/hero-banners/${b.id}`} className="flex min-w-0 flex-col hover:underline underline-offset-4">
        <Text size="small" weight="plus" className="truncate">{b.name}</Text>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <Text size="xsmall" className="text-ui-fg-muted truncate">{bannerTitle(b, t("hb.untitled"))}</Text>
          {b.visibility !== "live" && <Badge size="2xsmall" color={VIS_COLOR[b.visibility]}>{t(`hb.${b.visibility}`)}</Badge>}
          {b.href && <Text size="xsmall" className="text-ui-fg-muted truncate">{b.href}</Text>}
        </div>
      </Link>
      <div className="flex items-center gap-1">
        <Switch checked={b.enabled} onCheckedChange={onToggle} aria-label={t("hb.banner.enabled")} />
        <Link to={`/hero-banners/${b.id}`} aria-label={t("hb.edit")} title={t("hb.edit")}>
          <IconButton variant="transparent" size="small" asChild><span><PencilSquare /></span></IconButton>
        </Link>
        <IconButton variant="transparent" size="small" onClick={onDelete} aria-label={t("hb.delete")} title={t("hb.delete")}><Trash /></IconButton>
      </div>
    </li>
  )
}

/** The banners of one placement, sortable by drag (pointer or keyboard), with the on/off switch */
export function BannerList({ banners, placement }: { banners: AdminBanner[]; placement: string }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const prompt = usePrompt()
  const [order, setOrder] = useState(banners.map((b) => b.id))
  useEffect(() => setOrder(banners.map((b) => b.id)), [banners])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const refresh = () => qc.invalidateQueries({ queryKey: KEY })
  const fail = (e: unknown) => {
    const { code } = errorOf(e)
    toast.error(t(code ? `hb.errors.${code}` : "hb.errors.unknown"))
  }
  const reorder = useMutation({ mutationFn: (ids: string[]) => api.reorder(ids, placement), onSuccess: refresh, onError: (e) => { fail(e); refresh() } })
  const toggle = useMutation({ mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.update(id, { enabled }), onSuccess: refresh, onError: fail })
  const remove = useMutation({ mutationFn: (id: string) => api.delete(id), onSuccess: () => { toast.success(t("hb.banner.deleted")); refresh() }, onError: fail })
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)))
    setOrder(next)
    reorder.mutate(next)
  }
  const byId = new Map(banners.map((b) => [b.id, b]))
  const rows = order.map((id) => byId.get(id)).filter((x): x is AdminBanner => !!x)
  if (!rows.length) return <Text size="small" className="text-ui-fg-subtle px-6 py-6">{t("hb.empty")}</Text>
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col divide-y" data-testid="hb-list">
          {rows.map((b) => (
            <Row
              key={b.id}
              b={b}
              onToggle={(v) => toggle.mutate({ id: b.id, enabled: v })}
              onDelete={async () => {
                const ok = await prompt({ title: t("hb.delete"), description: t("hb.banner.deleteConfirm"), confirmText: t("hb.delete"), cancelText: t("hb.cancel") })
                if (ok) remove.mutate(b.id)
              }}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
