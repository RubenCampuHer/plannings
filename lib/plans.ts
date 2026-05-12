import { createSupabaseServer } from "./supabase-server";
import type {
  ChecklistItem,
  Expense,
  Place,
  Plan,
  PlanDocument,
  PlanPhoto,
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
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_total: number | null;
  budget_currency: string | null;
  summary: string;
  body: string;
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
};

const PLAN_COLUMNS =
  "id,title,type,status,cover,destination,start_date,end_date,budget_total,budget_currency,summary,body,created_at,updated_at";

function rowToPlanBase(r: PlanRow): Omit<Plan, "places" | "checklist" | "expenses" | "documents" | "photos"> {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    status: r.status,
    cover: r.cover,
    destination: r.destination ?? undefined,
    startDate: r.start_date ?? undefined,
    endDate: r.end_date ?? undefined,
    budgetTotal: r.budget_total ?? undefined,
    budgetCurrency: r.budget_currency ?? undefined,
    summary: r.summary,
    body: r.body,
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

function rowToPhoto(r: PhotoRow): PlanPhoto {
  return {
    id: r.id,
    caption: r.caption ?? undefined,
    gradient: r.gradient ?? undefined,
    takenAt: r.taken_at ?? undefined,
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

  return {
    places: groupBy(places.data as PlaceRow[], rowToPlace),
    checklist: groupBy(checklist.data as ChecklistRow[], rowToChecklist),
    expenses: groupBy(expenses.data as ExpenseRow[], rowToExpense),
    documents: groupBy(documents.data as DocumentRow[], rowToDocument),
    photos: groupBy(photos.data as PhotoRow[], rowToPhoto),
  };
}

function assemble(
  row: PlanRow,
  rel: Awaited<ReturnType<typeof loadRelations>>,
): Plan {
  return {
    ...rowToPlanBase(row),
    places: rel.places.get(row.id) ?? [],
    checklist: rel.checklist.get(row.id) ?? [],
    expenses: rel.expenses.get(row.id) ?? [],
    documents: rel.documents.get(row.id) ?? [],
    photos: rel.photos.get(row.id) ?? [],
  };
}

export async function getPlans(query: PlanQuery = {}): Promise<Plan[]> {
  const { type = "all", status = "all", q = "" } = query;
  const supabase = await createSupabaseServer();

  let req = supabase
    .from("plans")
    .select(PLAN_COLUMNS)
    .neq("status", "archived")
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
  const rel = await loadRelations(rows.map((r) => r.id));
  return rows.map((r) => assemble(r, rel));
}

export async function getArchivedPlans(): Promise<Plan[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("plans")
    .select(PLAN_COLUMNS)
    .eq("status", "archived")
    .order("updated_at", { ascending: false });
  if (error) fail("plans (archived)", error);

  const rows = (data ?? []) as PlanRow[];
  const rel = await loadRelations(rows.map((r) => r.id));
  return rows.map((r) => assemble(r, rel));
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
  const rel = await loadRelations([row.id]);
  return assemble(row, rel);
}

export async function getAllPlanIds(): Promise<string[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.from("plans").select("id");
  if (error) fail("plans (ids)", error);
  return (data ?? []).map((r) => r.id as string);
}

export async function countActivePlans(): Promise<number> {
  const supabase = await createSupabaseServer();
  const { count, error } = await supabase
    .from("plans")
    .select("id", { count: "exact", head: true })
    .neq("status", "archived");
  if (error) fail("plans (count)", error);
  return count ?? 0;
}
