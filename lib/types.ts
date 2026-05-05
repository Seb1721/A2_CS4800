export type SessionUser = {
  username: string;
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
  currentMileage: number;
  lastServiceDate: string;
  lifetimeExpenses: number;
  serviceCount: number;
  imageUrl: string;
};

export type CarDetails = CarSummary & {
  serviceHistory: ServiceHistoryItem[];
};
