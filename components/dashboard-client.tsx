"use client";

import Link from "next/link";
import { SyntheticEvent, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { trackEvent } from "@/lib/analytics";
import {
  buildExpenseByCategory,
  buildExpenseTrend,
  buildMileageTrend,
  calculateAverageMonthlyExpense,
  calculateAverageMonthlyMileage,
  calculateAverageMonthlyServiceFrequency,
  calculateMilesDriven,
  filterMileageHistoryByTrend,
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

type CarFormState = {
  imageUrl: string;
  make: string;
  mileage: string;
  model: string;
  serviceReminderRules: ReminderRuleForm[];
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
  serviceReminderRules: []
};

const emptyEditCarForm: EditCarFormState = {
  make: "",
  model: "",
  year: "",
  mileage: "",
  imageUrl: "",
  serviceReminderRules: [],
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

export function DashboardClient({
  attentionItems: initialAttentionItems,
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

  function updateCarField(field: keyof CarFormState, value: string | ReminderRuleForm[]) {
    setCarForm((current) => ({ ...current, [field]: value }));
  }

  function updateEditCarField(
    field: keyof EditCarFormState,
    value: string | boolean | ReminderRuleForm[]
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
          date: mileageForm.date,
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
            date: editMileageEntryForm.date,
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
  const filteredTrendServices = filterServiceHistoryByTrend(trendServiceHistory, {
    dateFrom: trendDateFromValue,
    dateTo: trendDateToValue,
    serviceType: trendServiceTypeFilter === "all" ? null : trendServiceTypeFilter
  });
  const filteredTrendMileage = filterMileageHistoryByTrend(trendMileageHistory, {
    dateFrom: trendDateFromValue,
    dateTo: trendDateToValue
  });
  const trendMileagePoints = buildMileageTrend(filteredTrendMileage);
  const trendExpensePoints = buildExpenseTrend(filteredTrendServices);
  const trendCategoryExpenses = buildExpenseByCategory(filteredTrendServices);
  const trendMilesDriven = calculateMilesDriven(filteredTrendMileage);
  const trendAverageMonthlyMileage = calculateAverageMonthlyMileage(filteredTrendMileage);
  const trendAverageMonthlyExpense = calculateAverageMonthlyExpense(filteredTrendServices);
  const trendAverageMonthlyServiceFrequency = calculateAverageMonthlyServiceFrequency(filteredTrendServices);
  const fleetHighlights = getFleetHighlights(cars);
  const overdueAttentionItems = attentionItems.filter((item) => item.status === "overdue");
  const dueSoonAttentionItems = attentionItems.filter((item) => item.status === "due-soon");
  const serviceFeedRows = serviceFeed ?? recentServices;
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
          onAddRule={addReminderRule}
          onRemoveRule={removeReminderRule}
          onUpdateCarField={updateCarField}
          onUpdateRule={updateReminderRuleField}
        />
      ) : null}

      {view === "services" ? (
        <AnalyticsIndexView
          attentionItems={attentionItems}
          cars={cars}
          overview={overview}
          recentServices={serviceFeedRows}
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
          onRemoveRule={removeReminderRule}
          onUpdateRule={updateReminderRuleField}
        />
      ) : null}

      {view === "vehicle-insights" ? (
        <VehicleInsightsView
          car={selectedCar}
          serviceTypeOptions={serviceTypeOptions}
          setTrendDateFrom={setTrendDateFrom}
          setTrendDateTo={setTrendDateTo}
          setTrendServiceTypeFilter={setTrendServiceTypeFilter}
          trendAverageMonthlyExpense={trendAverageMonthlyExpense}
          trendAverageMonthlyMileage={trendAverageMonthlyMileage}
          trendAverageMonthlyServiceFrequency={trendAverageMonthlyServiceFrequency}
          trendCategoryExpenses={trendCategoryExpenses}
          trendDateFrom={trendDateFrom}
          trendDateTo={trendDateTo}
          trendExpensePoints={trendExpensePoints}
          trendMilesDriven={trendMilesDriven}
          trendMileagePoints={trendMileagePoints}
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
  return (
    <div className="content-stack">
      <section className="overview-grid compact-shell">
        <OverviewCard label="Vehicles" value={String(overview.totalVehicles)} />
        <OverviewCard label="Service Records" value={String(overview.totalServiceRecords)} />
        <OverviewCard label="Lifetime Expenses" value={formatCurrency(overview.totalExpenses)} />
        <OverviewCard label="Overdue" value={String(overview.overdueCount)} />
        <OverviewCard label="Due Soon" value={String(overview.dueSoonCount)} />
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
          label="Highest Spend"
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
              <p>Fleet snapshot.</p>
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
                <p>Priority service signals.</p>
              </div>
            </div>
            {attentionItems.length === 0 ? (
              <div className="empty-inline">No maintenance alerts.</div>
            ) : (
              <div className="watch-preview-list">
                {[...overdueAttentionItems, ...dueSoonAttentionItems].slice(0, 6).map((item) => (
                  <button
                    className="preview-row"
                    key={`${item.carId}-${item.serviceType}`}
                    onClick={() => openVehiclePage(item.carId)}
                    type="button"
                  >
                    <span className="preview-row-stack">
                      <span className="preview-main">{item.carName}</span>
                      <span className="preview-sub">{item.serviceType}</span>
                    </span>
                    <span className={`comparison-status ${item.status === "overdue" ? "warning" : "due-soon"}`}>
                      {item.status === "overdue" ? "Overdue" : "Due Soon"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="workspace-panel dashboard-service-panel">
            <div className="workspace-panel-header">
              <div>
                <h2>Recent Service</h2>
                <p>Latest maintenance activity.</p>
              </div>
              <Link className="section-link" href="/services">
                Open Analytics
              </Link>
            </div>
            {recentServices.length === 0 ? (
              <div className="empty-inline">No service activity yet.</div>
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
  return (
    <div className="content-stack">
      <section className="overview-grid compact-shell">
        <OverviewCard label="Vehicles" value={String(overview.totalVehicles)} />
        <OverviewCard
          label="Average Mileage"
          value={overview.averageMileage === null ? "N/A" : `${overview.averageMileage.toLocaleString("en-US")} mi`}
        />
        <OverviewCard label="Flagged Vehicles" value={String(overview.flaggedVehicleCount)} />
        <OverviewCard
          label="Average Service Cost"
          value={formatCurrency(overview.averageServiceCost)}
        />
      </section>

      <section className="workspace-panel">
        <div className="workspace-panel-header">
          <div>
            <h2>All Vehicles</h2>
            <p>Vehicle records, service status, and insights.</p>
          </div>
        </div>
        {cars.length === 0 ? (
          <div className="empty-inline">Your garage is ready for its first vehicle.</div>
        ) : (
          <div className="garage-card-grid">
            {cars.map((car) => {
              const reminder = attentionItems.find((item) => item.carId === car.carId);
              return (
                <article className="garage-card" key={car.carId}>
                  <div className="garage-card-top">
                    <div>
                      <div className="garage-card-title">{car.carName}</div>
                      <div className="garage-card-subtitle">{car.currentMileage.toLocaleString("en-US")} mi</div>
                    </div>
                    {reminder ? (
                      <span className={`comparison-status ${reminder.status === "overdue" ? "warning" : "due-soon"}`}>
                        {reminder.serviceType}
                      </span>
                    ) : (
                      <span className="comparison-status ok">On schedule</span>
                    )}
                  </div>
                  <div className="garage-card-meta">
                    <span>{car.serviceCount} service records</span>
                    <span>{formatCurrency(car.lifetimeExpenses)} lifetime cost</span>
                    <span>Last service {car.lastServiceDate}</span>
                  </div>
                  <div className="garage-card-actions">
                    <button className="btn btn-inline" onClick={() => openVehiclePage(car.carId)} type="button">
                      Open Records
                    </button>
                    <button className="btn btn-inline" onClick={() => openVehicleInsightsPage(car.carId)} type="button">
                      Open Insights
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function VehicleCreateView({
  carForm,
  handleAddCar,
  onAddRule,
  onRemoveRule,
  onUpdateCarField,
  onUpdateRule
}: {
  carForm: CarFormState;
  handleAddCar: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  onAddRule: (mode: "create" | "edit") => void;
  onRemoveRule: (mode: "create" | "edit", index: number) => void;
  onUpdateCarField: (field: keyof CarFormState, value: string | ReminderRuleForm[]) => void;
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
          <p>Core vehicle profile.</p>
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
          <label htmlFor="imageUrl">Image URL</label>
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
  overview,
  recentServices
}: {
  attentionItems: AttentionItem[];
  cars: CarSummary[];
  overview: DashboardOverview;
  recentServices: DashboardRecentService[];
}) {
  const topCostVehicles = [...cars]
    .sort((left, right) => right.lifetimeExpenses - left.lifetimeExpenses)
    .slice(0, 5);
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
        <OverviewCard label="Vehicles" value={String(overview.totalVehicles)} />
        <OverviewCard label="Service Records" value={String(overview.totalServiceRecords)} />
        <OverviewCard label="Total Spend" value={formatCurrency(overview.totalExpenses)} />
        <OverviewCard label="Avg Service Cost" value={formatCurrency(overview.averageServiceCost)} />
      </section>

      <div className="records-grid analytics-grid">
        <section className="workspace-panel">
          <div className="workspace-panel-header">
            <div>
              <h2>Cost Summary</h2>
              <p>Fleet service spend.</p>
            </div>
          </div>
          <div className="detail-list">
            <div>
              <dt>Tracked Service Cost</dt>
              <dd>{formatCurrency(totalTrackedServiceCost)}</dd>
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
              <p>Vehicles with the highest recorded spend.</p>
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
            <h2>Recent Activity</h2>
            <p>Latest service events across the fleet.</p>
          </div>
        </div>
        {recentServices.length === 0 ? (
          <div className="empty-inline">No service records yet.</div>
        ) : (
          <div className="preview-list">
            {recentServices.slice(0, 10).map((service) => (
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
            <p>Workspace identity.</p>
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
            <p>Account reference.</p>
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
  onRemoveRule,
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
  onAddRule: (mode: "create" | "edit") => void;
  onRemoveRule: (mode: "create" | "edit", index: number) => void;
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
    value: string | boolean | ReminderRuleForm[]
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

  useEffect(() => {
    setShowVehicleSettings(false);
    setServiceHistoryPage(0);
  }, [car?.carId]);

  if (!car) {
    return (
      <section className="workspace-panel">
        <div className="empty-inline">Vehicle not found.</div>
      </section>
    );
  }

  const serviceHistoryPageSize = 4;
  const serviceHistoryPageCount = Math.max(1, Math.ceil(car.serviceHistory.length / serviceHistoryPageSize));
  const activeServiceHistoryPage = Math.min(serviceHistoryPage, serviceHistoryPageCount - 1);
  const visibleServiceHistory = car.serviceHistory.slice(
    activeServiceHistoryPage * serviceHistoryPageSize,
    activeServiceHistoryPage * serviceHistoryPageSize + serviceHistoryPageSize
  );

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
            <p>Service operations and mileage tracking.</p>
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
          <div className="empty-inline">No mileage-based reminders configured.</div>
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
            <div className="field-row">
              <div className="field-group">
                <label htmlFor="mileageDate">Entry Date</label>
                <input
                  id="mileageDate"
                  onChange={(event) => updateMileageField("date", event.target.value)}
                  type="date"
                  value={mileageForm.date}
                />
              </div>
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
            <button className="btn btn-primary" type="submit">
              Save Mileage Entry
            </button>
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
                <label htmlFor="serviceMileage">Mileage at Service</label>
                <input
                  id="serviceMileage"
                  min={car.currentMileage}
                  onChange={(event) => updateServiceField("mileage", event.target.value)}
                  required
                  type="number"
                  value={serviceForm.mileage}
                />
                <div className="field-hint">Current mileage is the default minimum.</div>
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
                <input
                  id="serviceCost"
                  min="0"
                  onChange={(event) => updateServiceField("cost", event.target.value)}
                  step="0.01"
                  type="number"
                  value={serviceForm.cost}
                />
              </div>
            </div>
            <div className="field-group">
              <label htmlFor="serviceDescription">Description</label>
              <input
                id="serviceDescription"
                onChange={(event) => updateServiceField("description", event.target.value)}
                type="text"
                value={serviceForm.description}
              />
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
            <button className="btn btn-primary" type="submit">
              Save Service Record
            </button>
          </form>
        </section>
      </div>

      <div className="records-grid vehicle-records-grid">
        <section className="workspace-panel workspace-record-panel">
          <div className="workspace-panel-header">
            <div>
              <h2>Service History</h2>
              <p>Maintenance ledger.</p>
            </div>
            {car.serviceHistory.length > serviceHistoryPageSize ? (
              <div className="section-pager">
                <button
                  className="btn btn-inline"
                  disabled={activeServiceHistoryPage === 0}
                  onClick={() => setServiceHistoryPage((current) => Math.max(0, current - 1))}
                  type="button"
                >
                  Prev
                </button>
                <span className="section-pager-label">
                  {activeServiceHistoryPage + 1} / {serviceHistoryPageCount}
                </span>
                <button
                  className="btn btn-inline"
                  disabled={activeServiceHistoryPage >= serviceHistoryPageCount - 1}
                  onClick={() =>
                    setServiceHistoryPage((current) => Math.min(serviceHistoryPageCount - 1, current + 1))
                  }
                  type="button"
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
          {car.serviceHistory.length === 0 ? (
            <div className="empty-inline">No service records yet.</div>
          ) : (
            <table className="workspace-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Mileage</th>
                  <th>Cost</th>
                  <th>Description</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleServiceHistory.map((service) => (
                  <tr key={service.serviceId}>
                    <td>{service.date}</td>
                    <td>{service.serviceType}</td>
                    <td>{service.mileage.toLocaleString("en-US")} mi</td>
                    <td>{formatCurrency(service.cost)}</td>
                    <td>{service.description || "N/A"}</td>
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
                  <input
                    id="editServiceCost"
                    min="0"
                    onChange={(event) => updateEditServiceField("cost", event.target.value)}
                    step="0.01"
                    type="number"
                    value={editServiceForm.cost}
                  />
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
              <p>Odometer history.</p>
            </div>
          </div>
          <table className="workspace-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Mileage</th>
                <th>Source</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {car.mileageHistory.map((entry) => (
                <tr key={entry.entryId}>
                  <td>{entry.date}</td>
                  <td>{entry.mileage.toLocaleString("en-US")} mi</td>
                  <td>{formatSourceLabel(entry.source)}</td>
                  <td>{entry.notes}</td>
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

          {editingMileageEntryId !== null ? (
            <form className="form-grid inline-edit-form" onSubmit={handleSaveMileageEntryEdit}>
              <div className="field-row">
                <div className="field-group">
                  <label htmlFor="editMileageEntryDate">Entry Date</label>
                  <input
                    id="editMileageEntryDate"
                    onChange={(event) => updateEditMileageEntryField("date", event.target.value)}
                    required
                    type="date"
                    value={editMileageEntryForm.date}
                  />
                </div>
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
            <p>Profile and reminder configuration.</p>
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
              <label htmlFor="editImageUrl">Image URL</label>
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
          <div className="empty-inline">Settings are collapsed.</div>
        )}
      </section>
    </div>
  );
}

function VehicleInsightsView({
  car,
  serviceTypeOptions,
  setTrendDateFrom,
  setTrendDateTo,
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
  serviceTypeOptions: string[];
  setTrendDateFrom: (value: string) => void;
  setTrendDateTo: (value: string) => void;
  setTrendServiceTypeFilter: (value: string) => void;
  trendAverageMonthlyExpense: number | null;
  trendAverageMonthlyMileage: number | null;
  trendAverageMonthlyServiceFrequency: number | null;
  trendCategoryExpenses: CategoryExpenseItem[];
  trendDateFrom: string;
  trendDateTo: string;
  trendExpensePoints: TrendPoint[];
  trendMilesDriven: number | null;
  trendMileagePoints: TrendPoint[];
  trendServiceTypeFilter: string;
}) {
  if (!car) {
    return (
      <section className="workspace-panel">
        <div className="empty-inline">Vehicle not found.</div>
      </section>
    );
  }

  return (
    <div className="content-stack">
      <section className="overview-grid compact-shell">
        <OverviewCard label="Miles In Scope" value={trendMilesDriven === null ? "N/A" : `${trendMilesDriven.toLocaleString("en-US")} mi`} />
        <OverviewCard
          label="Avg Monthly Miles"
          value={trendAverageMonthlyMileage === null ? "N/A" : `${trendAverageMonthlyMileage.toLocaleString("en-US")} mi`}
        />
        <OverviewCard label="Avg Monthly Expense" value={formatCurrency(trendAverageMonthlyExpense)} />
        <OverviewCard
          label="Services / Month"
          value={trendAverageMonthlyServiceFrequency === null ? "N/A" : String(trendAverageMonthlyServiceFrequency)}
        />
      </section>

      <section className="workspace-panel">
        <div className="workspace-panel-header">
          <div>
            <h2>Trend Filters</h2>
            <p>Focus the reporting window.</p>
          </div>
        </div>
        <div className="toolbar-grid">
          <div className="field-group">
            <label htmlFor="trendDateFrom">From Date</label>
            <input
              id="trendDateFrom"
              onChange={(event) => setTrendDateFrom(event.target.value)}
              type="date"
              value={trendDateFrom}
            />
          </div>
          <div className="field-group">
            <label htmlFor="trendDateTo">To Date</label>
            <input
              id="trendDateTo"
              onChange={(event) => setTrendDateTo(event.target.value)}
              type="date"
              value={trendDateTo}
            />
          </div>
          <div className="field-group">
            <label htmlFor="trendServiceType">Service Category</label>
            <select
              id="trendServiceType"
              onChange={(event) => setTrendServiceTypeFilter(event.target.value)}
              value={trendServiceTypeFilter}
            >
              <option value="all">All categories</option>
              {serviceTypeOptions.map((serviceType) => (
                <option key={serviceType} value={serviceType}>
                  {serviceType}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div className="trend-grid">
        <TrendCard
          emptyLabel="Mileage trends appear after multiple odometer entries."
          label="Mileage Trend"
          points={trendMileagePoints}
          prefix=""
          suffix=" mi"
        />
        <TrendCard
          emptyLabel="Expense trends appear after priced service records."
          label="Expense Trend"
          points={trendExpensePoints}
          prefix="$"
          suffix=""
        />
      </div>

      <section className="workspace-panel">
        <div className="workspace-panel-header">
          <div>
            <h2>Expense by Category</h2>
            <p>Spend distribution by service type.</p>
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
            <p>Chronological odometer activity.</p>
          </div>
        </div>
        <div className="timeline-list">
          {car.mileageHistory.map((entry) => (
            <div className="timeline-card" key={entry.entryId}>
              <div className="timeline-top">
                <div className="timeline-date">{entry.date}</div>
                <div className="timeline-mileage">{entry.mileage.toLocaleString("en-US")} mi</div>
              </div>
              <div className="timeline-source">{formatSourceLabel(entry.source)}</div>
              <div className="timeline-notes">{entry.notes}</div>
            </div>
          ))}
        </div>
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
        description: "A focused view of fleet health, spend, and recent activity."
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
          <div className="service-notes muted-text">No reminder intervals configured.</div>
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

function TrendCard({
  emptyLabel,
  label,
  points,
  prefix,
  suffix
}: {
  emptyLabel: string;
  label: string;
  points: TrendPoint[];
  prefix: string;
  suffix: string;
}) {
  const maxValue = points.reduce((max, point) => Math.max(max, point.value), 0);

  return (
    <div className="trend-card">
      <div className="trend-card-title">{label}</div>
      {points.length === 0 ? (
        <div className="muted-text">{emptyLabel}</div>
      ) : (
        <div className="trend-bars">
          {points.map((point) => (
            <div className="trend-bar-row" key={point.label}>
              <div className="trend-label">{point.label}</div>
              <div className="trend-bar-track">
                <div
                  className="trend-bar-fill"
                  style={{ width: `${maxValue ? Math.max(10, (point.value / maxValue) * 100) : 0}%` }}
                />
              </div>
              <div className="trend-value">
                {prefix}
                {Math.round(point.value).toLocaleString("en-US")}
                {suffix}
              </div>
            </div>
          ))}
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

function OverviewCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="overview-card">
      <div className="overview-label">{label}</div>
      <div className="overview-value">{value}</div>
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

function formatDateForServiceApi(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${month}/${day}/${year.slice(-2)}`;
}

function formatDateForInput(value: string) {
  const [month, day, year] = value.split("/");
  if (!month || !day || !year) {
    return todayIso();
  }

  return `20${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseDisplayDate(value: string) {
  const [month, day, year] = value.split("/");
  return new Date(Date.UTC(2000 + Number(year), Number(month) - 1, Number(day)));
}

function parseIsoDateValue(value: string) {
  const [year, month, day] = value.split("-");
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
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
