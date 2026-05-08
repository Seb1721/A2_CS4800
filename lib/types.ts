export type SessionUser = {
  username: string;
};

export type UserProfile = {
  createdAt: string;
  displayName: string;
  email: string | null;
  id: string;
  username: string;
};

export type MileageHistoryItem = {
  canDelete: boolean;
  canEdit: boolean;
  entryId: number;
  date: string;
  linkedServiceId?: number;
  mileage: number;
  source: string;
  notes: string;
  updated: string;
};

export type TrendPoint = {
  label: string;
  value: number;
};

export type CategoryExpenseItem = {
  category: string;
  count: number;
  totalCost: number;
};

export type ServiceReminderRule = {
  intervalDays: number;
  intervalMiles: number;
  serviceType: string;
};

export type MaintenanceAppointment = {
  appointmentId: number;
  date: string;
  notes: string;
  serviceType: string;
};

export type CategoryReminderItem = ServiceReminderRule & {
  daysUntilDue: number | null;
  isOverdue: boolean;
  latestServiceDate: string | null;
  latestServiceMileage: number | null;
  milesUntilDue: number | null;
  needsAttention: boolean;
  nextServiceMileage: number | null;
  reason: string | null;
};

export type ServiceHistoryItem = {
  serviceId: number;
  date: string;
  mileage: number;
  serviceType: string;
  description: string;
  notes: string;
  cost: number | null;
};

export type CarSummary = {
  carId: number;
  carName: string;
  createdAt: string;
  currentMileage: number;
  lastServiceDate: string;
  lifetimeExpenses: number;
  make: string;
  model: string;
  serviceCount: number;
  year: number;
  imageUrl: string;
};

export type CarDetails = CarSummary & {
  averageServiceCost: number | null;
  attentionReason: string | null;
  categoryReminders: CategoryReminderItem[];
  daysUntilService: number | null;
  expenseTrend: TrendPoint[];
  expensesByCategory: CategoryExpenseItem[];
  daysSinceLastService: number | null;
  mileageTrend: TrendPoint[];
  milesSinceLastService: number | null;
  milesUntilService: number | null;
  mileageHistory: MileageHistoryItem[];
  needsAttention: boolean;
  nextServiceMileage: number | null;
  serviceReminderRules: ServiceReminderRule[];
  maintenanceAppointments: MaintenanceAppointment[];
  serviceIntervalDays: number;
  serviceIntervalMiles: number;
  serviceHistory: ServiceHistoryItem[];
};

export type DashboardOverview = {
  averageMileage: number | null;
  averageServiceCost: number | null;
  dueSoonCount: number;
  flaggedVehicleCount: number;
  onScheduleCount: number;
  overdueCount: number;
  totalExpenses: number;
  totalServiceRecords: number;
  totalVehicles: number;
};

export type DashboardRecentService = {
  carId: number;
  carName: string;
  cost: number | null;
  date: string;
  mileage: number;
  serviceId: number;
  serviceType: string;
};

export type FleetInsightRecord = {
  carId: number;
  carName: string;
  createdAt: string;
  currentMileage: number;
  mileageHistory: MileageHistoryItem[];
  serviceHistory: ServiceHistoryItem[];
};

export type AttentionItem = {
  carId: number;
  carName: string;
  currentMileage: number;
  daysUntilDue: number | null;
  lastServiceDate: string;
  milesUntilDue: number | null;
  reason: string;
  serviceType: string;
  status: "due-soon" | "overdue";
  type: "appointment" | "reminder";
};
