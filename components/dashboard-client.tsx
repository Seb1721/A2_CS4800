"use client";

import Link from "next/link";
import { ReactNode, SyntheticEvent, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { trackEvent } from "@/lib/analytics";
import {
  buildExpenseByCategory,
  calculateAverageMonthlyExpense,
  calculateAverageMonthlyServiceFrequency,
  filterServiceHistoryByTrend,
  getFleetHighlights
} from "@/lib/car-insights";
import { COMMON_SERVICE_TYPES } from "@/lib/service-types";
import type {
  AttentionItem,
  CarDetails,
  CategoryReminderItem,
  CarSummary,
  CategoryExpenseItem,
  DashboardOverview,
  DashboardRecentService,
  FleetInsightRecord,
  MaintenanceAppointment,
  MileageHistoryItem,
  ServiceReminderRule,
  ServiceHistoryItem,
  TrendPoint,
  UserProfile
} from "@/lib/types";

type DashboardView =
  | "dashboard"
  | "garage"
  | "new-vehicle"
  | "vehicle"
  | "vehicle-insights"
  | "services"
  | "account";

type DashboardClientProps = {
  attentionItems: AttentionItem[];
  fleetInsightRecords?: FleetInsightRecord[];
  initialCars: CarSummary[];
  initialSelectedCar?: CarDetails | null;
  overview: DashboardOverview;
  profile: UserProfile | null;
  recentServices: DashboardRecentService[];
  serviceFeed?: DashboardRecentService[];
  username: string;
  view?: DashboardView;
};

type ReminderRuleForm = {
  intervalDays: string;
  intervalMiles: string;
  serviceType: string;
};

type MaintenanceAppointmentForm = {
  appointmentId: number;
  date: string;
  notes: string;
  serviceType: string;
};

type CarFormState = {
  imageUrl: string;
  make: string;
  mileage: string;
  model: string;
  serviceReminderRules: ReminderRuleForm[];
  maintenanceAppointments: MaintenanceAppointmentForm[];
  year: string;
};

type EditCarFormState = CarFormState & {
  allowMileageCorrection: boolean;
};

const serviceTypes: string[] = [...COMMON_SERVICE_TYPES];

const emptyCarForm: CarFormState = {
  make: "",
  model: "",
  year: "",
  mileage: "",
  imageUrl: "",
  serviceReminderRules: [],
  maintenanceAppointments: []
};

const emptyEditCarForm: EditCarFormState = {
  make: "",
  model: "",
  year: "",
  mileage: "",
  imageUrl: "",
  serviceReminderRules: [],
  maintenanceAppointments: [],
  allowMileageCorrection: false
};

const emptyServiceForm = {
  carId: "",
  serviceDate: "",
  mileage: "",
  serviceType: serviceTypes[0],
  description: "",
  notes: "",
  cost: ""
};

const emptyMileageForm = {
  carId: "",
  mileage: "",
  date: "",
  notes: "",
  allowCorrection: false
};

const emptyEditServiceForm = {
  serviceDate: "",
  mileage: "",
  serviceType: serviceTypes[0],
  description: "",
  notes: "",
  cost: ""
};

const emptyEditMileageEntryForm = {
  mileage: "",
  date: "",
  notes: "",
  allowCorrection: false
};

const emptyProfileForm = {
  displayName: "",
  email: ""
};

const FLASH_MESSAGE_KEY = "carkeeper-flash-message";

type TrendPreset = "month" | "quarter" | "year" | "ytd" | "all";

type TrendServiceRecord = {
  carName?: string;
  cost: number | null;
  date: Date;
  mileage: number;
  serviceType: string;
};

type TrendMileageRecord = {
  carId?: number;
  carName?: string;
  date: Date;
  mileage: number;
};

type ChartPoint = {
  label: string;
  value: number | null;
};

type SortDirection = "newest" | "oldest";
type PageSizeOption = 5 | 10 | 15;

const pageSizeOptions: PageSizeOption[] = [5, 10, 15];

export function DashboardClient({
  attentionItems: initialAttentionItems,
  fleetInsightRecords = [],
  initialCars,
  initialSelectedCar = null,
  overview: initialOverview,
  profile: initialProfile,
  recentServices: initialRecentServices,
  serviceFeed,
  username,
  view = "dashboard"
}: DashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const didMountRef = useRef(false);
  const [cars, setCars] = useState(initialCars);
  const [overview, setOverview] = useState(initialOverview);
  const [recentServices, setRecentServices] = useState(initialRecentServices);
  const [attentionItems, setAttentionItems] = useState(initialAttentionItems);
  const [profile, setProfile] = useState(initialProfile);
  const [selectedCar, setSelectedCar] = useState<CarDetails | null>(initialSelectedCar);
  const [carForm, setCarForm] = useState(emptyCarForm);
  const [editCarForm, setEditCarForm] = useState(emptyEditCarForm);
  const [serviceForm, setServiceForm] = useState(emptyServiceForm);
  const [mileageForm, setMileageForm] = useState(emptyMileageForm);
  const [editServiceForm, setEditServiceForm] = useState(emptyEditServiceForm);
  const [editMileageEntryForm, setEditMileageEntryForm] = useState(emptyEditMileageEntryForm);
  const [profileForm, setProfileForm] = useState({
    displayName: initialProfile?.displayName ?? "",
    email: initialProfile?.email ?? ""
  });
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
  const [editingMileageEntryId, setEditingMileageEntryId] = useState<number | null>(null);
  const [trendDateFrom, setTrendDateFrom] = useState("");
  const [trendDateTo, setTrendDateTo] = useState("");
  const [trendServiceTypeFilter, setTrendServiceTypeFilter] = useState("all");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);
  const [isDeletingVehicle, setIsDeletingVehicle] = useState(false);
  const [isSavingService, setIsSavingService] = useState(false);
  const [isSavingMileageEntry, setIsSavingMileageEntry] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [deletingServiceId, setDeletingServiceId] = useState<number | null>(null);
  const [deletingMileageEntryId, setDeletingMileageEntryId] = useState<number | null>(null);

  useEffect(() => {
    const today = todayIso();
    setServiceForm((current) => (current.serviceDate ? current : { ...current, serviceDate: today }));
    setMileageForm((current) => (current.date ? current : { ...current, date: today }));
    setEditServiceForm((current) => (current.serviceDate ? current : { ...current, serviceDate: today }));
    setEditMileageEntryForm((current) => (current.date ? current : { ...current, date: today }));
  }, []);

  useEffect(() => {
    setCars(initialCars);
  }, [initialCars]);

  useEffect(() => {
    setOverview(initialOverview);
  }, [initialOverview]);

  useEffect(() => {
    setRecentServices(initialRecentServices);
  }, [initialRecentServices]);

  useEffect(() => {
    setAttentionItems(initialAttentionItems);
  }, [initialAttentionItems]);

  useEffect(() => {
    setProfile(initialProfile);
    setProfileForm({
      displayName: initialProfile?.displayName ?? "",
      email: initialProfile?.email ?? ""
    });
  }, [initialProfile]);

  useEffect(() => {
    if (initialSelectedCar) {
      syncSelectedCar(initialSelectedCar);
      return;
    }

    setSelectedCar(null);
  }, [initialSelectedCar]);

  useEffect(() => {
    setTrendDateFrom("");
    setTrendDateTo("");
    setTrendServiceTypeFilter("all");
  }, [selectedCar?.carId]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    router.refresh();
  }, [pathname, router]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedMessage = window.sessionStorage.getItem(FLASH_MESSAGE_KEY);
    if (!storedMessage) {
      return;
    }

    window.sessionStorage.removeItem(FLASH_MESSAGE_KEY);

    try {
      const parsed = JSON.parse(storedMessage) as { text: string; type: "success" | "error" };
      setMessage(parsed);
    } catch {
      // Ignore malformed flash messages.
    }
  }, [pathname]);

  function updateCarField(
    field: keyof CarFormState,
    value: string | ReminderRuleForm[] | MaintenanceAppointmentForm[]
  ) {
    setCarForm((current) => ({ ...current, [field]: value }));
  }

  function updateEditCarField(
    field: keyof EditCarFormState,
    value: string | boolean | ReminderRuleForm[] | MaintenanceAppointmentForm[]
  ) {
    setEditCarForm((current) => ({ ...current, [field]: value }));
  }

  function updateServiceField(field: keyof typeof emptyServiceForm, value: string) {
    setServiceForm((current) => ({ ...current, [field]: value }));
  }

  function updateMileageField(field: keyof typeof emptyMileageForm, value: string | boolean) {
    setMileageForm((current) => ({ ...current, [field]: value }));
  }

  function updateEditServiceField(field: keyof typeof emptyEditServiceForm, value: string) {
    setEditServiceForm((current) => ({ ...current, [field]: value }));
  }

  function updateEditMileageEntryField(
    field: keyof typeof emptyEditMileageEntryForm,
    value: string | boolean
  ) {
    setEditMileageEntryForm((current) => ({ ...current, [field]: value }));
  }

  function updateProfileField(field: keyof typeof emptyProfileForm, value: string) {
    setProfileForm((current) => ({ ...current, [field]: value }));
  }

  function updateReminderRuleField(
    mode: "create" | "edit",
    index: number,
    field: keyof ReminderRuleForm,
    value: string
  ) {
    if (mode === "create") {
      setCarForm((current) => ({
        ...current,
        serviceReminderRules: current.serviceReminderRules.map((rule, ruleIndex) =>
          ruleIndex === index ? { ...rule, [field]: value } : rule
        )
      }));
      return;
    }

    setEditCarForm((current) => ({
      ...current,
      serviceReminderRules: current.serviceReminderRules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, [field]: value } : rule
      )
    }));
  }

  function updateAppointmentField(
    mode: "create" | "edit",
    index: number,
    field: keyof MaintenanceAppointmentForm,
    value: string
  ) {
    if (mode === "create") {
      setCarForm((current) => ({
        ...current,
        maintenanceAppointments: current.maintenanceAppointments.map((appointment, appointmentIndex) =>
          appointmentIndex === index ? { ...appointment, [field]: value } : appointment
        )
      }));
      return;
    }

    setEditCarForm((current) => ({
      ...current,
      maintenanceAppointments: current.maintenanceAppointments.map((appointment, appointmentIndex) =>
        appointmentIndex === index ? { ...appointment, [field]: value } : appointment
      )
    }));
  }

  function addAppointment(mode: "create" | "edit") {
    const appointment = createAppointmentForm();
    if (mode === "create") {
      setCarForm((current) => ({
        ...current,
        maintenanceAppointments: [...current.maintenanceAppointments, appointment]
      }));
      return;
    }

    setEditCarForm((current) => ({
      ...current,
      maintenanceAppointments: [...current.maintenanceAppointments, appointment]
    }));
  }

  function removeAppointment(mode: "create" | "edit", index: number) {
    if (mode === "create") {
      setCarForm((current) => ({
        ...current,
        maintenanceAppointments: current.maintenanceAppointments.filter((_, appointmentIndex) => appointmentIndex !== index)
      }));
      return;
    }

    setEditCarForm((current) => ({
      ...current,
      maintenanceAppointments: current.maintenanceAppointments.filter((_, appointmentIndex) => appointmentIndex !== index)
    }));
  }

  function addReminderRule(mode: "create" | "edit") {
    if (mode === "create") {
      setCarForm((current) => ({
        ...current,
        serviceReminderRules: [...current.serviceReminderRules, createReminderRuleForm(current.serviceReminderRules)]
      }));
      return;
    }

    setEditCarForm((current) => ({
      ...current,
      serviceReminderRules: [...current.serviceReminderRules, createReminderRuleForm(current.serviceReminderRules)]
    }));
  }

  function removeReminderRule(mode: "create" | "edit", index: number) {
    if (mode === "create") {
      setCarForm((current) => ({
        ...current,
        serviceReminderRules: current.serviceReminderRules.filter((_, ruleIndex) => ruleIndex !== index)
      }));
      return;
    }

    setEditCarForm((current) => ({
      ...current,
      serviceReminderRules: current.serviceReminderRules.filter((_, ruleIndex) => ruleIndex !== index)
    }));
  }

  async function refreshCars() {
    const response = await fetch("/api/cars", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Could not refresh the garage.");
    }

    const updatedCars = (await response.json()) as CarSummary[];
    setCars(updatedCars);
  }

  function syncSelectedCar(car: CarDetails | null) {
    setSelectedCar(car);
    setEditingServiceId(null);
    setEditingMileageEntryId(null);
    setEditServiceForm(emptyEditServiceForm);
    setEditMileageEntryForm(emptyEditMileageEntryForm);

    if (!car) {
      setEditCarForm(emptyEditCarForm);
      setMileageForm(emptyMileageForm);
      return;
    }

    setEditCarForm({
      allowMileageCorrection: false,
      imageUrl: car.imageUrl,
      make: car.make,
      mileage: String(car.currentMileage),
      model: car.model,
      maintenanceAppointments: car.maintenanceAppointments.map(toAppointmentForm),
      serviceReminderRules: car.serviceReminderRules.map(toReminderRuleForm),
      year: String(car.year)
    });
    setServiceForm((current) => ({
      ...current,
      carId: String(car.carId),
      mileage: String(car.currentMileage)
    }));
    setMileageForm({
      allowCorrection: false,
      carId: String(car.carId),
      date: todayIso(),
      mileage: String(car.currentMileage),
      notes: ""
    });
  }

  function startEditingService(service: ServiceHistoryItem) {
    setEditingServiceId(service.serviceId);
    setEditServiceForm({
      cost: service.cost === null ? "" : String(service.cost),
      description: service.description,
      mileage: String(service.mileage),
      notes: service.notes,
      serviceDate: formatDateForInput(service.date),
      serviceType: service.serviceType
    });
  }

  function cancelEditingService() {
    setEditingServiceId(null);
    setEditServiceForm(emptyEditServiceForm);
  }

  function startEditingMileageEntry(entry: MileageHistoryItem) {
    setEditingMileageEntryId(entry.entryId);
    setEditMileageEntryForm({
      allowCorrection: entry.source === "correction",
      date: formatDateForInput(entry.date),
      mileage: String(entry.mileage),
      notes: entry.notes
    });
  }

  function cancelEditingMileageEntry() {
    setEditingMileageEntryId(null);
    setEditMileageEntryForm(emptyEditMileageEntryForm);
  }

  async function refreshServerData() {
    router.refresh();
  }

  function openVehiclePage(carId: number) {
    router.push(`/garage/${carId}`);
  }

  function openVehicleInsightsPage(carId: number) {
    router.push(`/garage/${carId}/insights`);
  }

  function pushFlashMessage(text: string, type: "success" | "error" = "success") {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(FLASH_MESSAGE_KEY, JSON.stringify({ text, type }));
  }

  function primeServiceForm(car: Pick<CarDetails, "carId" | "currentMileage">, serviceType?: string) {
    setServiceForm({
      ...emptyServiceForm,
      carId: String(car.carId),
      mileage: String(car.currentMileage),
      serviceDate: todayIso(),
      serviceType: serviceType ?? emptyServiceForm.serviceType
    });
  }

  async function handleReminderAction(carId: number, serviceType: string) {
    try {
      const car = selectedCar?.carId === carId ? selectedCar : null;

      if (!car) {
        throw new Error("Open the vehicle record before logging a reminder service.");
      }

      primeServiceForm(car, serviceType);
      setMessage({
        type: "success",
        text: `${serviceType} has been prefilled in the service form for ${car.carName}.`
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Could not open the reminder workflow."
      });
    }
  }

  async function handleAddCar(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const response = await fetch("/api/cars", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imageUrl: carForm.imageUrl,
          make: carForm.make,
          maintenanceAppointments: serializeAppointmentForms(carForm.maintenanceAppointments),
          mileage: Number(carForm.mileage),
          model: carForm.model,
          serviceReminderRules: serializeReminderRuleForms(carForm.serviceReminderRules),
          year: Number(carForm.year)
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not add car.");
      }

      const createdCar = payload as CarDetails;
      setCarForm(emptyCarForm);
      syncSelectedCar(createdCar);
      await refreshCars();
      await refreshServerData();
      trackEvent("vehicle_created", {
        car_id: createdCar.carId,
        make: createdCar.make,
        year: createdCar.year
      });
      pushFlashMessage("Car entry successfully created.");
      router.push("/garage");
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not add car." });
    }
  }

  async function handleSaveVehicle(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedCar) {
      setMessage({ type: "error", text: "Select a vehicle before trying to update it." });
      return;
    }

    setIsSavingVehicle(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/cars/${selectedCar.carId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          allowMileageCorrection: editCarForm.allowMileageCorrection,
          imageUrl: editCarForm.imageUrl,
          make: editCarForm.make,
          maintenanceAppointments: serializeAppointmentForms(editCarForm.maintenanceAppointments),
          mileage: Number(editCarForm.mileage),
          model: editCarForm.model,
          serviceReminderRules: serializeReminderRuleForms(editCarForm.serviceReminderRules),
          year: Number(editCarForm.year)
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update vehicle.");
      }

      const updatedCar = payload as CarDetails;
      syncSelectedCar(updatedCar);
      await refreshCars();
      await refreshServerData();
      setMessage({ type: "success", text: "Vehicle details updated." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not update vehicle." });
    } finally {
      setIsSavingVehicle(false);
    }
  }

  async function handleDeleteVehicle() {
    if (!selectedCar) {
      setMessage({ type: "error", text: "Select a vehicle before deleting it." });
      return;
    }

    const shouldDelete = window.confirm(
      `Delete ${selectedCar.carName}? This also removes its service and mileage history.`
    );

    if (!shouldDelete) {
      return;
    }

    setIsDeletingVehicle(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/cars/${selectedCar.carId}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not delete vehicle.");
      }

      syncSelectedCar(null);
      await refreshCars();
      await refreshServerData();
      if (view === "vehicle" || view === "vehicle-insights") {
        router.push("/garage");
        return;
      }

      setMessage({ type: "success", text: "Vehicle deleted." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not delete vehicle." });
    } finally {
      setIsDeletingVehicle(false);
    }
  }

  async function handleUpdateMileage(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!mileageForm.carId) {
      setMessage({ type: "error", text: "Choose a vehicle before updating mileage." });
      return;
    }

    try {
      const response = await fetch(`/api/cars/${mileageForm.carId}/mileage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          allowCorrection: mileageForm.allowCorrection,
          mileage: Number(mileageForm.mileage),
          notes: mileageForm.notes
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update mileage.");
      }

      const updatedCar = payload as CarDetails;
      syncSelectedCar(updatedCar);
      setMileageForm({
        ...emptyMileageForm,
        carId: String(updatedCar.carId),
        date: todayIso(),
        mileage: String(updatedCar.currentMileage)
      });
      await refreshCars();
      await refreshServerData();
      trackEvent("mileage_entry_added", {
        car_id: updatedCar.carId,
        mileage: Number(mileageForm.mileage)
      });
      setMessage({ type: "success", text: "Mileage history updated." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not update mileage." });
    }
  }

  async function handleAddService(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const response = await fetch("/api/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          carId: Number(serviceForm.carId),
          cost: serviceForm.cost,
          description: serviceForm.description,
          mileage: Number(serviceForm.mileage),
          notes: serviceForm.notes,
          serviceDate: formatDateForServiceApi(serviceForm.serviceDate),
          serviceType: serviceForm.serviceType
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not add service.");
      }

      const updatedCar = payload as CarDetails;
      syncSelectedCar(updatedCar);
      setServiceForm((current) => ({
        ...emptyServiceForm,
        carId: String(updatedCar.carId),
        mileage: String(updatedCar.currentMileage),
        serviceDate: todayIso(),
        serviceType: current.serviceType
      }));
      await refreshCars();
      await refreshServerData();
      trackEvent("service_added", {
        car_id: updatedCar.carId,
        service_type: serviceForm.serviceType,
        mileage: Number(serviceForm.mileage)
      });
      setMessage({ type: "success", text: "Service record added successfully." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not add service." });
    }
  }

  async function handleSaveServiceEdit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!selectedCar || editingServiceId === null) {
      setMessage({ type: "error", text: "Choose a service record before editing it." });
      return;
    }

    setIsSavingService(true);

    try {
      const response = await fetch(`/api/cars/${selectedCar.carId}/services/${editingServiceId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          carId: selectedCar.carId,
          cost: editServiceForm.cost,
          description: editServiceForm.description,
          mileage: Number(editServiceForm.mileage),
          notes: editServiceForm.notes,
          serviceDate: formatDateForServiceApi(editServiceForm.serviceDate),
          serviceType: editServiceForm.serviceType
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update service.");
      }

      const updatedCar = payload as CarDetails;
      syncSelectedCar(updatedCar);
      cancelEditingService();
      await refreshCars();
      await refreshServerData();
      setMessage({ type: "success", text: "Service record updated." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not update service." });
    } finally {
      setIsSavingService(false);
    }
  }

  async function handleDeleteService(serviceId: number) {
    if (!selectedCar) {
      return;
    }

    const shouldDelete = window.confirm("Delete this service record?");
    if (!shouldDelete) {
      return;
    }

    setDeletingServiceId(serviceId);
    setMessage(null);

    try {
      const response = await fetch(`/api/cars/${selectedCar.carId}/services/${serviceId}`, {
        method: "DELETE"
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not delete service.");
      }

      const updatedCar = payload as CarDetails;
      syncSelectedCar(updatedCar);
      await refreshCars();
      await refreshServerData();
      setMessage({ type: "success", text: "Service record deleted." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not delete service." });
    } finally {
      setDeletingServiceId(null);
    }
  }

  async function handleSaveMileageEntryEdit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!selectedCar || editingMileageEntryId === null) {
      setMessage({ type: "error", text: "Choose a mileage entry before editing it." });
      return;
    }

    setIsSavingMileageEntry(true);

    try {
      const response = await fetch(
        `/api/cars/${selectedCar.carId}/mileage/${editingMileageEntryId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            allowCorrection: editMileageEntryForm.allowCorrection,
            mileage: Number(editMileageEntryForm.mileage),
            notes: editMileageEntryForm.notes
          })
        }
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update mileage entry.");
      }

      const updatedCar = payload as CarDetails;
      syncSelectedCar(updatedCar);
      cancelEditingMileageEntry();
      await refreshCars();
      await refreshServerData();
      setMessage({ type: "success", text: "Mileage entry updated." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Could not update mileage entry."
      });
    } finally {
      setIsSavingMileageEntry(false);
    }
  }

  async function handleDeleteMileageEntry(entryId: number) {
    if (!selectedCar) {
      return;
    }

    const shouldDelete = window.confirm("Delete this mileage entry?");
    if (!shouldDelete) {
      return;
    }

    setDeletingMileageEntryId(entryId);
    setMessage(null);

    try {
      const response = await fetch(`/api/cars/${selectedCar.carId}/mileage/${entryId}`, {
        method: "DELETE"
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not delete mileage entry.");
      }

      const updatedCar = payload as CarDetails;
      syncSelectedCar(updatedCar);
      await refreshCars();
      await refreshServerData();
      setMessage({ type: "success", text: "Mileage entry deleted." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Could not delete mileage entry."
      });
    } finally {
      setDeletingMileageEntryId(null);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      trackEvent("logout", { location: view });
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function handleSaveProfile(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSavingProfile(true);

    try {
      const response = await fetch("/api/account", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          displayName: profileForm.displayName,
          email: profileForm.email
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update account profile.");
      }

      setProfile(payload as UserProfile);
      await refreshServerData();
      trackEvent("profile_updated");
      setMessage({ type: "success", text: "Account profile updated." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Could not update account profile."
      });
    } finally {
      setIsSavingProfile(false);
    }
  }

  const serviceTypeOptions = selectedCar
    ? Array.from(new Set(selectedCar.serviceHistory.map((service) => service.serviceType))).sort()
    : [];
  const trendDateFromValue = trendDateFrom ? parseIsoDateValue(trendDateFrom) : null;
  const trendDateToValue = trendDateTo ? parseIsoDateValue(trendDateTo) : null;
  const trendServiceHistory = selectedCar
    ? selectedCar.serviceHistory.map((service) => ({
        cost: service.cost,
        date: parseDisplayDate(service.date),
        mileage: service.mileage,
        serviceType: service.serviceType
      }))
    : [];
  const trendMileageHistory = selectedCar
    ? selectedCar.mileageHistory.map((entry) => ({
        date: parseDisplayDate(entry.date),
        mileage: entry.mileage
      }))
    : [];
  const fleetServiceTypeOptions = Array.from(
    new Set(fleetInsightRecords.flatMap((car) => car.serviceHistory.map((service) => service.serviceType)))
  ).sort();
  const fleetTrendServices: TrendServiceRecord[] = fleetInsightRecords.flatMap((car) =>
    car.serviceHistory.map((service) => ({
      carName: car.carName,
      cost: service.cost,
      date: parseDisplayDate(service.date),
      mileage: service.mileage,
      serviceType: service.serviceType
    }))
  );
  const fleetTrendMileage: TrendMileageRecord[] = fleetInsightRecords.flatMap((car) =>
    car.mileageHistory.map((entry) => ({
      carId: car.carId,
      carName: car.carName,
      date: parseDisplayDate(entry.date),
      mileage: entry.mileage
    }))
  );
  const filteredTrendServices = filterServiceHistoryByTrend(trendServiceHistory, {
    dateFrom: trendDateFromValue,
    dateTo: trendDateToValue,
    serviceType: trendServiceTypeFilter === "all" ? null : trendServiceTypeFilter
  });
  const trendMileagePoints = buildMileageAdditionTrend(trendMileageHistory, trendDateFromValue, trendDateToValue);
  const trendExpensePoints = buildCumulativeExpenseTrend(filteredTrendServices);
  const trendMileageChartPoints = toWindowedChartPoints(trendMileagePoints, trendDateFrom, trendDateTo);
  const trendExpenseChartPoints = toWindowedChartPoints(trendExpensePoints, trendDateFrom, trendDateTo);
  const trendCategoryExpenses = buildExpenseByCategory(filteredTrendServices);
  const trendMilesDriven = calculateMileageAddedInWindow(trendMileageHistory, trendDateFromValue, trendDateToValue);
  const trendAverageMonthlyMileage = calculateAverageMonthlyMileageInWindow(
    trendMileageHistory,
    trendDateFromValue,
    trendDateToValue
  );
  const trendAverageMonthlyExpense = calculateAverageMonthlyExpense(filteredTrendServices);
  const trendAverageMonthlyServiceFrequency = calculateAverageMonthlyServiceFrequency(filteredTrendServices);
  const filteredFleetTrendServices = filterServiceHistoryByTrend(fleetTrendServices, {
    dateFrom: trendDateFromValue,
    dateTo: trendDateToValue,
    serviceType: trendServiceTypeFilter === "all" ? null : trendServiceTypeFilter
  });
  const fleetMileagePoints = buildFleetMileageAdditionTrend(fleetTrendMileage, trendDateFromValue, trendDateToValue);
  const fleetExpensePoints = buildCumulativeExpenseTrend(filteredFleetTrendServices);
  const fleetMileageChartPoints = toWindowedChartPoints(fleetMileagePoints, trendDateFrom, trendDateTo);
  const fleetExpenseChartPoints = toWindowedChartPoints(fleetExpensePoints, trendDateFrom, trendDateTo);
  const fleetCategoryExpenses = buildExpenseByCategory(filteredFleetTrendServices);
  const fleetMilesDriven = calculateFleetMilesDriven(fleetTrendMileage, trendDateFromValue, trendDateToValue);
  const fleetAverageMonthlyMileage = calculateFleetAverageMonthlyMileage(
    fleetTrendMileage,
    trendDateFromValue,
    trendDateToValue
  );
  const fleetAverageMonthlyExpense = calculateAverageMonthlyExpense(filteredFleetTrendServices);
  const fleetAverageMonthlyServiceFrequency = calculateAverageMonthlyServiceFrequency(filteredFleetTrendServices);
  const fleetHighlights = getFleetHighlights(cars);
  const overdueAttentionItems = attentionItems.filter((item) => item.status === "overdue");
  const dueSoonAttentionItems = attentionItems.filter((item) => item.status === "due-soon");
  const serviceFeedRows = serviceFeed ?? recentServices;
  const today = todayIso();
  const maxTrendDate = addYearsIso(today, 1);
  const vehicleTrendMinDate = selectedCar ? getVehicleTrendMinDate(selectedCar) : today;
  const fleetTrendMinDate = getFleetTrendMinDate(fleetInsightRecords) ?? today;
  const pageMeta = getPageMeta(view, selectedCar);
  const showWorkspaceUser = view === "dashboard" || view === "account";

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <div className="workspace-header-copy">
          <div className="workspace-kicker">CarKeeper</div>
          <h1>{pageMeta.title}</h1>
          <p>{pageMeta.description}</p>
        </div>

        <div className="workspace-header-side">
          {showWorkspaceUser ? (
            <div className="workspace-user">
              <strong>{profile?.displayName || username}</strong>
              <span>{profile?.email || "No email saved"}</span>
            </div>
          ) : null}
          <div className="workspace-actions">
            {view !== "new-vehicle" ? (
              <Link className="btn btn-primary" href="/garage/new">
                Add Vehicle
              </Link>
            ) : null}
            {selectedCar && view === "vehicle" ? (
              <button className="btn btn-secondary" onClick={() => openVehicleInsightsPage(selectedCar.carId)} type="button">
                Open Insights
              </button>
            ) : null}
            {selectedCar && view === "vehicle-insights" ? (
              <button className="btn btn-secondary" onClick={() => openVehiclePage(selectedCar.carId)} type="button">
                Open Records
              </button>
            ) : null}
            <button className="btn btn-secondary" disabled={isLoggingOut} onClick={handleLogout} type="button">
              {isLoggingOut ? "Signing out..." : "Log Out"}
            </button>
          </div>
        </div>
      </header>

      <nav className="workspace-nav">
        <Link className={`workspace-nav-link ${view === "dashboard" ? "active" : ""}`} href="/">
          Dashboard
        </Link>
        <Link className={`workspace-nav-link ${view === "garage" || view === "new-vehicle" || view === "vehicle" || view === "vehicle-insights" ? "active" : ""}`} href="/garage">
          Garage
        </Link>
        <Link className={`workspace-nav-link ${view === "services" ? "active" : ""}`} href="/services">
          Analytics
        </Link>
        <Link className={`workspace-nav-link ${view === "account" ? "active" : ""}`} href="/account">
          Account
        </Link>
      </nav>

      {message ? <div className={`status-card ${message.type}`}>{message.text}</div> : null}

      {view === "dashboard" ? (
        <DashboardHomeView
          attentionItems={attentionItems}
          cars={cars}
          dueSoonAttentionItems={dueSoonAttentionItems}
          fleetHighlights={fleetHighlights}
          openVehiclePage={openVehiclePage}
          overdueAttentionItems={overdueAttentionItems}
          overview={overview}
          recentServices={recentServices}
        />
      ) : null}

      {view === "garage" ? (
        <GarageIndexView
          attentionItems={attentionItems}
          cars={cars}
          openVehicleInsightsPage={openVehicleInsightsPage}
          openVehiclePage={openVehiclePage}
          overview={overview}
        />
      ) : null}

      {view === "new-vehicle" ? (
        <VehicleCreateView
          carForm={carForm}
          handleAddCar={handleAddCar}
          onAddAppointment={addAppointment}
          onAddRule={addReminderRule}
          onRemoveAppointment={removeAppointment}
          onRemoveRule={removeReminderRule}
          onUpdateAppointment={updateAppointmentField}
          onUpdateCarField={updateCarField}
          onUpdateRule={updateReminderRuleField}
        />
      ) : null}

      {view === "services" ? (
        <AnalyticsIndexView
          attentionItems={attentionItems}
          cars={cars}
          fleetAverageMonthlyExpense={fleetAverageMonthlyExpense}
          fleetAverageMonthlyMileage={fleetAverageMonthlyMileage}
          fleetAverageMonthlyServiceFrequency={fleetAverageMonthlyServiceFrequency}
          fleetCategoryExpenses={fleetCategoryExpenses}
          fleetExpensePoints={fleetExpenseChartPoints}
          fleetInsightRecords={fleetInsightRecords}
          fleetMileagePoints={fleetMileageChartPoints}
          fleetMilesDriven={fleetMilesDriven}
          overview={overview}
          recentServices={serviceFeedRows}
          serviceTypeOptions={fleetServiceTypeOptions}
          maxTrendDate={maxTrendDate}
          minTrendDate={fleetTrendMinDate}
          setTrendDateFrom={(value) => setTrendDateFrom(clampIsoDate(value, fleetTrendMinDate, maxTrendDate))}
          setTrendDateTo={(value) => setTrendDateTo(clampIsoDate(value, fleetTrendMinDate, maxTrendDate))}
          setTrendServiceTypeFilter={setTrendServiceTypeFilter}
          setTrendPreset={(preset) => applyTrendPreset(preset, setTrendDateFrom, setTrendDateTo, fleetTrendMinDate, maxTrendDate)}
          trendDateFrom={trendDateFrom}
          trendDateTo={trendDateTo}
          trendServiceTypeFilter={trendServiceTypeFilter}
        />
      ) : null}

      {view === "account" ? (
        <AccountWorkspaceView
          handleSaveProfile={handleSaveProfile}
          isSavingProfile={isSavingProfile}
          profile={profile}
          profileForm={profileForm}
          updateProfileField={updateProfileField}
          username={username}
        />
      ) : null}

      {view === "vehicle" ? (
        <VehicleWorkspaceView
          car={selectedCar}
          cancelEditingMileageEntry={cancelEditingMileageEntry}
          cancelEditingService={cancelEditingService}
          deletingMileageEntryId={deletingMileageEntryId}
          deletingServiceId={deletingServiceId}
          editCarForm={editCarForm}
          editMileageEntryForm={editMileageEntryForm}
          editServiceForm={editServiceForm}
          editingMileageEntryId={editingMileageEntryId}
          editingServiceId={editingServiceId}
          handleDeleteMileageEntry={handleDeleteMileageEntry}
          handleDeleteService={handleDeleteService}
          handleReminderAction={handleReminderAction}
          handleSaveMileageEntryEdit={handleSaveMileageEntryEdit}
          handleSaveServiceEdit={handleSaveServiceEdit}
          handleSaveVehicle={handleSaveVehicle}
          handleUpdateMileage={handleUpdateMileage}
          handleAddService={handleAddService}
          handleDeleteVehicle={handleDeleteVehicle}
          isDeletingVehicle={isDeletingVehicle}
          isSavingMileageEntry={isSavingMileageEntry}
          isSavingService={isSavingService}
          isSavingVehicle={isSavingVehicle}
          mileageForm={mileageForm}
          openVehicleInsightsPage={openVehicleInsightsPage}
          serviceForm={serviceForm}
          startEditingMileageEntry={startEditingMileageEntry}
          startEditingService={startEditingService}
          updateEditCarField={updateEditCarField}
          updateEditMileageEntryField={updateEditMileageEntryField}
          updateEditServiceField={updateEditServiceField}
          updateMileageField={updateMileageField}
          updateServiceField={updateServiceField}
          onAddRule={addReminderRule}
          onAddAppointment={addAppointment}
          onRemoveAppointment={removeAppointment}
          onRemoveRule={removeReminderRule}
          onUpdateAppointment={updateAppointmentField}
          onUpdateRule={updateReminderRuleField}
        />
      ) : null}

      {view === "vehicle-insights" ? (
        <VehicleInsightsView
          car={selectedCar}
          maxTrendDate={maxTrendDate}
          minTrendDate={vehicleTrendMinDate}
          serviceTypeOptions={serviceTypeOptions}
          setTrendDateFrom={(value) => setTrendDateFrom(clampIsoDate(value, vehicleTrendMinDate, maxTrendDate))}
          setTrendDateTo={(value) => setTrendDateTo(clampIsoDate(value, vehicleTrendMinDate, maxTrendDate))}
          setTrendServiceTypeFilter={setTrendServiceTypeFilter}
          setTrendPreset={(preset) => applyTrendPreset(preset, setTrendDateFrom, setTrendDateTo, vehicleTrendMinDate, maxTrendDate)}
          trendAverageMonthlyExpense={trendAverageMonthlyExpense}
          trendAverageMonthlyMileage={trendAverageMonthlyMileage}
          trendAverageMonthlyServiceFrequency={trendAverageMonthlyServiceFrequency}
          trendCategoryExpenses={trendCategoryExpenses}
          trendDateFrom={trendDateFrom}
          trendDateTo={trendDateTo}
          trendExpensePoints={trendExpenseChartPoints}
          trendMilesDriven={trendMilesDriven}
          trendMileagePoints={trendMileageChartPoints}
          trendServiceTypeFilter={trendServiceTypeFilter}
        />
      ) : null}
    </main>
  );
}

function DashboardHomeView({
  attentionItems,
  cars,
  dueSoonAttentionItems,
  fleetHighlights,
  openVehiclePage,
  overdueAttentionItems,
  overview,
  recentServices
}: {
  attentionItems: AttentionItem[];
  cars: CarSummary[];
  dueSoonAttentionItems: AttentionItem[];
  fleetHighlights: ReturnType<typeof getFleetHighlights>;
  openVehiclePage: (carId: number) => void;
  overdueAttentionItems: AttentionItem[];
  overview: DashboardOverview;
  recentServices: DashboardRecentService[];
}) {
  const [watchPages, setWatchPages] = useState<Record<number, number>>({});
  const [maintenanceOverviewPage, setMaintenanceOverviewPage] = useState(0);
  const watchGroups = groupAttentionItems(attentionItems);
  const flaggedVehicleNames = watchGroups.map((group) => group.carName);

  return (
    <div className="content-stack">
      <section className="overview-grid dashboard-overview-grid compact-shell">
        <OverviewCard label="Vehicles" value={String(overview.totalVehicles)} />
        <OverviewCard label="Service Records" value={String(overview.totalServiceRecords)} />
        <OverviewCard label="Total Expenses" value={formatCurrency(overview.totalExpenses)} />
        <MaintenanceOverviewCard
          currentPage={maintenanceOverviewPage}
          dueSoonCount={overview.dueSoonCount}
          flaggedVehicleNames={flaggedVehicleNames}
          helperText="Due Soon triggers when mileage reaches half of the service interval."
          onPageChange={setMaintenanceOverviewPage}
          overdueCount={overview.overdueCount}
        />
      </section>

      <section className="fleet-highlights">
        <HighlightCard
          label="Highest Mileage"
          subtitle={
            fleetHighlights.highestMileageVehicle
              ? `${fleetHighlights.highestMileageVehicle.currentMileage.toLocaleString("en-US")} mi`
              : "No vehicles tracked"
          }
          title={fleetHighlights.highestMileageVehicle?.carName ?? "No vehicle available"}
        />
        <HighlightCard
          label="Most Expensive"
          subtitle={
            fleetHighlights.highestSpendVehicle
              ? formatCurrency(fleetHighlights.highestSpendVehicle.lifetimeExpenses)
              : "No spending yet"
          }
          title={fleetHighlights.highestSpendVehicle?.carName ?? "No vehicle available"}
        />
        <HighlightCard
          label="Most Serviced"
          subtitle={
            fleetHighlights.mostServicedVehicle
              ? `${fleetHighlights.mostServicedVehicle.serviceCount} records`
              : "No service history"
          }
          title={fleetHighlights.mostServicedVehicle?.carName ?? "No vehicle available"}
        />
      </section>

      <div className="dashboard-panels">
        <section className="workspace-panel dashboard-garage-panel">
          <div className="workspace-panel-header">
            <div>
              <h2>Garage</h2>
              <p>Fleet snapshot</p>
            </div>
            <Link className="section-link" href="/garage">
              Open Garage
            </Link>
          </div>
          {cars.length === 0 ? (
            <div className="empty-inline">Add a vehicle to activate your fleet dashboard.</div>
          ) : (
            <div className="dashboard-garage-list">
              {cars.slice(0, 5).map((car) => (
                <button
                  className="preview-row dashboard-garage-row"
                  key={car.carId}
                  onClick={() => openVehiclePage(car.carId)}
                  type="button"
                >
                  <span className="preview-row-stack">
                    <span className="preview-main">{car.carName}</span>
                    <span className="preview-sub">Last service {car.lastServiceDate}</span>
                  </span>
                  <span className="preview-row-stack preview-row-stack-end">
                    <span className="preview-value">{car.currentMileage.toLocaleString("en-US")} mi</span>
                    <span className="preview-meta">{formatCurrency(car.lifetimeExpenses)} lifetime cost</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="dashboard-side-stack">
          <section className="workspace-panel dashboard-watch-panel">
            <div className="workspace-panel-header">
              <div>
                <h2>Maintenance Watch</h2>
                <p>Priority service signals</p>
              </div>
            </div>
            {attentionItems.length === 0 ? (
              <div className="empty-inline">No maintenance alerts</div>
            ) : (
              <div className="watch-preview-list">
                {watchGroups.map((group) => {
                  const pageSize = 3;
                  const pageCount = Math.max(1, Math.ceil(group.items.length / pageSize));
                  const currentPage = Math.min(watchPages[group.carId] ?? 0, pageCount - 1);
                  const visibleItems = group.items.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

                  return (
                    <div className="watch-group-card" key={group.carId}>
                      <div className="watch-group-title">
                        <button className="comparison-link" onClick={() => openVehiclePage(group.carId)} type="button">
                          {group.carName}
                        </button>
                        {pageCount > 1 ? (
                          <div className="section-pager">
                            <button
                              className="btn btn-inline"
                              disabled={currentPage === 0}
                              onClick={() =>
                                setWatchPages((current) => ({
                                  ...current,
                                  [group.carId]: Math.max(0, currentPage - 1)
                                }))
                              }
                              type="button"
                            >
                              Prev
                            </button>
                            <span className="section-pager-label">
                              {currentPage + 1} / {pageCount}
                            </span>
                            <button
                              className="btn btn-inline"
                              disabled={currentPage >= pageCount - 1}
                              onClick={() =>
                                setWatchPages((current) => ({
                                  ...current,
                                  [group.carId]: Math.min(pageCount - 1, currentPage + 1)
                                }))
                              }
                              type="button"
                            >
                              Next
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div className="watch-group-items">
                        {visibleItems.map((item) => (
                          <button
                            className="preview-row"
                            key={`${item.carId}-${item.type}-${item.serviceType}-${item.reason}`}
                            onClick={() => openVehiclePage(item.carId)}
                            type="button"
                          >
                            <span className="preview-row-stack">
                              <span className="preview-main">{item.serviceType}</span>
                              <span className="preview-sub">{item.reason}</span>
                            </span>
                            <span className={`comparison-status ${item.status === "overdue" ? "warning" : "due-soon"}`}>
                              {item.status === "overdue" ? "Overdue" : item.type === "appointment" ? "Scheduled" : "Due Soon"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="workspace-panel dashboard-service-panel">
            <div className="workspace-panel-header">
              <div>
                <h2>Recent Service</h2>
                <p>Latest maintenance activity</p>
              </div>
              <Link className="section-link" href="/services">
                Open Analytics
              </Link>
            </div>
            {recentServices.length === 0 ? (
              <div className="empty-inline">No service activity yet</div>
            ) : (
              <div className="preview-list">
                {recentServices.slice(0, 6).map((service) => (
                  <button
                    className="preview-row preview-row-stack"
                    key={`${service.carId}-${service.serviceId}`}
                    onClick={() => openVehiclePage(service.carId)}
                    type="button"
                  >
                    <span className="preview-main">{service.serviceType}</span>
                    <span className="preview-sub">{service.carName}</span>
                    <span className="preview-meta">
                      {service.date} - {service.mileage.toLocaleString("en-US")} mi - {formatCurrency(service.cost)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function GarageIndexView({
  attentionItems,
  cars,
  openVehicleInsightsPage,
  openVehiclePage,
  overview
}: {
  attentionItems: AttentionItem[];
  cars: CarSummary[];
  openVehicleInsightsPage: (carId: number) => void;
  openVehiclePage: (carId: number) => void;
  overview: DashboardOverview;
}) {
  const fleetHighlights = getFleetHighlights(cars);
  const watchGroups = groupAttentionItems(attentionItems);

  return (
    <div className="content-stack">
      <section className="overview-grid garage-overview-grid compact-shell">
        <OverviewCard label="Vehicles" value={String(overview.totalVehicles)} />
        <OverviewCard label="Service Records" value={String(overview.totalServiceRecords)} />
        <OverviewCard label="Total Expenses" value={formatCurrency(overview.totalExpenses)} />
        <OverviewCard label="Flagged Vehicles" value={String(overview.flaggedVehicleCount)} />
      </section>

      <section className="fleet-highlights">
        <HighlightCard
          label="Highest Mileage"
          subtitle={
            fleetHighlights.highestMileageVehicle
              ? `${fleetHighlights.highestMileageVehicle.currentMileage.toLocaleString("en-US")} mi`
              : "No vehicles tracked"
          }
          title={fleetHighlights.highestMileageVehicle?.carName ?? "No vehicle available"}
        />
        <HighlightCard
          label="Most Expensive"
          subtitle={
            fleetHighlights.highestSpendVehicle
              ? formatCurrency(fleetHighlights.highestSpendVehicle.lifetimeExpenses)
              : "No spending yet"
          }
          title={fleetHighlights.highestSpendVehicle?.carName ?? "No vehicle available"}
        />
        <HighlightCard
          label="Most Serviced"
          subtitle={
            fleetHighlights.mostServicedVehicle
              ? `${fleetHighlights.mostServicedVehicle.serviceCount} records`
              : "No service history"
          }
          title={fleetHighlights.mostServicedVehicle?.carName ?? "No vehicle available"}
        />
      </section>

      <div className="dashboard-panels">
        <section className="workspace-panel dashboard-garage-panel">
          <div className="workspace-panel-header">
            <div>
              <h2>All Vehicles</h2>
              <p>Fleet records and mileage at a glance</p>
            </div>
          </div>

          {cars.length === 0 ? (
            <div className="empty-inline">Your garage is ready for its first vehicle.</div>
          ) : (
            <div className="dashboard-garage-list">
              {cars.map((car) => {
                const reminder = attentionItems.find((item) => item.carId === car.carId);

                return (
                  <div className="preview-row dashboard-garage-row" key={car.carId}>
                    <span className="preview-row-stack">
                      <span className="vehicle-row-title">
                        <button className="comparison-link" onClick={() => openVehiclePage(car.carId)} type="button">
                          {car.carName}
                        </button>
                        <button
                          className="btn btn-inline btn-inline-strong"
                          onClick={() => openVehicleInsightsPage(car.carId)}
                          type="button"
                        >
                          Insights
                        </button>
                      </span>
                      <span className="preview-sub">Last service {car.lastServiceDate}</span>
                    </span>

                    <span className="preview-row-stack preview-row-stack-end">
                      <span className="preview-value">{car.currentMileage.toLocaleString("en-US")} mi</span>
                      <span className="preview-meta">{formatCurrency(car.lifetimeExpenses)} lifetime cost</span>
                    </span>

                    <span className="preview-row-stack preview-row-stack-end">
                      {reminder ? (
                        <span className={`comparison-status ${reminder.status === "overdue" ? "warning" : "due-soon"}`}>
                          {reminder.serviceType}
                        </span>
                      ) : (
                        <span className="comparison-status ok">On schedule</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="dashboard-side-stack">
          <section className="workspace-panel dashboard-watch-panel">
            <div className="workspace-panel-header">
              <div>
                <h2>Maintenance Watch</h2>
                <p>Priority service signals</p>
              </div>
            </div>

            {watchGroups.length === 0 ? (
              <div className="empty-inline">No maintenance alerts</div>
            ) : (
              <div className="watch-preview-list">
                {watchGroups.map((group) => (
                  <div className="watch-group-card" key={group.carId}>
                    <div className="watch-group-title">
                      <button className="comparison-link" onClick={() => openVehiclePage(group.carId)} type="button">
                        {group.carName}
                      </button>
                    </div>

                    <div className="watch-group-items">
                      {group.items.slice(0, 3).map((item) => (
                        <button
                          className="preview-row"
                          key={`${item.carId}-${item.type}-${item.serviceType}-${item.reason}`}
                          onClick={() => openVehiclePage(item.carId)}
                          type="button"
                        >
                          <span className="preview-row-stack">
                            <span className="preview-main">{item.serviceType}</span>
                            <span className="preview-sub">{item.reason}</span>
                          </span>
                          <span className={`comparison-status ${item.status === "overdue" ? "warning" : "due-soon"}`}>
                            {item.status === "overdue" ? "Overdue" : item.type === "appointment" ? "Scheduled" : "Due Soon"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="workspace-panel dashboard-service-panel">
            <div className="workspace-panel-header">
              <div>
                <h2>Fleet Summary</h2>
                <p>Garage health metrics</p>
              </div>
            </div>

            <dl className="detail-list">
              <div>
                <dt>Average Mileage</dt>
                <dd>{overview.averageMileage === null ? "N/A" : `${overview.averageMileage.toLocaleString("en-US")} mi`}</dd>
              </div>
              <div>
                <dt>Average Service Cost</dt>
                <dd>{formatCurrency(overview.averageServiceCost)}</dd>
              </div>
              <div>
                <dt>On Schedule</dt>
                <dd>{overview.onScheduleCount} vehicles</dd>
              </div>
              <div>
                <dt>Due Soon</dt>
                <dd>{overview.dueSoonCount} alerts</dd>
              </div>
              <div>
                <dt>Overdue</dt>
                <dd>{overview.overdueCount} alerts</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

function VehicleCreateView({
  carForm,
  handleAddCar,
  onAddAppointment,
  onAddRule,
  onRemoveAppointment,
  onRemoveRule,
  onUpdateAppointment,
  onUpdateCarField,
  onUpdateRule
}: {
  carForm: CarFormState;
  handleAddCar: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  onAddAppointment: (mode: "create" | "edit") => void;
  onAddRule: (mode: "create" | "edit") => void;
  onRemoveAppointment: (mode: "create" | "edit", index: number) => void;
  onRemoveRule: (mode: "create" | "edit", index: number) => void;
  onUpdateAppointment: (
    mode: "create" | "edit",
    index: number,
    field: keyof MaintenanceAppointmentForm,
    value: string
  ) => void;
  onUpdateCarField: (
    field: keyof CarFormState,
    value: string | ReminderRuleForm[] | MaintenanceAppointmentForm[]
  ) => void;
  onUpdateRule: (
    mode: "create" | "edit",
    index: number,
    field: keyof ReminderRuleForm,
    value: string
  ) => void;
}) {
  return (
    <section className="workspace-panel workspace-form-panel">
      <div className="workspace-panel-header">
        <div>
          <h2>New Vehicle</h2>
          <p>Core vehicle profile</p>
        </div>
      </div>

      <form className="form-grid" onSubmit={handleAddCar}>
        <div className="field-row">
          <div className="field-group">
            <label htmlFor="make">Make</label>
            <input
              id="make"
              onChange={(event) => onUpdateCarField("make", event.target.value)}
              required
              type="text"
              value={carForm.make}
            />
          </div>
          <div className="field-group">
            <label htmlFor="model">Model</label>
            <input
              id="model"
              onChange={(event) => onUpdateCarField("model", event.target.value)}
              required
              type="text"
              value={carForm.model}
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field-group">
            <label htmlFor="year">Year</label>
            <input
              id="year"
              min="1900"
              onChange={(event) => onUpdateCarField("year", event.target.value)}
              required
              type="number"
              value={carForm.year}
            />
          </div>
          <div className="field-group">
            <label htmlFor="mileage">Current Mileage</label>
            <input
              id="mileage"
              min="0"
              onChange={(event) => onUpdateCarField("mileage", event.target.value)}
              required
              type="number"
              value={carForm.mileage}
            />
          </div>
        </div>

        <div className="field-group">
          <div className="detail-section-heading field-subheading">
            <label htmlFor="imageUrl">Image URL</label>
            <p>Optional</p>
          </div>
          <input
            id="imageUrl"
            onChange={(event) => onUpdateCarField("imageUrl", event.target.value)}
            type="text"
            value={carForm.imageUrl}
          />
        </div>

        <ReminderRuleEditor
          mode="create"
          onAddRule={onAddRule}
          onRemoveRule={onRemoveRule}
          onUpdateRule={onUpdateRule}
          rules={carForm.serviceReminderRules}
        />

        <AppointmentEditor
          appointments={carForm.maintenanceAppointments}
          mode="create"
          onAddAppointment={onAddAppointment}
          onRemoveAppointment={onRemoveAppointment}
          onUpdateAppointment={onUpdateAppointment}
        />

        <div className="action-row">
          <button className="btn btn-primary" type="submit">
            Create Vehicle
          </button>
          <Link className="btn btn-secondary" href="/garage">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}

function AnalyticsIndexView({
  attentionItems,
  cars,
  fleetAverageMonthlyExpense,
  fleetAverageMonthlyMileage,
  fleetAverageMonthlyServiceFrequency,
  fleetCategoryExpenses,
  fleetExpensePoints,
  fleetInsightRecords,
  fleetMileagePoints,
  fleetMilesDriven,
  maxTrendDate,
  minTrendDate,
  overview,
  recentServices,
  serviceTypeOptions,
  setTrendDateFrom,
  setTrendDateTo,
  setTrendPreset,
  setTrendServiceTypeFilter,
  trendDateFrom,
  trendDateTo,
  trendServiceTypeFilter
}: {
  attentionItems: AttentionItem[];
  cars: CarSummary[];
  fleetAverageMonthlyExpense: number | null;
  fleetAverageMonthlyMileage: number | null;
  fleetAverageMonthlyServiceFrequency: number | null;
  fleetCategoryExpenses: CategoryExpenseItem[];
  fleetExpensePoints: ChartPoint[];
  fleetInsightRecords: FleetInsightRecord[];
  fleetMileagePoints: ChartPoint[];
  fleetMilesDriven: number | null;
  maxTrendDate: string;
  minTrendDate: string;
  overview: DashboardOverview;
  recentServices: DashboardRecentService[];
  serviceTypeOptions: string[];
  setTrendDateFrom: (value: string) => void;
  setTrendDateTo: (value: string) => void;
  setTrendPreset: (preset: TrendPreset) => void;
  setTrendServiceTypeFilter: (value: string) => void;
  trendDateFrom: string;
  trendDateTo: string;
  trendServiceTypeFilter: string;
}) {
  const topCostVehicles = [...cars]
    .sort((left, right) => right.lifetimeExpenses - left.lifetimeExpenses)
    .slice(0, 5);
  const [fleetTimelineSort, setFleetTimelineSort] = useState<"newest" | "oldest">("newest");
  const [fleetTimelinePage, setFleetTimelinePage] = useState(0);
  const [fleetTimelinePageSize, setFleetTimelinePageSize] = useState<PageSizeOption>(5);
  const [recentActivityPage, setRecentActivityPage] = useState(0);
  const [recentActivityPageSize, setRecentActivityPageSize] = useState<PageSizeOption>(5);
  const [recentActivitySort, setRecentActivitySort] = useState<SortDirection>("newest");
  const fleetTimelineRows = getFleetMileageTimelineRows(fleetInsightRecords, fleetTimelineSort);
  const pagedFleetTimeline = getPagedItems(fleetTimelineRows, fleetTimelinePage, fleetTimelinePageSize);
  const sortedRecentServices = [...recentServices].sort((left, right) => {
    const dateOrder = parseDisplayDate(left.date).getTime() - parseDisplayDate(right.date).getTime();
    const idOrder = left.serviceId - right.serviceId;
    const order = dateOrder || idOrder;

    return recentActivitySort === "oldest" ? order : -order;
  });
  const pagedRecentServices = getPagedItems(sortedRecentServices, recentActivityPage, recentActivityPageSize);
  const serviceCosts = recentServices.filter(
    (service): service is DashboardRecentService & { cost: number } => service.cost !== null
  );
  const totalTrackedServiceCost = serviceCosts.reduce((sum, service) => sum + service.cost, 0);
  const averageTrackedServiceCost = serviceCosts.length
    ? totalTrackedServiceCost / serviceCosts.length
    : null;

  return (
    <div className="content-stack">
      <section className="overview-grid compact-shell">
        <OverviewCard
          helperText="Mileage added by odometer and service records in the selected window."
          label="Fleet Miles Added"
          value={fleetMilesDriven === null ? "N/A" : `${formatNumber(fleetMilesDriven)} mi`}
        />
        <OverviewCard
          label="Avg Monthly Miles"
          value={fleetAverageMonthlyMileage === null ? "N/A" : `${formatNumber(fleetAverageMonthlyMileage)} mi`}
        />
        <OverviewCard label="Avg Monthly Expense" value={formatCurrency(fleetAverageMonthlyExpense)} />
        <OverviewCard
          label="Services / Month"
          value={fleetAverageMonthlyServiceFrequency === null ? "N/A" : String(fleetAverageMonthlyServiceFrequency)}
        />
      </section>

      <TrendFilterPanel
        dateFrom={trendDateFrom}
        dateTo={trendDateTo}
        maxDate={maxTrendDate}
        minDate={minTrendDate}
        onApply={(nextDateFrom, nextDateTo, nextServiceType) => {
          setTrendDateFrom(clampIsoDate(nextDateFrom, minTrendDate, maxTrendDate));
          setTrendDateTo(clampIsoDate(nextDateTo, minTrendDate, maxTrendDate));
          setTrendServiceTypeFilter(nextServiceType);
        }}
        onPreset={setTrendPreset}
        onServiceTypeChange={setTrendServiceTypeFilter}
        onSetDateFrom={setTrendDateFrom}
        onSetDateTo={setTrendDateTo}
        serviceType={trendServiceTypeFilter}
        serviceTypeOptions={serviceTypeOptions}
        title="Fleet Trend Window"
      >
        <div className="trend-grid">
          <TimeSeriesChart
            emptyLabel="Fleet mileage trends appear after odometer entries are recorded."
            label="Fleet Miles Added"
            points={fleetMileagePoints}
            suffix=" mi"
            yAxisLabel="Miles added"
            yCeilingMultiplier={1.5}
          />
          <TimeSeriesChart
            emptyLabel="Fleet spending trends appear after priced service records are added."
            label="Fleet Total Spending"
            points={fleetExpensePoints}
            prefix="$"
            yAxisLabel="Total spending"
          />
        </div>
      </TrendFilterPanel>

      <div className="records-grid analytics-grid">
        <section className="workspace-panel">
          <div className="workspace-panel-header">
            <div>
              <h2>Cost Summary</h2>
              <p>Fleet service spending in the selected window</p>
            </div>
          </div>
          <div className="detail-list">
            <div>
              <dt>Tracked Service Cost</dt>
              <dd>{formatCurrency(getLatestChartValue(fleetExpensePoints))}</dd>
            </div>
            <div>
              <dt>Average Logged Service</dt>
              <dd>{formatCurrency(averageTrackedServiceCost)}</dd>
            </div>
            <div>
              <dt>Flagged Vehicles</dt>
              <dd>{overview.flaggedVehicleCount}</dd>
            </div>
            <div>
              <dt>Attention Items</dt>
              <dd>{attentionItems.length}</dd>
            </div>
          </div>
        </section>

        <section className="workspace-panel">
          <div className="workspace-panel-header">
            <div>
              <h2>Highest Cost Vehicles</h2>
              <p>Vehicles with the highest recorded cost</p>
            </div>
          </div>
          {topCostVehicles.length === 0 ? (
            <div className="empty-inline">Cost insights appear after priced service records are added.</div>
          ) : (
            <div className="preview-list">
              {topCostVehicles.map((car) => (
                <div className="preview-row analytics-preview-row" key={car.carId}>
                  <span className="preview-row-stack">
                    <span className="preview-main">{car.carName}</span>
                    <span className="preview-sub">{car.serviceCount} service records</span>
                  </span>
                  <span className="preview-row-stack preview-row-stack-end">
                    <span className="preview-value">{formatCurrency(car.lifetimeExpenses)}</span>
                    <span className="preview-meta">{car.currentMileage.toLocaleString("en-US")} mi</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="workspace-panel">
        <div className="workspace-panel-header">
          <div>
            <h2>Fleet Expense by Category</h2>
            <p>Spend distribution across all vehicles</p>
          </div>
        </div>
        {fleetCategoryExpenses.length === 0 ? (
          <div className="empty-inline">No service costs match the selected window.</div>
        ) : (
          <div className="category-list">
            {fleetCategoryExpenses.map((item) => (
              <CategoryExpenseCard item={item} key={item.category} />
            ))}
          </div>
        )}
      </section>

      <section className="workspace-panel">
        <div className="workspace-panel-header">
          <div>
            <h2>Recent Activity</h2>
            <p>Latest service events across the fleet</p>
          </div>
          <div className="history-toolbar">
            <button
              className="btn btn-inline"
              onClick={() => {
                setRecentActivitySort((current) => (current === "newest" ? "oldest" : "newest"));
                setRecentActivityPage(0);
              }}
              type="button"
            >
              {recentActivitySort === "newest" ? "Newest First" : "Oldest First"}
            </button>
          </div>
        </div>
        {recentServices.length === 0 ? (
          <div className="empty-inline">No service records yet</div>
        ) : (
          <div className={`preview-list list-density-${recentActivityPageSize}`}>
            {pagedRecentServices.items.map((service) => (
              <div className="preview-row analytics-preview-row" key={`${service.carId}-${service.serviceId}`}>
                <span className="preview-row-stack">
                  <span className="preview-main">{service.serviceType}</span>
                  <span className="preview-sub">{service.carName}</span>
                </span>
                <span className="preview-row-stack preview-row-stack-end">
                  <span className="preview-value">{formatCurrency(service.cost)}</span>
                  <span className="preview-meta">
                    {service.date} - {service.mileage.toLocaleString("en-US")} mi
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
        <ListPager
          page={pagedRecentServices.page}
          pageCount={pagedRecentServices.pageCount}
          pageSize={recentActivityPageSize}
          setPage={setRecentActivityPage}
          setPageSize={setRecentActivityPageSize}
        />
      </section>

      <section className="workspace-panel">
        <div className="workspace-panel-header">
          <div>
            <h2>Fleet Mileage Timeline</h2>
            <p>Latest odometer activity by vehicle</p>
          </div>
          <div className="segmented-control" aria-label="Sort fleet mileage timeline">
            <button
              className={fleetTimelineSort === "newest" ? "active" : ""}
              onClick={() => {
                setFleetTimelineSort("newest");
                setFleetTimelinePage(0);
              }}
              type="button"
            >
              Newest
            </button>
            <button
              className={fleetTimelineSort === "oldest" ? "active" : ""}
              onClick={() => {
                setFleetTimelineSort("oldest");
                setFleetTimelinePage(0);
              }}
              type="button"
            >
              Oldest
            </button>
          </div>
        </div>
        {fleetInsightRecords.length === 0 ? (
          <div className="empty-inline">No mileage activity yet</div>
        ) : (
          <div className={`mileage-table-list list-density-${fleetTimelinePageSize}`}>
            {pagedFleetTimeline.items.map((row) => (
              <div className="mileage-table-row" key={`${row.carId}-${row.entryId}`}>
                <span>{row.date}</span>
                <span>{row.carName}</span>
                <span>{row.mileage.toLocaleString("en-US")} mi</span>
                <span>{formatSourceLabel(row.source)}</span>
                <span className="truncate-text">{row.notes || "N/A"}</span>
              </div>
            ))}
          </div>
        )}
        <ListPager
          page={pagedFleetTimeline.page}
          pageCount={pagedFleetTimeline.pageCount}
          pageSize={fleetTimelinePageSize}
          setPage={setFleetTimelinePage}
          setPageSize={setFleetTimelinePageSize}
        />
      </section>
    </div>
  );
}

function AccountWorkspaceView({
  handleSaveProfile,
  isSavingProfile,
  profile,
  profileForm,
  updateProfileField,
  username
}: {
  handleSaveProfile: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  isSavingProfile: boolean;
  profile: UserProfile | null;
  profileForm: { displayName: string; email: string };
  updateProfileField: (field: "displayName" | "email", value: string) => void;
  username: string;
}) {
  return (
    <div className="content-stack two-column-shell">
      <section className="workspace-panel">
        <div className="workspace-panel-header">
          <div>
            <h2>Profile</h2>
            <p>Workspace identity</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleSaveProfile}>
          <div className="field-group">
            <label htmlFor="profileDisplayName">Display Name</label>
            <input
              id="profileDisplayName"
              onChange={(event) => updateProfileField("displayName", event.target.value)}
              required
              type="text"
              value={profileForm.displayName}
            />
          </div>

          <div className="field-group">
            <label htmlFor="profileEmail">Email</label>
            <input
              id="profileEmail"
              onChange={(event) => updateProfileField("email", event.target.value)}
              required
              type="email"
              value={profileForm.email}
            />
          </div>

          <button className="btn btn-primary" disabled={isSavingProfile} type="submit">
            {isSavingProfile ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </section>

      <section className="workspace-panel">
        <div className="workspace-panel-header">
          <div>
            <h2>Account</h2>
            <p>Account reference</p>
          </div>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Name</dt>
            <dd>{profile?.displayName ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{profile?.email ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt>Username</dt>
            <dd>{username}</dd>
          </div>
          <div>
            <dt>User ID</dt>
            <dd>{profile?.id ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{profile ? formatProfileDate(profile.createdAt) : "Unavailable"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function VehicleWorkspaceView({
  car,
  cancelEditingMileageEntry,
  cancelEditingService,
  deletingMileageEntryId,
  deletingServiceId,
  editCarForm,
  editMileageEntryForm,
  editServiceForm,
  editingMileageEntryId,
  editingServiceId,
  handleAddService,
  handleDeleteMileageEntry,
  handleDeleteService,
  handleDeleteVehicle,
  handleReminderAction,
  handleSaveMileageEntryEdit,
  handleSaveServiceEdit,
  handleSaveVehicle,
  handleUpdateMileage,
  isDeletingVehicle,
  isSavingMileageEntry,
  isSavingService,
  isSavingVehicle,
  mileageForm,
  openVehicleInsightsPage,
  onAddRule,
  onAddAppointment,
  onRemoveAppointment,
  onRemoveRule,
  onUpdateAppointment,
  onUpdateRule,
  serviceForm,
  startEditingMileageEntry,
  startEditingService,
  updateEditCarField,
  updateEditMileageEntryField,
  updateEditServiceField,
  updateMileageField,
  updateServiceField
}: {
  car: CarDetails | null;
  cancelEditingMileageEntry: () => void;
  cancelEditingService: () => void;
  deletingMileageEntryId: number | null;
  deletingServiceId: number | null;
  editCarForm: EditCarFormState;
  editMileageEntryForm: typeof emptyEditMileageEntryForm;
  editServiceForm: typeof emptyEditServiceForm;
  editingMileageEntryId: number | null;
  editingServiceId: number | null;
  handleAddService: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  handleDeleteMileageEntry: (entryId: number) => Promise<void>;
  handleDeleteService: (serviceId: number) => Promise<void>;
  handleDeleteVehicle: () => Promise<void>;
  handleReminderAction: (carId: number, serviceType: string) => Promise<void>;
  handleSaveMileageEntryEdit: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  handleSaveServiceEdit: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  handleSaveVehicle: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  handleUpdateMileage: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  isDeletingVehicle: boolean;
  isSavingMileageEntry: boolean;
  isSavingService: boolean;
  isSavingVehicle: boolean;
  mileageForm: typeof emptyMileageForm;
  openVehicleInsightsPage: (carId: number) => void;
  onAddAppointment: (mode: "create" | "edit") => void;
  onAddRule: (mode: "create" | "edit") => void;
  onRemoveAppointment: (mode: "create" | "edit", index: number) => void;
  onRemoveRule: (mode: "create" | "edit", index: number) => void;
  onUpdateAppointment: (
    mode: "create" | "edit",
    index: number,
    field: keyof MaintenanceAppointmentForm,
    value: string
  ) => void;
  onUpdateRule: (
    mode: "create" | "edit",
    index: number,
    field: keyof ReminderRuleForm,
    value: string
  ) => void;
  serviceForm: typeof emptyServiceForm;
  startEditingMileageEntry: (entry: MileageHistoryItem) => void;
  startEditingService: (service: ServiceHistoryItem) => void;
  updateEditCarField: (
    field: keyof EditCarFormState,
    value: string | boolean | ReminderRuleForm[] | MaintenanceAppointmentForm[]
  ) => void;
  updateEditMileageEntryField: (
    field: keyof typeof emptyEditMileageEntryForm,
    value: string | boolean
  ) => void;
  updateEditServiceField: (field: keyof typeof emptyEditServiceForm, value: string) => void;
  updateMileageField: (field: keyof typeof emptyMileageForm, value: string | boolean) => void;
  updateServiceField: (field: keyof typeof emptyServiceForm, value: string) => void;
}) {
  const [showVehicleSettings, setShowVehicleSettings] = useState(false);
  const [serviceHistoryPage, setServiceHistoryPage] = useState(0);
  const [serviceHistoryPageSize, setServiceHistoryPageSize] = useState<PageSizeOption>(5);
  const [serviceHistorySort, setServiceHistorySort] = useState<SortDirection>("newest");
  const [mileageLogPage, setMileageLogPage] = useState(0);
  const [mileageLogPageSize, setMileageLogPageSize] = useState<PageSizeOption>(5);
  const [mileageLogSort, setMileageLogSort] = useState<SortDirection>("newest");
  const [showServiceNotes, setShowServiceNotes] = useState(false);
  const [serviceNotesPage, setServiceNotesPage] = useState(0);
  const [serviceNotesPageSize, setServiceNotesPageSize] = useState<PageSizeOption>(5);

  useEffect(() => {
    setShowVehicleSettings(false);
    setServiceHistoryPage(0);
    setServiceHistorySort("newest");
    setMileageLogPage(0);
    setMileageLogSort("newest");
    setShowServiceNotes(false);
    setServiceNotesPage(0);
  }, [car?.carId]);

  if (!car) {
    return (
      <section className="workspace-panel">
        <div className="empty-inline">Vehicle not found</div>
      </section>
    );
  }

  const sortedServiceHistory = [...car.serviceHistory].sort((left, right) => {
    const dateOrder = parseDisplayDate(left.date).getTime() - parseDisplayDate(right.date).getTime();
    const idOrder = left.serviceId - right.serviceId;
    const order = dateOrder || idOrder;

    return serviceHistorySort === "oldest" ? order : -order;
  });
  const visibleServiceHistory = getPagedItems(sortedServiceHistory, serviceHistoryPage, serviceHistoryPageSize);
  const sortedMileageLog = [...car.mileageHistory].sort((left, right) => {
    const dateOrder = parseDisplayDate(left.date).getTime() - parseDisplayDate(right.date).getTime();
    const idOrder = left.entryId - right.entryId;
    const order = dateOrder || idOrder;

    return mileageLogSort === "oldest" ? order : -order;
  });
  const visibleMileageLog = getPagedItems(sortedMileageLog, mileageLogPage, mileageLogPageSize);
  const serviceNotesList = sortedServiceHistory.map((service) => ({
    id: service.serviceId,
    label: `${service.date} - ${service.serviceType}`,
    text: service.notes || "N/A"
  }));
  const visibleServiceNotes = getPagedItems(serviceNotesList, serviceNotesPage, serviceNotesPageSize);

  return (
    <div className="content-stack">
      <section className="overview-grid compact-shell">
        <OverviewCard label="Current Mileage" value={`${car.currentMileage.toLocaleString("en-US")} mi`} />
        <OverviewCard label="Last Service" value={car.lastServiceDate} />
        <OverviewCard label="Service Records" value={String(car.serviceCount)} />
        <OverviewCard label="Lifetime Expenses" value={formatCurrency(car.lifetimeExpenses)} />
      </section>

      <section className="workspace-panel vehicle-summary-panel">
        <div className="workspace-panel-header">
          <div>
            <h2>{car.carName}</h2>
            <p>Service operations and mileage tracking</p>
          </div>
          <button className="btn btn-secondary" onClick={() => openVehicleInsightsPage(car.carId)} type="button">
            View Trends and Timeline
          </button>
        </div>
        {car.categoryReminders.length > 0 ? (
          <div className="reminder-rule-list">
            {car.categoryReminders.map((reminder) => (
              <ReminderStatusCard
                carId={car.carId}
                key={reminder.serviceType}
                onLogService={handleReminderAction}
                reminder={reminder}
              />
            ))}
          </div>
        ) : (
          <div className="empty-inline">No mileage-based reminders configured</div>
        )}
      </section>

      <div className="records-grid vehicle-action-grid">
        <section className="workspace-panel compact-panel">
          <div className="workspace-panel-header">
            <div>
              <h2>Update Mileage</h2>
              <p>Log an odometer reading.</p>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleUpdateMileage}>
            <input type="hidden" value={mileageForm.carId} />
            <div className="field-group">
              <label htmlFor="mileageValue">Mileage</label>
              <input
                id="mileageValue"
                min={mileageForm.allowCorrection ? 0 : car.currentMileage}
                onChange={(event) => updateMileageField("mileage", event.target.value)}
                required
                type="number"
                value={mileageForm.mileage}
              />
              <div className="field-hint">Current mileage is the default minimum.</div>
            </div>
            <div className="field-group">
              <label htmlFor="mileageNotes">Notes</label>
              <textarea
                id="mileageNotes"
                onChange={(event) => updateMileageField("notes", event.target.value)}
                rows={3}
                value={mileageForm.notes}
              />
            </div>
            <label className="checkbox-row">
              <input
                checked={mileageForm.allowCorrection}
                onChange={(event) => updateMileageField("allowCorrection", event.target.checked)}
                type="checkbox"
              />
              <span>Allow a lower mileage if this is a correction.</span>
            </label>
            <div className="action-row action-row-submit">
              <button className="btn btn-primary" type="submit">
                Save Mileage Entry
              </button>
            </div>
          </form>
        </section>

        <section className="workspace-panel compact-panel">
          <div className="workspace-panel-header">
            <div>
              <h2>Add Service</h2>
              <p>Record completed maintenance.</p>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleAddService}>
            <input type="hidden" value={serviceForm.carId} />
            <div className="field-row">
              <div className="field-group">
                <label htmlFor="serviceDate">Service Date</label>
                <input
                  id="serviceDate"
                  onChange={(event) => updateServiceField("serviceDate", event.target.value)}
                  required
                  type="date"
                  value={serviceForm.serviceDate}
                />
              </div>
              <div className="field-group">
                <label className="label-with-tooltip" htmlFor="serviceMileage">
                  Mileage at Service
                  <span className="info-tooltip" tabIndex={0}>
                    i
                    <span className="info-tooltip-text">Past lower mileage updates the car's history.</span>
                  </span>
                </label>
                <input
                  id="serviceMileage"
                  min="0"
                  onChange={(event) => updateServiceField("mileage", event.target.value)}
                  required
                  type="number"
                  value={serviceForm.mileage}
                />
              </div>
            </div>
            <div className="field-row">
              <div className="field-group">
                <label htmlFor="serviceType">Service Type</label>
                <select
                  id="serviceType"
                  onChange={(event) => updateServiceField("serviceType", event.target.value)}
                  value={serviceForm.serviceType}
                >
                  {serviceTypes.map((serviceType) => (
                    <option key={serviceType} value={serviceType}>
                      {serviceType}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-group">
                <label htmlFor="serviceCost">Cost</label>
                <div className="currency-input">
                  <span aria-hidden="true">$</span>
                  <input
                    id="serviceCost"
                    inputMode="decimal"
                    onChange={(event) => updateServiceField("cost", event.target.value)}
                    pattern="[0-9]*[.]?[0-9]*"
                    type="text"
                    value={serviceForm.cost}
                  />
                </div>
              </div>
            </div>
            <div className="field-group">
              <label htmlFor="serviceNotes">Notes</label>
              <textarea
                id="serviceNotes"
                onChange={(event) => updateServiceField("notes", event.target.value)}
                rows={3}
                value={serviceForm.notes}
              />
            </div>
            <div className="action-row action-row-submit">
              <button className="btn btn-primary" type="submit">
                Save Service Record
              </button>
            </div>
          </form>
        </section>
      </div>

      <div className="records-grid vehicle-records-grid">
        <section className="workspace-panel workspace-record-panel">
          <div className="workspace-panel-header">
            <div>
              <h2>Service History</h2>
              <p>Maintenance ledger</p>
            </div>
            <div className="history-toolbar">
              <button
                className="btn btn-inline"
                onClick={() => {
                  setServiceHistorySort((current) => (current === "newest" ? "oldest" : "newest"));
                  setServiceHistoryPage(0);
                }}
                type="button"
              >
                {serviceHistorySort === "newest" ? "Newest First" : "Oldest First"}
              </button>
            </div>
          </div>
          {car.serviceHistory.length === 0 ? (
            <div className="empty-inline">No service records yet</div>
          ) : (
            <table className={`workspace-table list-density-${serviceHistoryPageSize}`}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Mileage</th>
                  <th>Cost</th>
                  <th>
                    <span className="table-heading-action">
                      Notes
                      <button className="btn btn-inline" onClick={() => setShowServiceNotes(true)} type="button">
                        View All
                      </button>
                    </span>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleServiceHistory.items.map((service) => (
                  <tr key={service.serviceId}>
                    <td>{service.date}</td>
                    <td>{service.serviceType}</td>
                    <td>{service.mileage.toLocaleString("en-US")} mi</td>
                    <td>{formatCurrency(service.cost)}</td>
                    <td className="truncate-cell">{service.notes || "N/A"}</td>
                    <td className="table-actions">
                      <button className="btn btn-inline" onClick={() => startEditingService(service)} type="button">
                        Edit
                      </button>
                      <button
                        className="btn btn-inline-danger"
                        disabled={deletingServiceId === service.serviceId}
                        onClick={() => void handleDeleteService(service.serviceId)}
                        type="button"
                      >
                        {deletingServiceId === service.serviceId ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <ListPager
            page={visibleServiceHistory.page}
            pageCount={visibleServiceHistory.pageCount}
            pageSize={serviceHistoryPageSize}
            setPage={setServiceHistoryPage}
            setPageSize={setServiceHistoryPageSize}
          />

          {showServiceNotes ? (
            <div className="notes-popover" role="dialog" aria-modal="true" aria-label="Service notes">
              <div className="notes-popover-panel">
                <div className="workspace-panel-header">
                  <div>
                    <h2>Service Notes</h2>
                    <p>Full note text for service records</p>
                  </div>
                  <button className="btn btn-secondary" onClick={() => setShowServiceNotes(false)} type="button">
                    Close
                  </button>
                </div>
                <div className={`notes-popup-list list-density-${serviceNotesPageSize}`}>
                  {visibleServiceNotes.items.map((item) => (
                    <div className="notes-popup-row" key={item.id}>
                      <strong>{item.label}</strong>
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
                <ListPager
                  page={visibleServiceNotes.page}
                  pageCount={visibleServiceNotes.pageCount}
                  pageSize={serviceNotesPageSize}
                  setPage={setServiceNotesPage}
                  setPageSize={setServiceNotesPageSize}
                />
              </div>
            </div>
          ) : null}

          {editingServiceId !== null ? (
            <form className="form-grid inline-edit-form" onSubmit={handleSaveServiceEdit}>
              <div className="field-row">
                <div className="field-group">
                  <label htmlFor="editServiceDate">Service Date</label>
                  <input
                    id="editServiceDate"
                    onChange={(event) => updateEditServiceField("serviceDate", event.target.value)}
                    required
                    type="date"
                    value={editServiceForm.serviceDate}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="editServiceMileage">Mileage</label>
                  <input
                    id="editServiceMileage"
                    min="0"
                    onChange={(event) => updateEditServiceField("mileage", event.target.value)}
                    required
                    type="number"
                    value={editServiceForm.mileage}
                  />
                </div>
              </div>
              <div className="field-row">
                <div className="field-group">
                  <label htmlFor="editServiceType">Service Type</label>
                  <select
                    id="editServiceType"
                    onChange={(event) => updateEditServiceField("serviceType", event.target.value)}
                    value={editServiceForm.serviceType}
                  >
                    {serviceTypes.map((serviceType) => (
                      <option key={serviceType} value={serviceType}>
                        {serviceType}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="editServiceCost">Cost</label>
                  <div className="currency-input">
                    <span aria-hidden="true">$</span>
                    <input
                      id="editServiceCost"
                      inputMode="decimal"
                      onChange={(event) => updateEditServiceField("cost", event.target.value)}
                      pattern="[0-9]*[.]?[0-9]*"
                      type="text"
                      value={editServiceForm.cost}
                    />
                  </div>
                </div>
              </div>
              <div className="field-group">
                <label htmlFor="editServiceDescription">Description</label>
                <input
                  id="editServiceDescription"
                  onChange={(event) => updateEditServiceField("description", event.target.value)}
                  type="text"
                  value={editServiceForm.description}
                />
              </div>
              <div className="field-group">
                <label htmlFor="editServiceNotes">Notes</label>
                <textarea
                  id="editServiceNotes"
                  onChange={(event) => updateEditServiceField("notes", event.target.value)}
                  rows={3}
                  value={editServiceForm.notes}
                />
              </div>
              <div className="action-row">
                <button className="btn btn-primary" disabled={isSavingService} type="submit">
                  {isSavingService ? "Saving..." : "Save Service Changes"}
                </button>
                <button className="btn btn-secondary" onClick={cancelEditingService} type="button">
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </section>

        <section className="workspace-panel workspace-record-panel">
          <div className="workspace-panel-header">
            <div>
              <h2>Mileage Log</h2>
              <p>Odometer history</p>
            </div>
            <div className="history-toolbar">
              <button
                className="btn btn-inline"
                onClick={() => {
                  setMileageLogSort((current) => (current === "newest" ? "oldest" : "newest"));
                  setMileageLogPage(0);
                }}
                type="button"
              >
                {mileageLogSort === "newest" ? "Newest First" : "Oldest First"}
              </button>
            </div>
          </div>
          <table className={`workspace-table list-density-${mileageLogPageSize}`}>
            <thead>
              <tr>
                <th>Mileage</th>
                <th>Source</th>
                <th>Notes</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleMileageLog.items.map((entry) => (
                <tr key={entry.entryId}>
                  <td>{entry.mileage.toLocaleString("en-US")} mi</td>
                  <td>{formatSourceLabel(entry.source)}</td>
                  <td className="truncate-cell">{entry.notes || "N/A"}</td>
                  <td>{entry.updated}</td>
                  <td className="table-actions">
                    {entry.canEdit ? (
                      <button className="btn btn-inline" onClick={() => startEditingMileageEntry(entry)} type="button">
                        Edit
                      </button>
                    ) : null}
                    {entry.canDelete ? (
                      <button
                        className="btn btn-inline-danger"
                        disabled={deletingMileageEntryId === entry.entryId}
                        onClick={() => void handleDeleteMileageEntry(entry.entryId)}
                        type="button"
                      >
                        {deletingMileageEntryId === entry.entryId ? "Deleting..." : "Delete"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ListPager
            page={visibleMileageLog.page}
            pageCount={visibleMileageLog.pageCount}
            pageSize={mileageLogPageSize}
            setPage={setMileageLogPage}
            setPageSize={setMileageLogPageSize}
          />

          {editingMileageEntryId !== null ? (
            <form className="form-grid inline-edit-form" onSubmit={handleSaveMileageEntryEdit}>
              <div className="field-group">
                <label htmlFor="editMileageEntryValue">Mileage</label>
                <input
                  id="editMileageEntryValue"
                  min="0"
                  onChange={(event) => updateEditMileageEntryField("mileage", event.target.value)}
                  required
                  type="number"
                  value={editMileageEntryForm.mileage}
                />
              </div>
              <div className="field-group">
                <label htmlFor="editMileageEntryNotes">Notes</label>
                <textarea
                  id="editMileageEntryNotes"
                  onChange={(event) => updateEditMileageEntryField("notes", event.target.value)}
                  rows={3}
                  value={editMileageEntryForm.notes}
                />
              </div>
              <label className="checkbox-row">
                <input
                  checked={editMileageEntryForm.allowCorrection}
                  onChange={(event) => updateEditMileageEntryField("allowCorrection", event.target.checked)}
                  type="checkbox"
                />
                <span>Allow a lower mileage if this edit is a correction.</span>
              </label>
              <div className="action-row">
                <button className="btn btn-primary" disabled={isSavingMileageEntry} type="submit">
                  {isSavingMileageEntry ? "Saving..." : "Save Mileage Entry"}
                </button>
                <button className="btn btn-secondary" onClick={cancelEditingMileageEntry} type="button">
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </section>
      </div>

      <section className="workspace-panel workspace-settings-panel">
        <div className="workspace-panel-header">
          <div>
            <h2>Vehicle Settings</h2>
            <p>Profile and reminder configuration</p>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => setShowVehicleSettings((current) => !current)}
            type="button"
          >
            {showVehicleSettings ? "Hide Settings" : "Open Settings"}
          </button>
        </div>
        {showVehicleSettings ? (
          <form className="form-grid inline-unfold-form" onSubmit={handleSaveVehicle}>
            <div className="field-row">
              <div className="field-group">
                <label htmlFor="editMake">Make</label>
                <input
                  id="editMake"
                  onChange={(event) => updateEditCarField("make", event.target.value)}
                  required
                  type="text"
                  value={editCarForm.make}
                />
              </div>
              <div className="field-group">
                <label htmlFor="editModel">Model</label>
                <input
                  id="editModel"
                  onChange={(event) => updateEditCarField("model", event.target.value)}
                  required
                  type="text"
                  value={editCarForm.model}
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field-group">
                <label htmlFor="editYear">Year</label>
                <input
                  id="editYear"
                  min="1900"
                  onChange={(event) => updateEditCarField("year", event.target.value)}
                  required
                  type="number"
                  value={editCarForm.year}
                />
              </div>
              <div className="field-group">
                <label htmlFor="editMileage">Current Mileage</label>
                <input
                  id="editMileage"
                  min="0"
                  onChange={(event) => updateEditCarField("mileage", event.target.value)}
                  required
                  type="number"
                  value={editCarForm.mileage}
                />
              </div>
            </div>

            <div className="field-group">
              <div className="detail-section-heading field-subheading">
                <label htmlFor="editImageUrl">Image URL</label>
                <p>Optional</p>
              </div>
              <input
                id="editImageUrl"
                onChange={(event) => updateEditCarField("imageUrl", event.target.value)}
                type="text"
                value={editCarForm.imageUrl}
              />
            </div>

            <ReminderRuleEditor
              mode="edit"
              onAddRule={onAddRule}
              onRemoveRule={onRemoveRule}
              onUpdateRule={onUpdateRule}
              rules={editCarForm.serviceReminderRules}
            />

            <AppointmentEditor
              appointments={editCarForm.maintenanceAppointments}
              mode="edit"
              onAddAppointment={onAddAppointment}
              onRemoveAppointment={onRemoveAppointment}
              onUpdateAppointment={onUpdateAppointment}
            />

            <label className="checkbox-row">
              <input
                checked={editCarForm.allowMileageCorrection}
                onChange={(event) => updateEditCarField("allowMileageCorrection", event.target.checked)}
                type="checkbox"
              />
              <span>Allow a lower mileage if you are correcting a previous value.</span>
            </label>

            <div className="action-row">
              <button className="btn btn-primary" disabled={isSavingVehicle} type="submit">
                {isSavingVehicle ? "Saving..." : "Save Vehicle Changes"}
              </button>
              <button
                className="btn btn-danger"
                disabled={isDeletingVehicle}
                onClick={handleDeleteVehicle}
                type="button"
              >
                {isDeletingVehicle ? "Deleting..." : "Delete Vehicle"}
              </button>
            </div>
          </form>
        ) : (
          <div className="empty-inline">Settings are collapsed</div>
        )}
      </section>
    </div>
  );
}

function VehicleInsightsView({
  car,
  maxTrendDate,
  minTrendDate,
  serviceTypeOptions,
  setTrendDateFrom,
  setTrendDateTo,
  setTrendPreset,
  setTrendServiceTypeFilter,
  trendAverageMonthlyExpense,
  trendAverageMonthlyMileage,
  trendAverageMonthlyServiceFrequency,
  trendCategoryExpenses,
  trendDateFrom,
  trendDateTo,
  trendExpensePoints,
  trendMilesDriven,
  trendMileagePoints,
  trendServiceTypeFilter
}: {
  car: CarDetails | null;
  maxTrendDate: string;
  minTrendDate: string;
  serviceTypeOptions: string[];
  setTrendDateFrom: (value: string) => void;
  setTrendDateTo: (value: string) => void;
  setTrendPreset: (preset: TrendPreset) => void;
  setTrendServiceTypeFilter: (value: string) => void;
  trendAverageMonthlyExpense: number | null;
  trendAverageMonthlyMileage: number | null;
  trendAverageMonthlyServiceFrequency: number | null;
  trendCategoryExpenses: CategoryExpenseItem[];
  trendDateFrom: string;
  trendDateTo: string;
  trendExpensePoints: ChartPoint[];
  trendMilesDriven: number | null;
  trendMileagePoints: ChartPoint[];
  trendServiceTypeFilter: string;
}) {
  const [timelineSort, setTimelineSort] = useState<SortDirection>("newest");
  const [timelinePage, setTimelinePage] = useState(0);
  const [timelinePageSize, setTimelinePageSize] = useState<PageSizeOption>(5);

  if (!car) {
    return (
      <section className="workspace-panel">
        <div className="empty-inline">Vehicle not found</div>
      </section>
    );
  }

  const sortedTimeline = [...car.mileageHistory].sort((left, right) => {
    const dateOrder = parseDisplayDate(left.date).getTime() - parseDisplayDate(right.date).getTime();
    const idOrder = left.entryId - right.entryId;
    const order = dateOrder || idOrder;

    return timelineSort === "oldest" ? order : -order;
  });
  const visibleTimeline = getPagedItems(sortedTimeline, timelinePage, timelinePageSize);

  return (
    <div className="content-stack">
      <section className="overview-grid compact-shell">
        <OverviewCard
          helperText="Mileage added by odometer and service records in the selected window."
          label="Miles Added"
          value={trendMilesDriven === null ? "N/A" : `${formatNumber(trendMilesDriven)} mi`}
        />
        <OverviewCard
          label="Avg Monthly Miles"
          value={trendAverageMonthlyMileage === null ? "N/A" : `${formatNumber(trendAverageMonthlyMileage)} mi`}
        />
        <OverviewCard label="Avg Monthly Expense" value={formatCurrency(trendAverageMonthlyExpense)} />
        <OverviewCard
          label="Services / Month"
          value={trendAverageMonthlyServiceFrequency === null ? "N/A" : String(trendAverageMonthlyServiceFrequency)}
        />
      </section>

      <TrendFilterPanel
        dateFrom={trendDateFrom}
        dateTo={trendDateTo}
        maxDate={maxTrendDate}
        minDate={minTrendDate}
        onApply={(nextDateFrom, nextDateTo, nextServiceType) => {
          setTrendDateFrom(clampIsoDate(nextDateFrom, minTrendDate, maxTrendDate));
          setTrendDateTo(clampIsoDate(nextDateTo, minTrendDate, maxTrendDate));
          setTrendServiceTypeFilter(nextServiceType);
        }}
        onPreset={setTrendPreset}
        onServiceTypeChange={setTrendServiceTypeFilter}
        onSetDateFrom={setTrendDateFrom}
        onSetDateTo={setTrendDateTo}
        serviceType={trendServiceTypeFilter}
        serviceTypeOptions={serviceTypeOptions}
        title="Vehicle Trend Window"
      >
        <div className="trend-grid">
          <TimeSeriesChart
            emptyLabel="Mileage trends appear after multiple odometer entries."
            label="Miles Added"
            points={trendMileagePoints}
            suffix=" mi"
            yAxisLabel="Miles added"
            yCeilingMultiplier={1.5}
          />
          <TimeSeriesChart
            emptyLabel="Expense trends appear after priced service records."
            label="Total Spending"
            points={trendExpensePoints}
            prefix="$"
            yAxisLabel="Total spending"
          />
        </div>
      </TrendFilterPanel>

      <section className="workspace-panel">
        <div className="workspace-panel-header">
          <div>
            <h2>Expense by Category</h2>
            <p>Spend distribution by service type</p>
          </div>
        </div>
        {trendCategoryExpenses.length === 0 ? (
          <div className="empty-inline">No service costs match the current filters.</div>
        ) : (
          <div className="category-list">
            {trendCategoryExpenses.map((item) => (
              <CategoryExpenseCard item={item} key={item.category} />
            ))}
          </div>
        )}
      </section>

      <section className="workspace-panel">
        <div className="workspace-panel-header">
          <div>
            <h2>Mileage Timeline</h2>
            <p>Chronological odometer activity</p>
          </div>
          <div className="history-toolbar">
            <button
              className="btn btn-inline"
              onClick={() => {
                setTimelineSort((current) => (current === "newest" ? "oldest" : "newest"));
                setTimelinePage(0);
              }}
              type="button"
            >
              {timelineSort === "newest" ? "Newest First" : "Oldest First"}
            </button>
          </div>
        </div>
        <div className={`timeline-list list-density-${timelinePageSize}`}>
          {visibleTimeline.items.map((entry) => (
            <div className="timeline-card" key={entry.entryId}>
              <div className="timeline-top">
                <div className="timeline-date">{entry.date}</div>
                <div className="timeline-mileage">{entry.mileage.toLocaleString("en-US")} mi</div>
              </div>
              <div className="timeline-source">{formatSourceLabel(entry.source)}</div>
              <div className="timeline-notes truncate-text">{entry.notes || "N/A"}</div>
            </div>
          ))}
        </div>
        <ListPager
          page={visibleTimeline.page}
          pageCount={visibleTimeline.pageCount}
          pageSize={timelinePageSize}
          setPage={setTimelinePage}
          setPageSize={setTimelinePageSize}
        />
      </section>
    </div>
  );
}

function getPageMeta(view: DashboardView, selectedCar: CarDetails | null) {
  switch (view) {
    case "garage":
      return {
        title: "Garage",
        description: "Manage fleet records, service status, and vehicle insights."
      };
    case "new-vehicle":
      return {
        title: "Add Vehicle",
        description: "Create a vehicle profile for service and mileage tracking."
      };
    case "vehicle":
      return {
        title: selectedCar?.carName ?? "Vehicle Records",
        description: "Maintain service records, mileage entries, and reminder settings."
      };
    case "vehicle-insights":
      return {
        title: selectedCar ? `${selectedCar.carName} Insights` : "Vehicle Insights",
        description: "Review cost trends, mileage patterns, and service history."
      };
    case "services":
      return {
        title: "Fleet Analytics",
        description: "Monitor maintenance spend, activity, and fleet performance."
      };
    case "account":
      return {
        title: "Account",
        description: "Manage your profile and account reference details."
      };
    case "dashboard":
    default:
      return {
        title: "Dashboard",
        description: "Fleet health, expenses, and recent activity"
      };
  }
}

function ReminderRuleEditor({
  mode,
  onAddRule,
  onRemoveRule,
  onUpdateRule,
  rules
}: {
  mode: "create" | "edit";
  onAddRule: (mode: "create" | "edit") => void;
  onRemoveRule: (mode: "create" | "edit", index: number) => void;
  onUpdateRule: (
    mode: "create" | "edit",
    index: number,
    field: keyof ReminderRuleForm,
    value: string
  ) => void;
  rules: ReminderRuleForm[];
}) {
  const prefix = mode === "create" ? "create" : "edit";
  const canAddRule = rules.length < serviceTypes.length;

  return (
    <div className="field-group">
      <div className="detail-section-heading reminder-editor-heading">
        <div>
          <label>Mileage Reminders</label>
          <p>Configure mileage-based service intervals.</p>
        </div>
        <button
          className="btn btn-inline"
          disabled={!canAddRule}
          onClick={() => onAddRule(mode)}
          type="button"
        >
          Add Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="service-card">
          <div className="service-notes muted-text">No reminder intervals configured</div>
        </div>
      ) : (
        <div className="reminder-editor-list">
          {rules.map((rule, index) => (
            <div className="reminder-editor-card" key={`${mode}-${index}-${rule.serviceType}`}>
              <div className="field-row">
                <div className="field-group">
                  <label htmlFor={`${prefix}ReminderType-${index}`}>Service Category</label>
                  <select
                    id={`${prefix}ReminderType-${index}`}
                    onChange={(event) =>
                      onUpdateRule(mode, index, "serviceType", event.target.value)
                    }
                    value={rule.serviceType}
                  >
                    {serviceTypes.map((serviceType) => (
                      <option key={serviceType} value={serviceType}>
                        {serviceType}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor={`${prefix}ReminderMiles-${index}`}>Interval Mileage</label>
                  <input
                    id={`${prefix}ReminderMiles-${index}`}
                    min="1"
                    onChange={(event) =>
                      onUpdateRule(mode, index, "intervalMiles", event.target.value)
                    }
                    required
                    type="number"
                    value={rule.intervalMiles}
                  />
                </div>
              </div>

              <div className="field-group reminder-editor-actions">
                  <span className="reminder-rule-hint">
                    {rule.serviceType} will be tracked against its latest matching service record.
                  </span>
                  <button
                    className="btn btn-inline-danger"
                    onClick={() => onRemoveRule(mode, index)}
                    type="button"
                  >
                    Remove Rule
                  </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function __REMOVE_ReminderWatchGroup() {
  return null;
  /*
    <div className="watch-group">
      <div className="watch-group-header">
        <h3>{label}</h3>
        <span className={`comparison-status ${label === "Overdue" ? "warning" : "due-soon"}`}>
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="service-card">
          <div className="service-notes muted-text">{emptyLabel}</div>
        </div>
      ) : (
        items.map((item) => (
          <div className="panel-item panel-item-static" key={`${item.carId}-${item.serviceType}`}>
            <div className="panel-item-title">
              {item.carName} · {item.serviceType}
            </div>
            <div className="panel-item-copy">{item.reason}</div>
            <div className="panel-item-meta">
              <span>{item.currentMileage.toLocaleString("en-US")} mi</span>
              <span>Last service {item.lastServiceDate}</span>
              <span>
                {item.milesUntilDue === null ? "Mileage target N/A" : `${item.milesUntilDue.toLocaleString("en-US")} mi left`}
              </span>
            </div>
            <div className="action-row">
              <button className="btn btn-inline" onClick={() => void onOpenCar(item.carId)} type="button">
                Open Vehicle
              </button>
              <button
                className="btn btn-inline-danger"
                onClick={() => void onLogService(item.carId, item.serviceType)}
                type="button"
              >
                Log {item.serviceType}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
  */
}

function AppointmentEditor({
  appointments,
  mode,
  onAddAppointment,
  onRemoveAppointment,
  onUpdateAppointment
}: {
  appointments: MaintenanceAppointmentForm[];
  mode: "create" | "edit";
  onAddAppointment: (mode: "create" | "edit") => void;
  onRemoveAppointment: (mode: "create" | "edit", index: number) => void;
  onUpdateAppointment: (
    mode: "create" | "edit",
    index: number,
    field: keyof MaintenanceAppointmentForm,
    value: string
  ) => void;
}) {
  const prefix = mode === "create" ? "create" : "edit";

  return (
    <div className="field-group">
      <div className="detail-section-heading reminder-editor-heading">
        <div>
          <label>Maintenance Appointments</label>
          <p>Schedule upcoming service dates.</p>
        </div>
        <button className="btn btn-inline" onClick={() => onAddAppointment(mode)} type="button">
          Add Appointment
        </button>
      </div>

      {appointments.length === 0 ? (
        <div className="service-card">
          <div className="service-notes muted-text">No appointments scheduled</div>
        </div>
      ) : (
        <div className="reminder-editor-list">
          {appointments.map((appointment, index) => (
            <div className="reminder-editor-card" key={`${mode}-appointment-${appointment.appointmentId}-${index}`}>
              <div className="field-row">
                <div className="field-group">
                  <label htmlFor={`${prefix}AppointmentType-${index}`}>Service Category</label>
                  <select
                    id={`${prefix}AppointmentType-${index}`}
                    onChange={(event) => onUpdateAppointment(mode, index, "serviceType", event.target.value)}
                    value={appointment.serviceType}
                  >
                    {serviceTypes.map((serviceType) => (
                      <option key={serviceType} value={serviceType}>
                        {serviceType}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor={`${prefix}AppointmentDate-${index}`}>Appointment Date</label>
                  <input
                    id={`${prefix}AppointmentDate-${index}`}
                    onChange={(event) => onUpdateAppointment(mode, index, "date", event.target.value)}
                    required
                    type="date"
                    value={appointment.date}
                  />
                </div>
              </div>
              <div className="field-group">
                <label htmlFor={`${prefix}AppointmentNotes-${index}`}>Notes</label>
                <input
                  id={`${prefix}AppointmentNotes-${index}`}
                  onChange={(event) => onUpdateAppointment(mode, index, "notes", event.target.value)}
                  type="text"
                  value={appointment.notes}
                />
              </div>
              <button className="btn btn-inline-danger" onClick={() => onRemoveAppointment(mode, index)} type="button">
                Remove Appointment
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReminderStatusCard({
  carId,
  onLogService,
  reminder
}: {
  carId: number;
  onLogService: (carId: number, serviceType: string) => Promise<void>;
  reminder: CategoryReminderItem;
}) {
  return (
    <div className={`reminder-rule-card ${reminder.needsAttention ? "warning" : "ok"}`}>
      <div className="reminder-rule-top">
        <div>
          <div className="reminder-rule-title">{reminder.serviceType}</div>
          <div className="reminder-rule-copy">
            Every {reminder.intervalMiles.toLocaleString("en-US")} miles
          </div>
        </div>
        <div className={`comparison-status ${reminder.needsAttention ? "warning" : "ok"}`}>
          {reminder.isOverdue ? "Overdue" : reminder.needsAttention ? "Due Soon" : "On Schedule"}
        </div>
      </div>

      <div className="reminder-rule-status">
        {reminder.reason ?? `${reminder.serviceType} is currently on schedule.`}
      </div>

      <div className="reminder-meta">
        <span>
          Last service:{" "}
          {reminder.latestServiceDate === null
            ? "No matching service record"
            : `${reminder.latestServiceDate} at ${reminder.latestServiceMileage?.toLocaleString("en-US") ?? "N/A"} mi`}
        </span>
        <span>
          Next mileage target:{" "}
          {reminder.nextServiceMileage === null ? "N/A" : `${reminder.nextServiceMileage.toLocaleString("en-US")} mi`}
        </span>
        <span>
          Miles until due:{" "}
          {reminder.milesUntilDue === null ? "N/A" : `${reminder.milesUntilDue.toLocaleString("en-US")} mi`}
        </span>
      </div>

      {reminder.needsAttention ? (
        <div className="action-row reminder-action-row">
          <button
            className="btn btn-inline-danger"
            onClick={() => void onLogService(carId, reminder.serviceType)}
            type="button"
          >
            Log {reminder.serviceType}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MileageEntryCard({
  deletingMileageEntryId,
  entry,
  handleDeleteMileageEntry,
  startEditingMileageEntry
}: {
  deletingMileageEntryId: number | null;
  entry: MileageHistoryItem;
  handleDeleteMileageEntry: (entryId: number) => Promise<void>;
  startEditingMileageEntry: (entry: MileageHistoryItem) => void;
}) {
  return null;
  /*
    <div className="timeline-card">
      <div className="timeline-top">
        <div className="timeline-date">{entry.date}</div>
        <div className="timeline-actions">
          <div className="timeline-mileage">{entry.mileage.toLocaleString("en-US")} mi</div>
          {entry.canEdit ? (
            <button className="btn btn-inline" onClick={() => startEditingMileageEntry(entry)} type="button">
              Edit
            </button>
          ) : null}
          {entry.canDelete ? (
            <button
              className="btn btn-inline-danger"
              disabled={deletingMileageEntryId === entry.entryId}
              onClick={() => void handleDeleteMileageEntry(entry.entryId)}
              type="button"
            >
              {deletingMileageEntryId === entry.entryId ? "Deleting..." : "Delete"}
            </button>
          ) : null}
        </div>
      </div>
      <div className="timeline-source">{formatSourceLabel(entry.source)}</div>
      <div className="timeline-notes">{entry.notes}</div>
    </div>
  );
  */
}

function TrendFilterPanel({
  children,
  dateFrom,
  dateTo,
  maxDate,
  minDate,
  onApply,
  onPreset,
  onServiceTypeChange,
  onSetDateFrom,
  onSetDateTo,
  serviceType,
  serviceTypeOptions,
  title
}: {
  children: ReactNode;
  dateFrom: string;
  dateTo: string;
  maxDate: string;
  minDate: string;
  onApply: (dateFrom: string, dateTo: string, serviceType: string) => void;
  onPreset: (preset: TrendPreset) => void;
  onServiceTypeChange: (value: string) => void;
  onSetDateFrom: (value: string) => void;
  onSetDateTo: (value: string) => void;
  serviceType: string;
  serviceTypeOptions: string[];
  title: string;
}) {
  const [draftDateFrom, setDraftDateFrom] = useState(dateFrom);
  const [draftDateTo, setDraftDateTo] = useState(dateTo);
  const [draftServiceType, setDraftServiceType] = useState(serviceType);

  useEffect(() => {
    setDraftDateFrom(dateFrom);
    setDraftDateTo(dateTo);
    setDraftServiceType(serviceType);
  }, [dateFrom, dateTo, serviceType]);

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply(draftDateFrom, draftDateTo, draftServiceType);
  }

  return (
    <section className="workspace-panel">
      <div className="workspace-panel-header">
        <div>
          <h2>{title}</h2>
          <p>Focus the reporting window.</p>
        </div>
      </div>
      <div className="trend-preset-row" aria-label="Trend window presets">
        <button className="btn btn-inline" onClick={() => onPreset("month")} type="button">
          Month
        </button>
        <button className="btn btn-inline" onClick={() => onPreset("quarter")} type="button">
          Quarter
        </button>
        <button className="btn btn-inline" onClick={() => onPreset("year")} type="button">
          Year
        </button>
        <button className="btn btn-inline" onClick={() => onPreset("ytd")} type="button">
          YTD
        </button>
        <button className="btn btn-inline" onClick={() => onPreset("all")} type="button">
          All Time
        </button>
      </div>
      <form className="toolbar-grid" onSubmit={handleSubmit}>
        <div className="field-group">
          <label htmlFor={`${title}-trendDateFrom`}>From Date</label>
          <input
            id={`${title}-trendDateFrom`}
            max={maxDate}
            min={minDate}
            onChange={(event) => setDraftDateFrom(event.target.value)}
            type="date"
            value={draftDateFrom}
          />
        </div>
        <div className="field-group">
          <label htmlFor={`${title}-trendDateTo`}>To Date</label>
          <input
            id={`${title}-trendDateTo`}
            max={maxDate}
            min={minDate}
            onChange={(event) => setDraftDateTo(event.target.value)}
            type="date"
            value={draftDateTo}
          />
        </div>
        <div className="field-group">
          <label htmlFor={`${title}-trendServiceType`}>Service Category</label>
          <select
            id={`${title}-trendServiceType`}
            onChange={(event) => setDraftServiceType(event.target.value)}
            value={draftServiceType}
          >
            <option value="all">All categories</option>
            {serviceTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="field-group trend-apply-group">
          <label aria-hidden="true">&nbsp;</label>
          <button className="btn btn-primary" type="submit">
            Apply Window
          </button>
        </div>
      </form>
      {children}
    </section>
  );
}

function TimeSeriesChart({
  emptyLabel,
  label,
  points,
  prefix = "",
  suffix = "",
  yAxisLabel,
  yCeilingMultiplier = 1.15
}: {
  emptyLabel: string;
  label: string;
  points: ChartPoint[];
  prefix?: string;
  suffix?: string;
  yAxisLabel: string;
  yCeilingMultiplier?: number;
}) {
  const chart = buildLineChart(points, yCeilingMultiplier);
  const latestPoint = [...points].reverse().find((point) => point.value !== null) ?? null;
  const hasPlottedData = chart.points.length > 0;
  const windowLabel = formatChartWindow(points);

  return (
    <div className="trend-card">
      <div className="trend-card-heading">
        <div className="trend-card-title">{label}</div>
        {latestPoint?.value !== null && latestPoint?.value !== undefined ? (
          <div className="trend-card-latest">{formatTrendHeaderValue(latestPoint.value, prefix, suffix)}</div>
        ) : null}
      </div>
      {points.length === 0 ? (
        <div className="muted-text">{emptyLabel}</div>
      ) : (
        <div className="line-chart">
          <div className="line-chart-y-title">{yAxisLabel}</div>
          <svg aria-label={label} preserveAspectRatio="none" role="img" viewBox="0 0 640 260">
            {chart.ticks.map((tick) => (
              <g key={tick.value}>
                <line className="line-chart-grid" x1={chart.left} x2={chart.right} y1={tick.y} y2={tick.y} />
                <text className="line-chart-tick-label" x={chart.left - 10} y={tick.y + 4}>
                  {formatTrendValue(tick.value, prefix, suffix)}
                </text>
              </g>
            ))}
            <line className="line-chart-axis" x1={chart.left} x2={chart.left} y1={chart.top} y2={chart.bottom} />
            <line className="line-chart-axis" x1={chart.left} x2={chart.right} y1={chart.bottom} y2={chart.bottom} />
            {chart.linePath ? <path className="line-chart-line" d={chart.linePath} /> : null}
            {chart.points.map((point) => (
              <circle className="line-chart-point" cx={point.x} cy={point.y} key={point.label} r="4" />
            ))}
          </svg>
          {!hasPlottedData ? <div className="line-chart-empty">No records in this window</div> : null}
          <div className="line-chart-window">{windowLabel}</div>
        </div>
      )}
    </div>
  );
}

function CategoryExpenseCard({ item }: { item: CategoryExpenseItem }) {
  return (
    <div className="category-card">
      <div>
        <div className="category-title">{item.category}</div>
        <div className="category-meta">{item.count} service records</div>
      </div>
      <div className="category-value">{formatCurrency(item.totalCost)}</div>
    </div>
  );
}

function ListPager({
  page,
  pageCount,
  pageSize,
  setPage,
  setPageSize
}: {
  page: number;
  pageCount: number;
  pageSize: PageSizeOption;
  setPage: (page: number) => void;
  setPageSize: (pageSize: PageSizeOption) => void;
}) {
  return (
    <div className="list-pager">
      <div className="section-pager">
        <button
          className="btn btn-inline"
          disabled={page === 0}
          onClick={() => setPage(Math.max(0, page - 1))}
          type="button"
        >
          Prev
        </button>
        <span className="section-pager-label">
          {page + 1} / {pageCount}
        </span>
        <button
          className="btn btn-inline"
          disabled={page >= pageCount - 1}
          onClick={() => setPage(Math.min(pageCount - 1, page + 1))}
          type="button"
        >
          Next
        </button>
      </div>
      <label className="page-size-control">
        Rows
        <select
          onChange={(event) => {
            setPageSize(Number(event.target.value) as PageSizeOption);
            setPage(0);
          }}
          value={pageSize}
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function getPagedItems<T>(items: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const activePage = Math.min(page, pageCount - 1);

  return {
    items: items.slice(activePage * pageSize, activePage * pageSize + pageSize),
    page: activePage,
    pageCount
  };
}

function buildMileageAdditionTrend(
  records: TrendMileageRecord[],
  dateFrom: Date | null = null,
  dateTo: Date | null = null
): TrendPoint[] {
  const sorted = [...records].sort((left, right) => left.date.getTime() - right.date.getTime());
  const points = new Map<string, { label: string; value: number }>();

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const record = sorted[index];
    if (!isDateInWindow(record.date, dateFrom, dateTo)) {
      continue;
    }

    const delta = Math.max(0, record.mileage - previous.mileage);
    const bucket = getMonthBucket(record.date);
    const current = points.get(bucket.sortKey);
    points.set(bucket.sortKey, {
      label: bucket.label,
      value: (current?.value ?? 0) + delta
    });
  }

  let runningTotal = 0;
  return [...points.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, point]) => {
      runningTotal += point.value;
      return {
        label: point.label,
        value: roundDisplayNumber(runningTotal)
      };
    });
}

function buildFleetMileageAdditionTrend(
  records: TrendMileageRecord[],
  dateFrom: Date | null = null,
  dateTo: Date | null = null
): TrendPoint[] {
  const byVehicle = groupMileageByVehicle(records);
  const monthlyTotals = new Map<string, { label: string; value: number }>();

  for (const vehicleRecords of byVehicle.values()) {
    const sorted = [...vehicleRecords].sort((left, right) => left.date.getTime() - right.date.getTime());
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const record = sorted[index];
      if (!isDateInWindow(record.date, dateFrom, dateTo)) {
        continue;
      }

      const bucket = getMonthBucket(record.date);
      const current = monthlyTotals.get(bucket.sortKey);
      monthlyTotals.set(bucket.sortKey, {
        label: bucket.label,
        value: (current?.value ?? 0) + Math.max(0, record.mileage - previous.mileage)
      });
    }
  }

  let runningTotal = 0;
  return [...monthlyTotals.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, point]) => {
    runningTotal += point.value;
    return {
      label: point.label,
      value: roundDisplayNumber(runningTotal)
    };
  });
}

function buildCumulativeExpenseTrend(records: TrendServiceRecord[]): TrendPoint[] {
  const sorted = [...records]
    .filter((record): record is TrendServiceRecord & { cost: number } => record.cost !== null)
    .sort((left, right) => left.date.getTime() - right.date.getTime());
  const monthlyTotals = new Map<string, { label: string; value: number }>();

  for (const record of sorted) {
    const bucket = getMonthBucket(record.date);
    const current = monthlyTotals.get(bucket.sortKey);
    monthlyTotals.set(bucket.sortKey, {
      label: bucket.label,
      value: (current?.value ?? 0) + record.cost
    });
  }

  let runningTotal = 0;
  return [...monthlyTotals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, point]) => {
      runningTotal += point.value;
      return {
        label: point.label,
        value: roundDisplayNumber(runningTotal)
      };
    });
}

function calculateMileageAddedInWindow(
  records: TrendMileageRecord[],
  dateFrom: Date | null = null,
  dateTo: Date | null = null
) {
  const sorted = [...records].sort((left, right) => left.date.getTime() - right.date.getTime());
  if (sorted.length < 2) {
    return null;
  }

  let total = 0;
  let hasMileage = false;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const record = sorted[index];
    if (!isDateInWindow(record.date, dateFrom, dateTo)) {
      continue;
    }

    total += Math.max(0, record.mileage - previous.mileage);
    hasMileage = true;
  }

  return hasMileage ? roundDisplayNumber(total) : null;
}

function calculateFleetMilesDriven(
  records: TrendMileageRecord[],
  dateFrom: Date | null = null,
  dateTo: Date | null = null
) {
  const byVehicle = groupMileageByVehicle(records);
  let total = 0;
  let hasDrivenMiles = false;

  for (const vehicleRecords of byVehicle.values()) {
    const milesDriven = calculateMileageAddedInWindow(vehicleRecords, dateFrom, dateTo);
    if (milesDriven !== null) {
      total += milesDriven;
      hasDrivenMiles = true;
    }
  }

  return hasDrivenMiles ? total : null;
}

function calculateAverageMonthlyMileageInWindow(
  records: TrendMileageRecord[],
  dateFrom: Date | null = null,
  dateTo: Date | null = null
) {
  const milesAdded = calculateMileageAddedInWindow(records, dateFrom, dateTo);
  if (milesAdded === null) {
    return null;
  }

  const bounds = getMileageWindowBounds(records, dateFrom, dateTo);
  if (!bounds) {
    return null;
  }

  return Math.round(milesAdded / countInclusiveTrendMonths(bounds.start, bounds.end));
}

function calculateFleetAverageMonthlyMileage(
  records: TrendMileageRecord[],
  dateFrom: Date | null = null,
  dateTo: Date | null = null
) {
  const milesAdded = calculateFleetMilesDriven(records, dateFrom, dateTo);
  if (milesAdded === null) {
    return null;
  }

  const bounds = getMileageWindowBounds(records, dateFrom, dateTo);
  if (!bounds) {
    return null;
  }

  return Math.round(milesAdded / countInclusiveTrendMonths(bounds.start, bounds.end));
}

function groupMileageByVehicle(records: TrendMileageRecord[]) {
  const groups = new Map<number | string, TrendMileageRecord[]>();

  for (const record of records) {
    const key = record.carId ?? record.carName ?? "fleet";
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  return groups;
}

function isDateInWindow(date: Date, dateFrom: Date | null, dateTo: Date | null) {
  if (dateFrom && date.getTime() < dateFrom.getTime()) {
    return false;
  }

  if (dateTo && date.getTime() > dateTo.getTime()) {
    return false;
  }

  return true;
}

function getMileageWindowBounds(records: TrendMileageRecord[], dateFrom: Date | null, dateTo: Date | null) {
  const sorted = [...records].sort((left, right) => left.date.getTime() - right.date.getTime());
  if (sorted.length === 0) {
    return null;
  }

  const firstWindowRecord = sorted.find((record) => isDateInWindow(record.date, dateFrom, dateTo));
  if (!firstWindowRecord) {
    return null;
  }

  const lastWindowRecord = [...sorted].reverse().find((record) => isDateInWindow(record.date, dateFrom, dateTo));
  return {
    start: dateFrom ?? firstWindowRecord.date,
    end: dateTo ?? lastWindowRecord?.date ?? firstWindowRecord.date
  };
}

function toWindowedChartPoints(points: TrendPoint[], dateFrom: string, dateTo: string): ChartPoint[] {
  if (!dateFrom && !dateTo) {
    return points;
  }

  const pointMap = new Map(points.map((point) => [getMonthKeyFromLabel(point.label), point.value]));
  const start = dateFrom ? parseIsoDateValue(dateFrom) : getFirstTrendMonth(points);
  const end = dateTo ? parseIsoDateValue(dateTo) : getLastTrendMonth(points);

  if (!start || !end || start.getTime() > end.getTime()) {
    return points;
  }

  const windowedPoints: ChartPoint[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor.getTime() <= endMonth.getTime()) {
    const sortKey = getMonthSortKey(cursor);
    const explicitValue = pointMap.get(sortKey);
    const isFutureMonth = cursor.getTime() > getMonthStart(parseIsoDateValue(todayIso())).getTime();
    const previousValue = windowedPoints[windowedPoints.length - 1]?.value ?? null;
    windowedPoints.push({
      label: getMonthLabel(cursor),
      value: explicitValue ?? (isFutureMonth ? null : previousValue)
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return windowedPoints;
}

function buildLineChart(points: ChartPoint[], yCeilingMultiplier: number) {
  const left = 82;
  const right = 610;
  const top = 26;
  const bottom = 222;
  const values = points.map((point) => point.value).filter((value): value is number => value !== null);
  const rawMinValue = values.length ? Math.min(...values) : 0;
  const rawMaxValue = values.length ? Math.max(...values) : 0;
  const minValue = 0;
  const maxValue = getAxisMaximum(rawMaxValue, yCeilingMultiplier);
  const ticks = buildYAxisTicks(minValue, maxValue, top, bottom);
  const range = Math.max(1, maxValue - minValue);
  const plottedPoints = points.map((point, index) => {
    const x = points.length === 1 ? (left + right) / 2 : left + (index / (points.length - 1)) * (right - left);
    const y = point.value === null ? null : bottom - ((point.value - minValue) / range) * (bottom - top);

    return { ...point, x, y };
  });
  const visiblePoints = plottedPoints.filter((point): point is typeof point & { y: number } => point.y !== null);
  const linePath =
    visiblePoints.length === 1
      ? `M ${Math.max(left, visiblePoints[0].x - 28)} ${visiblePoints[0].y} L ${Math.min(
          right,
          visiblePoints[0].x + 28
        )} ${visiblePoints[0].y}`
      : plottedPoints
          .map((point) => (point.y === null ? null : `${point.x} ${point.y}`))
          .reduce<{ commands: string[]; isNewSegment: boolean }>(
            (state, coords) => {
              if (coords === null) {
                return { ...state, isNewSegment: true };
              }

              return {
                commands: [...state.commands, `${state.isNewSegment ? "M" : "L"} ${coords}`],
                isNewSegment: false
              };
            },
            { commands: [], isNewSegment: true }
          ).commands.join(" ");

  return {
    bottom,
    left,
    linePath,
    maxValue,
    minValue,
    points: visiblePoints,
    right,
    ticks,
    top
  };
}

function OverviewCard({
  helperText,
  label,
  meta,
  value
}: {
  helperText?: string;
  label: string;
  meta?: string;
  value: string;
}) {
  return (
    <div className="overview-card">
      <div className="overview-label">
        {label}
        {helperText ? (
          <span className="info-tooltip" tabIndex={0}>
            i
            <span className="info-tooltip-text">{helperText}</span>
          </span>
        ) : null}
      </div>
      <div className="overview-value">{value}</div>
      {meta ? <div className="overview-meta">{meta}</div> : null}
    </div>
  );
}

function MaintenanceOverviewCard({
  currentPage,
  dueSoonCount,
  flaggedVehicleNames,
  helperText,
  onPageChange,
  overdueCount
}: {
  currentPage: number;
  dueSoonCount: number;
  flaggedVehicleNames: string[];
  helperText: string;
  onPageChange: (page: number) => void;
  overdueCount: number;
}) {
  const pageSize = 3;
  const pageCount = Math.max(1, Math.ceil(flaggedVehicleNames.length / pageSize));
  const activePage = Math.min(currentPage, pageCount - 1);
  const visibleVehicles = flaggedVehicleNames.slice(activePage * pageSize, activePage * pageSize + pageSize);
  const vehicleLabel = flaggedVehicleNames.length === 1 ? "vehicle" : "vehicles";

  return (
    <div className="overview-card">
      <div className="overview-label">
        Maintenance Watch
        <span className="info-tooltip" tabIndex={0}>
          i
          <span className="info-tooltip-text">{helperText}</span>
        </span>
      </div>
      {flaggedVehicleNames.length === 0 ? (
        <>
          <div className="overview-value">Service up to date</div>
          <div className="overview-meta">All vehicles are current</div>
        </>
      ) : (
        <>
          <div className="overview-value">
            {flaggedVehicleNames.length} {vehicleLabel}
          </div>
          <div className="overview-vehicle-list">
            {visibleVehicles.map((vehicleName) => (
              <span className="overview-vehicle-pill" key={vehicleName}>
                {vehicleName}
              </span>
            ))}
          </div>
          <div className="overview-meta">{dueSoonCount} due soon / {overdueCount} overdue</div>
          {pageCount > 1 ? (
            <div className="overview-pager">
              <button
                className="btn btn-inline"
                disabled={activePage === 0}
                onClick={() => onPageChange(Math.max(0, activePage - 1))}
                type="button"
              >
                Prev
              </button>
              <span className="section-pager-label">{activePage + 1} / {pageCount}</span>
              <button
                className="btn btn-inline"
                disabled={activePage >= pageCount - 1}
                onClick={() => onPageChange(Math.min(pageCount - 1, activePage + 1))}
                type="button"
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function HighlightCard({ label, subtitle, title }: { label: string; subtitle: string; title: string }) {
  return (
    <div className="highlight-card">
      <div className="highlight-label">{label}</div>
      <div className="highlight-title">{title}</div>
      <div className="highlight-subtitle">{subtitle}</div>
    </div>
  );
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2
  }).format(value);
}

function formatProfileDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC" }).format(new Date(value));
}

function createReminderRuleForm(existingRules: ReminderRuleForm[] = []): ReminderRuleForm {
  const nextServiceType =
    serviceTypes.find(
      (serviceType) => !existingRules.some((rule) => rule.serviceType === serviceType)
    ) ?? serviceTypes[0];

  return {
    intervalDays: "180",
    intervalMiles: "5000",
    serviceType: nextServiceType
  };
}

function createAppointmentForm(): MaintenanceAppointmentForm {
  return {
    appointmentId: 0,
    date: todayIso(),
    notes: "",
    serviceType: serviceTypes[0]
  };
}

function toReminderRuleForm(rule: ServiceReminderRule): ReminderRuleForm {
  return {
    intervalDays: String(rule.intervalDays),
    intervalMiles: String(rule.intervalMiles),
    serviceType: rule.serviceType
  };
}

function serializeReminderRuleForms(rules: ReminderRuleForm[]): ServiceReminderRule[] {
  return rules.map((rule) => ({
    intervalDays: Number(rule.intervalDays),
    intervalMiles: Number(rule.intervalMiles),
    serviceType: rule.serviceType
  }));
}

function toAppointmentForm(appointment: MaintenanceAppointment): MaintenanceAppointmentForm {
  return {
    appointmentId: appointment.appointmentId,
    date: appointment.date,
    notes: appointment.notes,
    serviceType: appointment.serviceType
  };
}

function serializeAppointmentForms(appointments: MaintenanceAppointmentForm[]): MaintenanceAppointment[] {
  return appointments.map((appointment) => ({
    appointmentId: appointment.appointmentId,
    date: appointment.date,
    notes: appointment.notes,
    serviceType: appointment.serviceType
  }));
}

function groupAttentionItems(items: AttentionItem[]) {
  const groups = new Map<number, { carId: number; carName: string; items: AttentionItem[] }>();

  for (const item of items) {
    const current = groups.get(item.carId);
    if (current) {
      current.items.push(item);
    } else {
      groups.set(item.carId, { carId: item.carId, carName: item.carName, items: [item] });
    }
  }

  return [...groups.values()];
}

function getFleetMileageTimelineRows(records: FleetInsightRecord[], sortDirection: "newest" | "oldest") {
  return records
    .flatMap((car) =>
      car.mileageHistory.map((entry) => ({
        carId: car.carId,
        carName: car.carName,
        date: entry.date,
        entryId: entry.entryId,
        mileage: entry.mileage,
        notes: entry.notes,
        source: entry.source
      }))
    )
    .sort((left, right) => {
      const order = parseDisplayDate(left.date).getTime() - parseDisplayDate(right.date).getTime();
      return sortDirection === "oldest" ? order : -order;
    });
}

function getLatestChartValue(points: ChartPoint[]) {
  return [...points].reverse().find((point) => point.value !== null)?.value ?? null;
}

function formatDateForServiceApi(value: string) {
  const trimmed = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    return `${isoMatch[2]}/${isoMatch[3]}/${isoMatch[1].slice(-2)}`;
  }

  return trimmed;
}

function formatDateForInput(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const displayMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(trimmed);
  if (!displayMatch) {
    return todayIso();
  }

  const year = displayMatch[3].length === 2 ? `20${displayMatch[3]}` : displayMatch[3];
  return `${year}-${displayMatch[1].padStart(2, "0")}-${displayMatch[2].padStart(2, "0")}`;
}

function parseDisplayDate(value: string) {
  const [month, day, year] = value.split("/");
  return new Date(Date.UTC(2000 + Number(year), Number(month) - 1, Number(day)));
}

function parseIsoDateValue(value: string) {
  const [year, month, day] = value.split("-");
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function getVehicleTrendMinDate(car: CarDetails) {
  const recordDates = [
    car.createdAt,
    ...car.serviceHistory.map((service) => formatDateForInput(service.date)),
    ...car.mileageHistory.map((entry) => formatDateForInput(entry.date))
  ];

  return getEarliestIsoDate(recordDates) ?? car.createdAt;
}

function getFleetTrendMinDate(records: FleetInsightRecord[]) {
  return getEarliestIsoDate(
    records.flatMap((car) => [
      car.createdAt,
      ...car.serviceHistory.map((service) => formatDateForInput(service.date)),
      ...car.mileageHistory.map((entry) => formatDateForInput(entry.date))
    ])
  );
}

function applyTrendPreset(
  preset: TrendPreset,
  setDateFrom: (value: string) => void,
  setDateTo: (value: string) => void,
  minDate: string,
  maxDate: string
) {
  const today = parseIsoDateValue(todayIso());
  const dateTo = clampIsoDate(toIsoDate(today), minDate, maxDate);
  let dateFrom = minDate;

  if (preset === "month") {
    dateFrom = toIsoDate(getMonthStart(today));
  } else if (preset === "quarter") {
    dateFrom = toIsoDate(getMonthStart(addMonths(today, -2)));
  } else if (preset === "year") {
    dateFrom = toIsoDate(getMonthStart(addMonths(today, -11)));
  } else if (preset === "ytd") {
    dateFrom = `${today.getUTCFullYear()}-01-01`;
  }

  setDateFrom(clampIsoDate(dateFrom, minDate, maxDate));
  setDateTo(dateTo);
}

function clampIsoDate(value: string, minDate: string, maxDate: string) {
  if (!value) {
    return "";
  }

  if (value < minDate) {
    return minDate;
  }

  if (value > maxDate) {
    return maxDate;
  }

  return value;
}

function getEarliestIsoDate(values: string[]) {
  return values.filter(Boolean).sort()[0] ?? null;
}

function addYearsIso(value: string, years: number) {
  const date = parseIsoDateValue(value);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return toIsoDate(date);
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth() + months, date.getDate()));
}

function countInclusiveTrendMonths(start: Date, end: Date) {
  const yearDelta = end.getUTCFullYear() - start.getUTCFullYear();
  const monthDelta = end.getUTCMonth() - start.getUTCMonth();
  return Math.max(1, yearDelta * 12 + monthDelta + 1);
}

function toIsoDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

function getMonthBucket(date: Date) {
  return {
    label: getMonthLabel(date),
    sortKey: getMonthSortKey(date)
  };
}

function getMonthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC", year: "numeric" }).format(date);
}

function getMonthSortKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthKeyToDate(sortKey: string) {
  const [year, month] = sortKey.split("-");
  return new Date(Date.UTC(Number(year), Number(month) - 1, 1));
}

function getMonthKeyFromLabel(label: string) {
  const date = new Date(`${label} 1, 00:00:00 UTC`);
  return Number.isNaN(date.getTime()) ? label : getMonthSortKey(date);
}

function getFirstTrendMonth(points: TrendPoint[]) {
  const point = points[0];
  return point ? new Date(`${point.label} 1, 00:00:00 UTC`) : null;
}

function getLastTrendMonth(points: TrendPoint[]) {
  const point = points[points.length - 1];
  return point ? new Date(`${point.label} 1, 00:00:00 UTC`) : null;
}

function formatTrendValue(value: number, prefix: string, suffix: string) {
  return `${prefix}${formatNumber(roundDisplayNumber(value))}${suffix}`;
}

function formatTrendHeaderValue(value: number, prefix: string, suffix: string) {
  return `${prefix}${roundDisplayNumber(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })}${suffix}`;
}

function formatChartWindow(points: ChartPoint[]) {
  const first = points[0]?.label;
  const last = points[points.length - 1]?.label;

  if (!first && !last) {
    return "No window selected";
  }

  if (!last || first === last) {
    return first ?? last;
  }

  return `${first} to ${last}`;
}

function roundAxisUp(value: number) {
  return Math.ceil(value / 10) * 10;
}

function getAxisMaximum(value: number, multiplier: number) {
  return roundAxisUp(Math.max(10, value * multiplier));
}

function buildYAxisTicks(minValue: number, maxValue: number, top: number, bottom: number) {
  const maxMarkers = 10;
  const step = getNiceAxisStep(maxValue - minValue, maxMarkers);
  const roundedMax = Math.max(step, Math.ceil(maxValue / step) * step);
  const ticks: { value: number; y: number }[] = [];

  for (let value = minValue; value <= roundedMax; value += step) {
    const y = bottom - ((value - minValue) / Math.max(1, roundedMax - minValue)) * (bottom - top);
    ticks.push({ value, y });
  }

  return ticks.reverse();
}

function getNiceAxisStep(range: number, maxMarkers: number) {
  const minimumStep = 10;
  const roughStep = Math.max(minimumStep, range / Math.max(1, maxMarkers - 1));
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

  return Math.max(minimumStep, niceNormalized * magnitude);
}

function roundDisplayNumber(value: number) {
  return Math.round(value * 100) / 100;
}

function formatSourceLabel(source: string) {
  switch (source) {
    case "initial":
      return "Vehicle setup";
    case "manual":
      return "Manual mileage update";
    case "service":
      return "Service record";
    case "correction":
      return "Mileage correction";
    case "profile-update":
      return "Profile edit";
    default:
      return source;
  }
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}
