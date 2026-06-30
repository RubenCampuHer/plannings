export type PlanType = "deep" | "weekend" | "day";
export type PlanStatus = "planning" | "active" | "completed" | "archived";

export type Place = {
  id: string;
  name: string;
  country?: string;
  lat: number;
  lng: number;
  notes?: string;
  orderIndex: number;
  arrivalDate?: string;
  /** Zona/etapa geogràfica a què pertany el lloc (ex. "Siem Reap"). */
  zone?: string;
};

export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
  dueDate?: string;
};

export type Expense = {
  id: string;
  category: string;
  description?: string;
  amount: number;
  currency: string;
  isEstimated: boolean;
};

export type PlanDocument = {
  id: string;
  filename: string;
  mimeType: string;
  uploadedAt: string;
  sizeKb?: number;
};

export type PlanPhoto = {
  id: string;
  caption?: string;
  /** CSS gradient string used as placeholder when no image is uploaded yet */
  gradient?: string;
  takenAt?: string;
  /** Path dins del bucket `plan-photos`, si hi ha imatge real. */
  storagePath?: string;
  mimeType?: string;
  /** Signed URL recent, generada al servidor a render time (1h TTL). */
  imageUrl?: string;
};

/** Resum d'un plan pare, usat per al breadcrumb dels fills sense carregar tot. */
export type PlanRef = {
  id: string;
  title: string;
};

/** Membre d'un pla (qui hi té accés). */
export type PlanMember = {
  userId: string;
  email: string;
  isOwner: boolean;
  joinedAt: string;
};

/** Invitation a un pla pendent d'acceptar. */
export type PlanInvitation = {
  id: string;
  email: string;
  token: string;
  expiresAt: string;
  createdAt: string;
};

export type Plan = {
  id: string;
  title: string;
  type: PlanType;
  status: PlanStatus;
  /** CSS gradient string used as the cover background — fallback quan no hi ha imatge. */
  cover: string;
  /** Path al bucket `plan-photos` de la imatge de portada, si l'usuari n'ha pujat una. */
  coverImagePath?: string;
  /** Signed URL recent de la imatge de portada (1h TTL). */
  coverImageUrl?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  budgetTotal?: number;
  budgetCurrency?: string;
  summary: string;
  body: string;
  /** Si està definit, aquest plan és un sub-plan d'un altre. */
  parentPlanId?: string;
  /** Resum del pare per al breadcrumb. Només es carrega al getPlanById. */
  parent?: PlanRef;
  places: Place[];
  checklist: ChecklistItem[];
  expenses: Expense[];
  documents: PlanDocument[];
  photos: PlanPhoto[];
  createdAt: string;
  updatedAt: string;
};
