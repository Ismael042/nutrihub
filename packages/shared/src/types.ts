export type TenantId = string;

export interface Patient {
  id: string;
  tenantId: TenantId;
  name: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  status: "active" | "inactive";
  tags: string[];
}

export interface Appointment {
  id: string;
  tenantId: TenantId;
  patientId: string;
  locationId: string | null;
  scheduledAt: string;
  status: "scheduled" | "completed" | "canceled" | "no_show";
}

export interface DietPlan {
  id: string;
  tenantId: TenantId;
  patientId: string;
  name: string;
  createdAt: string;
  meals: Meal[];
}

export interface Meal {
  id: string;
  name: string;
  order: number;
  items: MealItem[];
}

export interface MealItem {
  id: string;
  foodId: string;
  quantity: number;
  unit: string;
}

export interface Food {
  id: string;
  tenantId: TenantId | null;
  source: "taco" | "ibge" | "usda" | "tbca" | "tucunduva" | "supplement" | "custom";
  name: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}
