"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ListTodo, MapPin, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoverEditor } from "@/components/plan-detail/cover-editor";
import { DayPlanTemplates } from "@/components/plan-detail/day-plan-templates";
import type { DayPlanParts } from "@/components/plan-detail/day-plan-templates";
import { InlineImageInserter } from "@/components/plan-detail/inline-image-inserter";
import { PolishWithAi } from "@/components/plan-detail/polish-with-ai";
import { createPlan, updatePlan } from "@/lib/plan-actions";
import type { PlanDraft, SuggestedPlace } from "@/lib/ai-actions";
import type { Plan, PlanStatus, PlanType } from "@/lib/types";

const TYPE_OPTIONS: { value: PlanType; label: string }[] = [
  { value: "deep", label: "viatge llarg" },
  { value: "weekend", label: "escapada" },
  { value: "day", label: "dia" },
];

const STATUS_OPTIONS: { value: PlanStatus; label: string }[] = [
  { value: "planning", label: "planificant" },
  { value: "active", label: "en curs" },
  { value: "completed", label: "viscut" },
  { value: "archived", label: "arxivat" },
];

const COVER_PRESETS = [
  "linear-gradient(135deg, #F4A26E 0%, #E27A45 45%, #6B97A8 100%)",
  "linear-gradient(135deg, #8FB4C2 0%, #B8CFD8 45%, #F8C8A0 100%)",
  "linear-gradient(135deg, #F4A26E 0%, #F8C8A0 60%, #C9DCC4 100%)",
  "linear-gradient(160deg, #B8CFD8 0%, #6B97A8 50%, #3A2E2A 100%)",
  "linear-gradient(135deg, #A8C4A2 0%, #F8C8A0 50%, #F4A26E 100%)",
  "linear-gradient(135deg, #F8C8A0 0%, #F4A26E 40%, #C9DCC4 100%)",
];

const FIELD =
  "w-full h-11 px-3 rounded-md border border-ink-faint/60 bg-cream-soft text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-peach/40 focus:border-peach/40";
const TEXTAREA =
  "w-full px-3 py-2 rounded-md border border-ink-faint/60 bg-cream-soft text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-peach/40 focus:border-peach/40";
const LABEL = "text-sm font-medium text-ink-soft";

export function PlanForm({
  plan,
  parent,
}: {
  plan?: Plan;
  parent?: { id: string; title: string };
}) {
  const isEdit = Boolean(plan);
  // Si crees un sub-plan, el parent ve per query; si edites, el plan ja en porta.
  const parentPlanId = plan?.parentPlanId ?? parent?.id ?? "";
  const parentTitle = parent?.title;
  const [cover, setCover] = useState<string>(plan?.cover ?? COVER_PRESETS[0]);
  const [type, setType] = useState<PlanType>(plan?.type ?? "weekend");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Suggeriments acceptats per la IA al mode `new` que quedaran pendents fins
  // que l'usuari cliqui "Crear plan". Cada `apply` del Polish s'afegeix als
  // arrays existents (no els reemplaça).
  const [pendingPlaces, setPendingPlaces] = useState<SuggestedPlace[]>([]);
  const [pendingChecklist, setPendingChecklist] = useState<string[]>([]);

  const titleRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const destinationRef = useRef<HTMLInputElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  function applyDayTemplate(parts: DayPlanParts) {
    if (titleRef.current && titleRef.current.value.trim() === "") {
      titleRef.current.value = parts.title;
    }
    if (summaryRef.current && summaryRef.current.value.trim() === "") {
      summaryRef.current.value = parts.summary;
    }
    if (bodyRef.current) {
      bodyRef.current.value = parts.body;
    }
  }

  // Build the draft snapshot from current form values for Polish IA (mode `new`).
  function getDraft(): PlanDraft {
    return {
      title: titleRef.current?.value.trim() ?? "",
      type,
      destination: destinationRef.current?.value.trim() || undefined,
      startDate: startDateRef.current?.value || undefined,
      endDate: endDateRef.current?.value || undefined,
      summary: summaryRef.current?.value.trim() ?? "",
      body: bodyRef.current?.value.trim() ?? "",
    };
  }

  function onPolishAccepted({
    places,
    checklistTexts,
  }: {
    places: SuggestedPlace[];
    checklistTexts: string[];
  }) {
    if (places.length > 0) setPendingPlaces((prev) => [...prev, ...places]);
    if (checklistTexts.length > 0)
      setPendingChecklist((prev) => [...prev, ...checklistTexts]);
  }

  function clearPending() {
    setPendingPlaces([]);
    setPendingChecklist([]);
  }

  async function action(formData: FormData) {
    setError(null);
    setSubmitting(true);
    try {
      if (isEdit && plan) {
        await updatePlan(plan.id, formData);
      } else {
        await createPlan(formData);
      }
    } catch (e) {
      // Els redirects de Next.js es propaguen com a errors especials —
      // si NEXT_REDIRECT, no és un error real, deixem que el framework el gestioni.
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("NEXT_REDIRECT")) throw e;
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const hasPending = pendingPlaces.length > 0 || pendingChecklist.length > 0;

  return (
    <form action={action} className="space-y-8 max-w-3xl">
      {error && (
        <div className="rounded-md border border-peach-deep/40 bg-peach-soft/40 px-4 py-3 text-sm text-ink">
          {error}
        </div>
      )}

      {parentPlanId && <input type="hidden" name="parentPlanId" value={parentPlanId} />}

      {parentTitle && !isEdit && (
        <div className="rounded-md border border-sage-deep/30 bg-sage-soft/30 px-4 py-3 text-sm text-ink-soft">
          Sub-plan de{" "}
          <span className="font-medium text-ink">{parentTitle}</span>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="title" className={LABEL}>Títol</label>
        <input
          ref={titleRef}
          id="title"
          name="title"
          type="text"
          required
          defaultValue={plan?.title ?? ""}
          placeholder="Sis mesos per Àsia, escapada a Roma..."
          className={FIELD}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="type" className={LABEL}>Tipus</label>
          <select
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as PlanType)}
            className={FIELD}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="status" className={LABEL}>Estat</label>
          <select id="status" name="status" defaultValue={plan?.status ?? "planning"} className={FIELD}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="destination" className={LABEL}>Destinació</label>
        <input
          ref={destinationRef}
          id="destination"
          name="destination"
          type="text"
          defaultValue={plan?.destination ?? ""}
          placeholder="Barcelona, Sud-est asiàtic..."
          className={FIELD}
        />
      </div>

      {type === "day" ? (
        <div className="space-y-2">
          <label htmlFor="startDate" className={LABEL}>Data</label>
          <input
            ref={startDateRef}
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={plan?.startDate ?? ""}
            className={FIELD}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="startDate" className={LABEL}>Data inici</label>
            <input
              ref={startDateRef}
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={plan?.startDate ?? ""}
              className={FIELD}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="endDate" className={LABEL}>Data fi</label>
            <input
              ref={endDateRef}
              id="endDate"
              name="endDate"
              type="date"
              defaultValue={plan?.endDate ?? ""}
              className={FIELD}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-4">
        <div className="space-y-2">
          <label htmlFor="budgetTotal" className={LABEL}>Pressupost</label>
          <input
            id="budgetTotal"
            name="budgetTotal"
            type="number"
            min={0}
            step={1}
            defaultValue={plan?.budgetTotal ?? ""}
            placeholder="0"
            className={FIELD}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="budgetCurrency" className={LABEL}>Moneda</label>
          <select
            id="budgetCurrency"
            name="budgetCurrency"
            defaultValue={plan?.budgetCurrency ?? "EUR"}
            className={FIELD}
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
            <option value="JPY">JPY</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="summary" className={LABEL}>Resum (1-2 frases per la targeta)</label>
        <textarea
          ref={summaryRef}
          id="summary"
          name="summary"
          required
          rows={3}
          defaultValue={plan?.summary ?? ""}
          placeholder="Auroras boreals, banys termals i una furgo amb llit per perdre'ns una setmana..."
          className={TEXTAREA}
        />
      </div>

      {type === "day" && <DayPlanTemplates onApply={applyDayTemplate} />}

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <label htmlFor="body" className={LABEL}>Cos del plan (Markdown)</label>
          {isEdit && plan && <InlineImageInserter planId={plan.id} />}
        </div>
        <textarea
          ref={bodyRef}
          id="body"
          name="body"
          required
          rows={14}
          defaultValue={plan?.body ?? ""}
          placeholder={"## La idea\n\nQuè volem fer i per què...\n\n## Pendents\n\n- Cosa 1\n- Cosa 2"}
          className={`${TEXTAREA} font-mono text-sm`}
        />
      </div>

      {/* Polish IA al crear: dins del form perquè els pendents es serialitzin com a hidden inputs. */}
      {!isEdit && (
        <div className="space-y-4">
          <PolishWithAi
            mode="new"
            getDraft={getDraft}
            onDraftAccepted={onPolishAccepted}
          />

          {hasPending && (
            <div className="rounded-md border border-sage-deep/30 bg-sage-soft/25 p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-sage-deep" strokeWidth={2} />
                  Pendents per al moment de crear
                </p>
                <button
                  type="button"
                  onClick={clearPending}
                  className="text-xs text-ink-soft hover:text-peach-deep inline-flex items-center gap-1"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                  Esborrar pendents
                </button>
              </div>
              <ul className="text-xs text-ink-soft space-y-0.5 ml-1">
                {pendingPlaces.length > 0 && (
                  <li className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                    {pendingPlaces.length}{" "}
                    {pendingPlaces.length === 1 ? "lloc" : "llocs"} per geocodificar
                  </li>
                )}
                {pendingChecklist.length > 0 && (
                  <li className="flex items-center gap-1.5">
                    <ListTodo className="h-3.5 w-3.5" strokeWidth={2} />
                    {pendingChecklist.length}{" "}
                    {pendingChecklist.length === 1 ? "item" : "items"} de checklist
                  </li>
                )}
              </ul>
              {pendingPlaces.length > 0 && (
                <p className="text-[11px] text-ink-soft italic leading-snug">
                  Crear amb llocs pot trigar ~{Math.ceil(pendingPlaces.length * 1.2)}s
                  perquè cada lloc es geocodifica via OpenStreetMap.
                </p>
              )}
            </div>
          )}

          {/* Hidden inputs serialitzats per al server action. */}
          <input
            type="hidden"
            name="pendingPlacesJson"
            value={JSON.stringify(pendingPlaces)}
          />
          <input
            type="hidden"
            name="pendingChecklistJson"
            value={JSON.stringify(pendingChecklist)}
          />
        </div>
      )}

      <div className="space-y-4">
        <label className={LABEL}>Portada</label>

        {isEdit && plan && (
          <CoverEditor
            planId={plan.id}
            fallbackGradient={cover}
            initialImageUrl={plan.coverImageUrl}
            initialImagePath={plan.coverImagePath}
          />
        )}

        {!isEdit && (
          <div
            className="rounded-md h-32 border border-ink-faint/40"
            style={{ background: cover }}
          />
        )}

        <div className="space-y-2">
          <p className="text-xs text-ink-soft">
            {isEdit
              ? "Degradat (fallback quan no hi ha imatge):"
              : "Tria un degradat — l'imatge la podràs pujar després."}
          </p>
          <div className="flex flex-wrap gap-2">
            {COVER_PRESETS.map((g, i) => (
              <button
                type="button"
                key={i}
                onClick={() => setCover(g)}
                className={`h-8 w-12 rounded-md border-2 transition ${
                  cover === g ? "border-ink ring-2 ring-peach/40" : "border-ink-faint/40"
                }`}
                style={{ background: g }}
                aria-label={`Degradat ${i + 1}`}
              />
            ))}
          </div>
          <input
            name="cover"
            type="text"
            value={cover}
            onChange={(e) => setCover(e.target.value)}
            className={`${FIELD} font-mono text-xs`}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-ink-faint/30">
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting
            ? isEdit
              ? "Desant…"
              : hasPending
              ? "Creant i aplicant suggeriments…"
              : "Creant…"
            : isEdit
            ? "Desar canvis"
            : "Crear plan"}
        </Button>
        <Link
          href={isEdit && plan ? `/plans/${plan.id}` : "/"}
          className="text-sm text-ink-soft hover:text-ink"
        >
          Cancel·lar
        </Link>
      </div>
    </form>
  );
}
