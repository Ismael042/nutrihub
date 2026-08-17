// Tipos espelham o JSON que a API (services/api) devolve — snake_case, igual aos
// modelos Pydantic de cada router. Web e mobile importam daqui em vez de redefinir a
// mesma forma localmente em cada tela.

export type TenantId = string;

export type ProfessionalRole = "admin" | "nutritionist" | "assistant";

export interface Professional {
  id: string;
  tenant_id: TenantId;
  name: string;
  email: string;
  role?: ProfessionalRole;
}

export interface AuthResponse {
  access_token: string;
  professional: Professional;
}

export type PatientStatus = "active" | "inactive";

export interface Patient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  cpf: string | null;
  status: PatientStatus;
}

export type LocationKind = "in_person" | "video";

export interface Location {
  id: string;
  name: string;
  kind: LocationKind;
  address: string | null;
}

export type AppointmentStatus = "scheduled" | "completed" | "canceled" | "no_show";

export interface Appointment {
  id: string;
  patient_id: string;
  patient_name: string;
  location_id: string | null;
  location_name: string | null;
  scheduled_at: string;
  status: AppointmentStatus;
}

export type TransactionKind = "income" | "expense";

export interface FinancialTransaction {
  id: string;
  patient_id: string | null;
  patient_name: string | null;
  kind: TransactionKind;
  amount_cents: number;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  category: string | null;
}

export interface FinancialSummary {
  income_paid_cents: number;
  expense_paid_cents: number;
  balance_cents: number;
  pending_count: number;
  pending_cents: number;
}

export type FoodSource = "taco" | "ibge" | "usda" | "tbca" | "tucunduva" | "supplement" | "custom";

export interface Food {
  id: string;
  tenant_id: TenantId | null;
  source: FoodSource;
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface Recipe {
  id: string;
  name: string;
  instructions: string | null;
}

export interface MealItem {
  id: string;
  food_id: string;
  food_name: string;
  quantity: number;
  unit: string;
}

export interface Meal {
  id: string;
  name: string;
  sort_order: number;
  items: MealItem[];
}

export interface DietPlan {
  id: string;
  patient_id: string;
  patient_name: string;
  name: string;
  created_at: string;
}

export interface DietPlanDetail extends DietPlan {
  meals: Meal[];
}

export interface Tag {
  id: string;
  name: string;
}

export interface Goal {
  id: string;
  patient_id: string;
  patient_name: string;
  description: string;
  target_date: string | null;
  achieved: boolean;
}

export type QuestionnaireKind = "anamnesis" | "pre_consultation";

export interface QuestionnaireTemplateField {
  label: string;
  type: string;
}

export interface QuestionnaireTemplate {
  id: string;
  kind: QuestionnaireKind;
  name: string;
  fields: QuestionnaireTemplateField[];
}

export interface QuestionnaireResponse {
  id: string;
  template_id: string;
  patient_id: string;
  patient_name: string;
  answers: Record<string, string>;
  created_at: string;
}

export interface ExamItem {
  name: string;
}

export interface LabExamRequest {
  id: string;
  patient_id: string;
  patient_name: string;
  exams: ExamItem[];
  notes: string | null;
  requested_at: string;
}

export interface SubstitutionItem {
  name: string;
  portion: string;
}

export interface SubstitutionList {
  id: string;
  tenant_id: TenantId | null;
  category: string;
  name: string;
  items: SubstitutionItem[];
}

export interface Pharmacy {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
}

export type PrescriptionKind = "supplement" | "phytotherapic";

export interface PrescriptionItem {
  description: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
}

export interface Prescription {
  id: string;
  patient_id: string;
  patient_name: string;
  kind: PrescriptionKind;
  items: PrescriptionItem[];
}

export type NoteTaskKind = "task" | "note";

export interface NoteTask {
  id: string;
  kind: NoteTaskKind;
  content: string;
  done: boolean;
}

export interface AnthropometricMeasurement {
  id: string;
  patient_id: string;
  measured_at: string;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_pct: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  neck_cm: number | null;
  notes: string | null;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: ProfessionalRole;
}

export type ChatSender = "professional" | "patient";

export interface ChatMessage {
  id: string;
  sender: ChatSender;
  content: string;
  created_at: string;
}

export type RecurringFrequency = "weekly" | "monthly";

export interface RecurringCharge {
  id: string;
  patient_id: string | null;
  patient_name: string | null;
  kind: TransactionKind;
  description: string;
  amount_cents: number;
  category: string | null;
  frequency: RecurringFrequency;
  next_due_date: string;
  active: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unit_price_cents: number;
}

export type BookingRequestStatus = "pending" | "approved" | "rejected";

export interface BookingRequest {
  id: string;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string | null;
  requested_at: string;
  message: string | null;
  status: BookingRequestStatus;
}

export interface PublicProfile {
  public_slug: string | null;
  bio: string | null;
  public_booking_enabled: boolean;
  photo_url: string | null;
}

export type MealKind = "breakfast" | "lunch" | "dinner" | "snack";

export interface FoodDiaryEntry {
  id: string;
  logged_at: string;
  meal_kind: MealKind | null;
  description: string;
}
