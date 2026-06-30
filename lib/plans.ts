import { createSupabaseServer } from "./supabase-server";
import type {
  ChecklistItem,
  Expense,
  Place,
  Plan,
  PlanDocument,
  PlanPhoto,
  PlanRef,
  PlanStatus,
  PlanType,
} from "./types";

// Capa intermèdia entre la UI i Supabase.
// La UI sempre rep `Plan` amb camelCase; aquí baixem a snake_case del DB.

export type PlanQuery = {
  type?: PlanType | "all";
  status?: PlanStatus | "all";
  q?: string;
};

type PlanRow = {
  id: string;
  title: string;
  type: PlanType;
  status: PlanStatus;
  cover: string;
  cover_image_path: string | null;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_total: number | null;
  budget_currency: string | null;
  summary: string;
  body: string;
  parent_plan_id: string | null;
  created_at: string;
  updated_at: string;
};

type PlaceRow = {
  id: string;
  plan_id: string;
  name: string;
  country: string | null;
  lat: number;
  lng: number;
  notes: string | null;
  order_index: number;
  arrival_date: string | null;
  zone: string | null;
};

type ChecklistRow = {
  id: string;
  plan_id: string;
  text: string;
  done: boolean;
  due_date: string | null;
};

type ExpenseRow = {
  id: string;
  plan_id: string;
  category: string;
  description: string | null;
  amount: number;
  currency: string;
  is_estimated: boolean;
};

type DocumentRow = {
  id: string;
  plan_id: string;
  filename: string;
  mime_type: string;
  uploaded_at: string;
  size_kb: number | null;
};

type PhotoRow = {
  id: string;
  plan_id: string;
  caption: string | null;
  gradient: string | null;
  taken_at: string | null;
  storage_path: string | null;
  mime_type: string | null;
};

const PLAN_COLUMNS =
  "id,title,type,status,cover,cover_image_path,destination,start_date,end_date,budget_total,budget_currency,summary,body,parent_plan_id,created_at,updated_at";

function rowToPlanBase(
  r: PlanRow,
  coverImageUrl?: string,
): Omit<Plan, "places" | "checklist" | "expenses" | "documents" | "photos"> {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    status: r.status,
    cover: r.cover,
    coverImagePath: r.cover_image_path ?? undefined,
    coverImageUrl,
    destination: r.destination ?? undefined,
    startDate: r.start_date ?? undefined,
    endDate: r.end_date ?? undefined,
    budgetTotal: r.budget_total ?? undefined,
    budgetCurrency: r.budget_currency ?? undefined,
    summary: r.summary,
    body: r.body,
    parentPlanId: r.parent_plan_id ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToPlace(r: PlaceRow): Place {
  return {
    id: r.id,
    name: r.name,
    country: r.country ?? undefined,
    lat: r.lat,
    lng: r.lng,
    notes: r.notes ?? undefined,
    orderIndex: r.order_index,
    arrivalDate: r.arrival_date ?? undefined,
    zone: r.zone ?? undefined,
  };
}

function rowToChecklist(r: ChecklistRow): ChecklistItem {
  return {
    id: r.id,
    text: r.text,
    done: r.done,
    dueDate: r.due_date ?? undefined,
  };
}

function rowToExpense(r: ExpenseRow): Expense {
  return {
    id: r.id,
    category: r.category,
    description: r.description ?? undefined,
    amount: r.amount,
    currency: r.currency,
    isEstimated: r.is_estimated,
  };
}

function rowToDocument(r: DocumentRow): PlanDocument {
  return {
    id: r.id,
    filename: r.filename,
    mimeType: r.mime_type,
    uploadedAt: r.uploaded_at,
    sizeKb: r.size_kb ?? undefined,
  };
}

function rowToPhoto(r: PhotoRow, signedUrl?: string): PlanPhoto {
  return {
    id: r.id,
    caption: r.caption ?? undefined,
    gradient: r.gradient ?? undefined,
    takenAt: r.taken_at ?? undefined,
    storagePath: r.storage_path ?? undefined,
    mimeType: r.mime_type ?? undefined,
    imageUrl: signedUrl,
  };
}

function fail(label: string, error: { message: string }): never {
  throw new Error(`Supabase ${label}: ${error.message}`);
}

async function loadRelations(planIds: string[]): Promise<{
  places: Map<string, Place[]>;
  checklist: Map<string, ChecklistItem[]>;
  expenses: Map<string, Expense[]>;
  documents: Map<string, PlanDocument[]>;
  photos: Map<string, PlanPhoto[]>;
}> {
  if (planIds.length === 0) {
    return {
      places: new Map(),
      checklist: new Map(),
      expenses: new Map(),
      documents: new Map(),
      photos: new Map(),
    };
  }

  const supabase = await createSupabaseServer();
  const [places, checklist, expenses, documents, photos] = await Promise.all([
    supabase.from("places").select("*").in("plan_id", planIds).order("order_index"),
    supabase.from("checklist_items").select("*").in("plan_id", planIds),
    supabase.from("expenses").select("*").in("plan_id", planIds),
    supabase.from("plan_documents").select("*").in("plan_id", planIds),
    supabase.from("plan_photos").select("*").in("plan_id", planIds),
  ]);

  if (places.error) fail("places", places.error);
  if (checklist.error) fail("checklist_items", checklist.error);
  if (expenses.error) fail("expenses", expenses.error);
  if (documents.error) fail("plan_documents", documents.error);
  if (photos.error) fail("plan_photos", photos.error);

  function groupBy<R extends { plan_id: string }, T>(
    rows: R[],
    mapper: (r: R) => T,
  ): Map<string, T[]> {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const arr = m.get(r.plan_id) ?? [];
      arr.push(mapper(r));
      m.set(r.plan_id, arr);
    }
    return m;
  }

  // Signed URLs en batch per a totes les fotos amb storage_path. TTL 1h.
  // Les fotos heretades del seed (només `gradient`, sense storage_path) no es signen.
  const photoRows = photos.data as PhotoRow[];
  const paths = photoRows
    .map((p) => p.storage_path)
    .filter((p): p is string => Boolean(p));
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("plan-photos")
      .createSignedUrls(paths, 60 * 60);
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
    }
  }

  return {
    places: groupBy(places.data as PlaceRow[], rowToPlace),
    checklist: groupBy(checklist.data as ChecklistRow[], rowToChecklist),
    expenses: groupBy(expenses.data as ExpenseRow[], rowToExpense),
    documents: groupBy(documents.data as DocumentRow[], rowToDocument),
    photos: groupBy(photoRows, (r) =>
      rowToPhoto(r, r.storage_path ? urlByPath.get(r.storage_path) : undefined),
    ),
  };
}

function assemble(
  row: PlanRow,
  rel: Awaited<ReturnType<typeof loadRelations>>,
  coverImageUrl?: string,
): Plan {
  return {
    ...rowToPlanBase(row, coverImageUrl),
    places: rel.places.get(row.id) ?? [],
    checklist: rel.checklist.get(row.id) ?? [],
    expenses: rel.expenses.get(row.id) ?? [],
    documents: rel.documents.get(row.id) ?? [],
    photos: rel.photos.get(row.id) ?? [],
  };
}

/** Signa en batch les URLs de portada per a totes les rows que en tinguin. */
async function signCoverUrls(
  rows: PlanRow[],
): Promise<Map<string, string>> {
  const paths = rows
    .map((r) => r.cover_image_path)
    .filter((p): p is string => Boolean(p));
  if (paths.length === 0) return new Map();
  const supabase = await createSupabaseServer();
  const { data: signed } = await supabase.storage
    .from("plan-photos")
    .createSignedUrls(paths, 60 * 60);
  const map = new Map<string, string>();
  for (const s of signed ?? []) {
    if (s.signedUrl && s.path) map.set(s.path, s.signedUrl);
  }
  return map;
}

export async function getPlans(query: PlanQuery = {}): Promise<Plan[]> {
  const { type = "all", status = "all", q = "" } = query;
  const supabase = await createSupabaseServer();

  // Només plans top-level (els sub-plans s'accedeixen pel detall del pare).
  let req = supabase
    .from("plans")
    .select(PLAN_COLUMNS)
    .neq("status", "archived")
    .is("parent_plan_id", null)
    .order("updated_at", { ascending: false });

  if (type !== "all") req = req.eq("type", type);
  if (status !== "all") req = req.eq("status", status);

  const needle = q.trim();
  if (needle) {
    const pattern = `%${needle}%`;
    req = req.or(
      `title.ilike.${pattern},destination.ilike.${pattern},summary.ilike.${pattern}`,
    );
  }

  const { data, error } = await req;
  if (error) fail("plans (list)", error);

  const rows = (data ?? []) as PlanRow[];
  const [rel, coverUrls] = await Promise.all([
    loadRelations(rows.map((r) => r.id)),
    signCoverUrls(rows),
  ]);
  return rows.map((r) =>
    assemble(r, rel, r.cover_image_path ? coverUrls.get(r.cover_image_path) : undefined),
  );
}

export async function getArchivedPlans(): Promise<Plan[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("plans")
    .select(PLAN_COLUMNS)
    .eq("status", "archived")
    .is("parent_plan_id", null)
    .order("updated_at", { ascending: false });
  if (error) fail("plans (archived)", error);

  const rows = (data ?? []) as PlanRow[];
  const [rel, coverUrls] = await Promise.all([
    loadRelations(rows.map((r) => r.id)),
    signCoverUrls(rows),
  ]);
  return rows.map((r) =>
    assemble(r, rel, r.cover_image_path ? coverUrls.get(r.cover_image_path) : undefined),
  );
}

export async function getPlanById(id: string): Promise<Plan | undefined> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("plans")
    .select(PLAN_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) fail(`plans (id=${id})`, error);
  if (!data) return undefined;

  const row = data as PlanRow;
  const [rel, coverUrls] = await Promise.all([
    loadRelations([row.id]),
    signCoverUrls([row]),
  ]);
  const plan = assemble(
    row,
    rel,
    row.cover_image_path ? coverUrls.get(row.cover_image_path) : undefined,
  );

  // Carrega títol del pare per al breadcrumb (només si en té).
  if (row.parent_plan_id) {
    const { data: parentRow } = await supabase
      .from("plans")
      .select("id,title")
      .eq("id", row.parent_plan_id)
      .maybeSingle();
    if (parentRow) {
      plan.parent = { id: parentRow.id as string, title: parentRow.title as string };
    }
  }

  return plan;
}

/** Llista resumida dels sub-plans d'un pare (per a la card de sub-plans i el timeline). */
export async function getChildPlanRefs(
  parentId: string,
): Promise<
  Array<
    PlanRef & {
      type: PlanType;
      status: PlanStatus;
      destination?: string;
      startDate?: string;
      endDate?: string;
    }
  >
> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("plans")
    .select("id,title,type,status,destination,start_date,end_date")
    .eq("parent_plan_id", parentId)
    .order("start_date", { ascending: true, nullsFirst: false });
  if (error) fail(`plans (children of ${parentId})`, error);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    type: r.type as PlanType,
    status: r.status as PlanStatus,
    destination: (r.destination as string | null) ?? undefined,
    startDate: (r.start_date as string | null) ?? undefined,
    endDate: (r.end_date as string | null) ?? undefined,
  }));
}

/**
 * Carrega tots els fills d'un pare amb el seu contingut sencer (body, places,
 * checklist, expenses, photos). Útil per a exports que han d'incloure el
 * detall complet de cada sub-plan, no només el ref. Ordenat per start_date
 * (els fills sense data van al final).
 */
export async function getChildPlans(parentId: string): Promise<Plan[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("plans")
    .select(PLAN_COLUMNS)
    .eq("parent_plan_id", parentId)
    .order("start_date", { ascending: true, nullsFirst: false });
  if (error) fail(`plans (full children of ${parentId})`, error);

  const rows = (data ?? []) as PlanRow[];
  const [rel, coverUrls] = await Promise.all([
    loadRelations(rows.map((r) => r.id)),
    signCoverUrls(rows),
  ]);
  return rows.map((r) =>
    assemble(r, rel, r.cover_image_path ? coverUrls.get(r.cover_image_path) : undefined),
  );
}

export async function getAllPlanIds(): Promise<string[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.from("plans").select("id");
  if (error) fail("plans (ids)", error);
  return (data ?? []).map((r) => r.id as string);
}

export async function countActivePlans(): Promise<number> {
  const supabase = await createSupabaseServer();
  // Només top-level: els sub-plans no apareixen al home, així que el comptador
  // tampoc no els ha de contar (sinó el text "X plans oberts" no quadra amb la grid).
  const { count, error } = await supabase
    .from("plans")
    .select("id", { count: "exact", head: true })
    .neq("status", "archived")
    .is("parent_plan_id", null);
  if (error) fail("plans (count)", error);
  return count ?? 0;
}

/**
 * Plans que "passen ara mateix": status='active' explícit OR avui dins
 * de [start_date, end_date]. Top-level només. Exclou completed i archived.
 *
 * El featured de la home en pot agafar un si la llista té exactament 1.
 */
export async function getPlansHappeningNow(): Promise<Plan[]> {
  const supabase = await createSupabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("plans")
    .select(PLAN_COLUMNS)
    .is("parent_plan_id", null)
    .not("status", "in", "(archived,completed)")
    .or(
      `status.eq.active,and(start_date.lte.${today},end_date.gte.${today})`,
    )
    .order("updated_at", { ascending: false });
  if (error) fail("plans (happening now)", error);

  const rows = (data ?? []) as PlanRow[];
  const [rel, coverUrls] = await Promise.all([
    loadRelations(rows.map((r) => r.id)),
    signCoverUrls(rows),
  ]);
  return rows.map((r) =>
    assemble(r, rel, r.cover_image_path ? coverUrls.get(r.cover_image_path) : undefined),
  );
}
