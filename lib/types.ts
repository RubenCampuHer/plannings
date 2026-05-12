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
};

export type Plan = {
  id: string;
  title: string;
  type: PlanType;
  status: PlanStatus;
  /** CSS gradient string used as the cover background */
  cover: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  budgetTotal?: number;
  budgetCurrency?: string;
  summary: string;
  body: string;
  places: Place[];
  checklist: ChecklistItem[];
  expenses: Expense[];
  documents: PlanDocument[];
  photos: PlanPhoto[];
  createdAt: string;
  updatedAt: string;
};
