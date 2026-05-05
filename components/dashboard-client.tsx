"use client";

import { SyntheticEvent, useDeferredValue, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  ReportSummary,
  ServiceReminderRule,
  ServiceHistoryItem,
  TrendPoint,
  UserProfile
} from "@/lib/types";

type DashboardClientProps = {
  attentionItems: AttentionItem[];
  initialCars: CarSummary[];
  overview: DashboardOverview;
  profile: UserProfile | null;
  recentServices: DashboardRecentService[];
  username: string;
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
  serviceReminderRules: [createReminderRuleForm()]
};

const emptyEditCarForm: EditCarFormState = {
  make: "",
  model: "",
  year: "",
  mileage: "",
  imageUrl: "",
  serviceReminderRules: [createReminderRuleForm()],
  allowMileageCorrection: false
};

const emptyServiceForm = {
  carId: "",
  serviceDate: todayIso(),
  mileage: "",
  serviceType: serviceTypes[0],
  description: "",
  notes: "",
  cost: ""
};

const emptyMileageForm = {
  carId: "",
  mileage: "",
  date: todayIso(),
  notes: "",
  allowCorrection: false
};

const emptyEditServiceForm = {
  serviceDate: todayIso(),
  mileage: "",
  serviceType: serviceTypes[0],
  description: "",
  notes: "",
  cost: ""
};

const emptyEditMileageEntryForm = {
  mileage: "",
  date: todayIso(),
  notes: "",
  allowCorrection: false
};

const emptyProfileForm = {
  displayName: "",
  email: ""
};

const emptyReportFilters = {
  carId: "",
  dateFrom: "",
  dateTo: ""
};

const serviceSortOptions = [
  { label: "Newest date", value: "date-desc" },
  { label: "Oldest date", value: "date-asc" },
  { label: "Highest mileage", value: "mileage-desc" },
  { label: "Lowest mileage", value: "mileage-asc" },
  { label: "Highest cost", value: "cost-desc" },
  { label: "Lowest cost", value: "cost-asc" },
  { label: "Category A-Z", value: "type-asc" }
] as const;

export function DashboardClient({
  attentionItems: initialAttentionItems,
  initialCars,
  overview: initialOverview,
  profile: initialProfile,
  recentServices: initialRecentServices,
  username
}: DashboardClientProps) {
  const router = useRouter();
  const [cars, setCars] = useState(initialCars);
  const [overview, setOverview] = useState(initialOverview);
  const [recentServices, setRecentServices] = useState(initialRecentServices);
  const [attentionItems, setAttentionItems] = useState(initialAttentionItems);
  const [profile, setProfile] = useState(initialProfile);
  const [selectedCar, setSelectedCar] = useState<CarDetails | null>(null);
  const [lookupId, setLookupId] = useState("");
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
  const [reportFilters, setReportFilters] = useState(emptyReportFilters);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
  const [editingMileageEntryId, setEditingMileageEntryId] = useState<number | null>(null);
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("all");
  const [serviceDateFrom, setServiceDateFrom] = useState("");
  const [serviceDateTo, setServiceDateTo] = useState("");
  const [trendDateFrom, setTrendDateFrom] = useState("");
  const [trendDateTo, setTrendDateTo] = useState("");
  const [trendServiceTypeFilter, setTrendServiceTypeFilter] = useState("all");
  const [serviceSort, setServiceSort] =
    useState<(typeof serviceSortOptions)[number]["value"]>("date-desc");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);
  const [isDeletingVehicle, setIsDeletingVehicle] = useState(false);
  const [isSavingService, setIsSavingService] = useState(false);
  const [isSavingMileageEntry, setIsSavingMileageEntry] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [deletingServiceId, setDeletingServiceId] = useState<number | null>(null);
  const [deletingMileageEntryId, setDeletingMileageEntryId] = useState<number | null>(null);
  const deferredServiceSearch = useDeferredValue(serviceSearch);

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
    setTrendDateFrom("");
    setTrendDateTo("");
    setTrendServiceTypeFilter("all");
  }, [selectedCar?.carId]);

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

  function updateReportFilter(field: keyof typeof emptyReportFilters, value: string) {
    setReportFilters((current) => ({ ...current, [field]: value }));
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
    setServiceSearch("");
    setServiceTypeFilter("all");
    setServiceDateFrom("");
    setServiceDateTo("");
    setServiceSort("date-desc");
    setEditingServiceId(null);
    setEditingMileageEntryId(null);
    setEditServiceForm(emptyEditServiceForm);
    setEditMileageEntryForm(emptyEditMileageEntryForm);

    if (!car) {
      setLookupId("");
      setEditCarForm(emptyEditCarForm);
      setMileageForm(emptyMileageForm);
      return;
    }

    setLookupId(String(car.carId));
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

  function primeServiceForm(car: Pick<CarDetails, "carId" | "currentMileage">, serviceType?: string) {
    setServiceForm({
      ...emptyServiceForm,
      carId: String(car.carId),
      mileage: String(car.currentMileage),
      serviceDate: todayIso(),
      serviceType: serviceType ?? emptyServiceForm.serviceType
    });
  }

  async function fetchCar(carId: string | number, successMessage?: string) {
    setMessage(null);
    const response = await fetch(`/api/cars/${carId}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error ?? "Could not load car.");
    }

    const car = payload as CarDetails;
    syncSelectedCar(car);

    if (successMessage) {
      setMessage({ type: "success", text: successMessage });
    }

    return car;
  }

  async function handleLookup(event?: SyntheticEvent) {
    event?.preventDefault();

    if (!lookupId.trim()) {
      setMessage({ type: "error", text: "Enter a car ID." });
      return;
    }

    try {
      await fetchCar(lookupId.trim());
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not load car." });
    }
  }

  async function handleReminderAction(carId: number, serviceType: string) {
    try {
      const car = selectedCar?.carId === carId ? selectedCar : await fetchCar(carId);

      if (!car) {
        return;
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

  async function handleLoadReport(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsLoadingReport(true);

    try {
      const response = await fetch(buildReportUrl(reportFilters), { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not load report.");
      }

      setReportSummary(payload as ReportSummary);
      setMessage({ type: "success", text: "Report summary updated." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not load report." });
    } finally {
      setIsLoadingReport(false);
    }
  }

  async function handleExportReport() {
    setMessage(null);
    setIsExportingReport(true);

    try {
      const response = await fetch(buildReportUrl(reportFilters, "csv"), { cache: "no-store" });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Could not export report.");
      }

      const csv = await response.text();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = getReportFileName(reportFilters);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      setMessage({ type: "success", text: "CSV export prepared." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not export report." });
    } finally {
      setIsExportingReport(false);
    }
  }

  function handleResetReport() {
    setReportFilters(emptyReportFilters);
    setReportSummary(null);
    setMessage({ type: "success", text: "Report filters cleared." });
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
      setMessage({ type: "success", text: "Vehicle created and added to your garage." });
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
      await refreshCars();
      await refreshServerData();
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
      setServiceForm((current) => ({
        ...emptyServiceForm,
        carId: String(updatedCar.carId),
        mileage: String(updatedCar.currentMileage)
      }));
      syncSelectedCar(updatedCar);
      await refreshCars();
      await refreshServerData();
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

  const filteredServiceHistory = selectedCar
    ? [...selectedCar.serviceHistory]
        .filter((service) => {
          const matchesType = serviceTypeFilter === "all" || service.serviceType === serviceTypeFilter;
          const query = deferredServiceSearch.trim().toLowerCase();
          const matchesQuery =
            !query ||
            service.serviceType.toLowerCase().includes(query) ||
            service.description.toLowerCase().includes(query) ||
            service.notes.toLowerCase().includes(query);
          const serviceDate = parseDisplayDate(service.date);
          const matchesFrom = !serviceDateFrom || serviceDate >= parseIsoDateValue(serviceDateFrom);
          const matchesTo = !serviceDateTo || serviceDate <= parseIsoDateValue(serviceDateTo);

          return matchesType && matchesQuery && matchesFrom && matchesTo;
        })
        .sort((left, right) => compareServices(left, right, serviceSort))
    : [];
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

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="top-bar">
          <div>
            <h1>CarKeeper</h1>
            <p>
              Track your garage with cleaner workflows for vehicle records, mileage updates,
              service expenses, and maintenance attention items.
            </p>
            <div className="hero-meta">
              <div className="meta-chip">{overview.totalVehicles} vehicles tracked</div>
              <div className="meta-chip">{overview.totalServiceRecords} services recorded</div>
              <div className="meta-chip">{attentionItems.length} active maintenance reminders</div>
            </div>
          </div>

          <div className="account-panel">
            <div className="signed-in-card">
              <span className="signed-in-label">Signed in as</span>
              <span className="signed-in-name">{profile?.displayName || username}</span>
              <span className="signed-in-subline">@{username}</span>
              <span className="signed-in-subline">{profile?.email || "Add an email to complete your profile"}</span>
            </div>
            <button className="btn btn-ghost" disabled={isLoggingOut} onClick={handleLogout} type="button">
              {isLoggingOut ? "Signing out..." : "Log Out"}
            </button>
          </div>
        </div>
      </section>

      <section className="overview-grid">
        <OverviewCard label="Vehicles" value={String(overview.totalVehicles)} />
        <OverviewCard label="Service Records" value={String(overview.totalServiceRecords)} />
        <OverviewCard label="Lifetime Expenses" value={formatCurrency(overview.totalExpenses)} />
        <OverviewCard label="Overdue Reminders" value={String(overview.overdueCount)} />
        <OverviewCard
          label="Due Soon"
          value={overview.dueSoonCount ? `${overview.dueSoonCount} due` : "All clear"}
        />
        <OverviewCard label="Flagged Vehicles" value={String(overview.flaggedVehicleCount)} />
      </section>

      <section className="card comparison-card">
        <div className="card-header">
          <h2>Fleet Comparison</h2>
          <p>Compare mileage, maintenance load, and cost across every vehicle in your garage.</p>
        </div>
        <div className="card-body">
          {cars.length === 0 ? (
            <div className="inventory-empty">Add vehicles to unlock comparison insights.</div>
          ) : (
            <div className="comparison-table-wrap">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Mileage</th>
                    <th>Services</th>
                    <th>Lifetime Cost</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...cars]
                    .sort((left, right) => right.lifetimeExpenses - left.lifetimeExpenses || right.currentMileage - left.currentMileage)
                    .map((car) => {
                      const reminder = attentionItems.find((item) => item.carId === car.carId);

                      return (
                        <tr key={car.carId}>
                          <td>
                            <button
                              className="comparison-link"
                              onClick={() => void fetchCar(car.carId)}
                              type="button"
                            >
                              {car.carName}
                            </button>
                          </td>
                          <td>{car.currentMileage.toLocaleString()} mi</td>
                          <td>{car.serviceCount}</td>
                          <td>{formatCurrency(car.lifetimeExpenses)}</td>
                          <td>
                            {reminder ? (
                              <span
                                className={`comparison-status ${
                                  reminder.status === "overdue" ? "warning" : "due-soon"
                                }`}
                              >
                                {reminder.serviceType}: {reminder.status === "overdue" ? "Overdue" : "Due soon"}
                              </span>
                            ) : (
                              <span className="comparison-status ok">On schedule</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="fleet-highlights">
        <HighlightCard
          label="Highest Mileage"
          subtitle={
            fleetHighlights.highestMileageVehicle
              ? `${fleetHighlights.highestMileageVehicle.currentMileage.toLocaleString()} mi`
              : "No vehicles yet"
          }
          title={fleetHighlights.highestMileageVehicle?.carName ?? "No vehicle available"}
        />
        <HighlightCard
          label="Highest Spend"
          subtitle={
            fleetHighlights.highestSpendVehicle
              ? formatCurrency(fleetHighlights.highestSpendVehicle.lifetimeExpenses)
              : "No vehicles yet"
          }
          title={fleetHighlights.highestSpendVehicle?.carName ?? "No vehicle available"}
        />
        <HighlightCard
          label="Most Serviced"
          subtitle={
            fleetHighlights.mostServicedVehicle
              ? `${fleetHighlights.mostServicedVehicle.serviceCount} records`
              : "No vehicles yet"
          }
          title={fleetHighlights.mostServicedVehicle?.carName ?? "No vehicle available"}
        />
      </section>

      <div className="dashboard-grid">
        <div className="left-column">
          <section className="card">
            <div className="card-header">
              <h2>Account Profile</h2>
              <p>Keep your display name and contact email current for a more complete account record.</p>
            </div>
            <div className="card-body">
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

                <div className="profile-meta">
                  <span>Username: @{username}</span>
                  <span>User ID: {profile?.id ?? "Pending profile load"}</span>
                </div>

                <button className="btn btn-secondary" disabled={isSavingProfile} type="submit">
                  {isSavingProfile ? "Saving..." : "Save Profile"}
                </button>
              </form>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Reporting</h2>
              <p>Filter service activity by vehicle and date range, then export the same dataset as CSV.</p>
            </div>
            <div className="card-body">
              <form className="form-grid" onSubmit={handleLoadReport}>
                <div className="field-group">
                  <label htmlFor="reportCarId">Vehicle Scope</label>
                  <select
                    id="reportCarId"
                    onChange={(event) => updateReportFilter("carId", event.target.value)}
                    value={reportFilters.carId}
                  >
                    <option value="">All vehicles</option>
                    {cars.map((car) => (
                      <option key={car.carId} value={car.carId}>
                        {car.carName} (ID {car.carId})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-row">
                  <div className="field-group">
                    <label htmlFor="reportDateFrom">From Date</label>
                    <input
                      id="reportDateFrom"
                      onChange={(event) => updateReportFilter("dateFrom", event.target.value)}
                      type="date"
                      value={reportFilters.dateFrom}
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="reportDateTo">To Date</label>
                    <input
                      id="reportDateTo"
                      onChange={(event) => updateReportFilter("dateTo", event.target.value)}
                      type="date"
                      value={reportFilters.dateTo}
                    />
                  </div>
                </div>

                <div className="action-row">
                  <button className="btn btn-secondary" disabled={isLoadingReport} type="submit">
                    {isLoadingReport ? "Loading..." : "Run Report"}
                  </button>
                  <button className="btn btn-ghost" onClick={handleResetReport} type="button">
                    Clear Filters
                  </button>
                  <button
                    className="btn btn-inline"
                    disabled={isExportingReport || isLoadingReport}
                    onClick={() => void handleExportReport()}
                    type="button"
                  >
                    {isExportingReport ? "Exporting..." : "Export CSV"}
                  </button>
                </div>
              </form>

              {reportSummary ? (
                <div className="report-stack">
                  <div className="stats-grid compact report-grid">
                    <div className="stat-card">
                      <div className="stat-label">Vehicles In Scope</div>
                      <div className="stat-value">{reportSummary.vehiclesInScope}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Service Records</div>
                      <div className="stat-value">{reportSummary.serviceCount}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Total Expenses</div>
                      <div className="stat-value">{formatCurrency(reportSummary.totalExpenses)}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Average Service Cost</div>
                      <div className="stat-value">{formatCurrency(reportSummary.averageServiceCost)}</div>
                    </div>
                  </div>

                  <div className="category-section">
                    <h4>Top Cost Categories</h4>
                    {reportSummary.servicesByCategory.length === 0 ? (
                      <div className="service-card">
                        <div className="service-notes muted-text">No service records match the current report filters.</div>
                      </div>
                    ) : (
                      <div className="category-list">
                        {reportSummary.servicesByCategory.slice(0, 4).map((item) => (
                          <CategoryExpenseCard item={item} key={item.category} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="category-section">
                    <h4>Highest Cost Service</h4>
                    {reportSummary.highestCostService ? (
                      <div className="service-card">
                        <div className="service-top">
                          <div className="service-type">{reportSummary.highestCostService.serviceType}</div>
                          <div className="service-date">{reportSummary.highestCostService.date}</div>
                        </div>
                        <div className="service-notes">
                          <div>{reportSummary.highestCostService.carName}</div>
                          <div className="service-notes-row">
                            {formatCurrency(reportSummary.highestCostService.cost)} at{" "}
                            {reportSummary.highestCostService.mileage.toLocaleString()} mi
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="service-card">
                        <div className="service-notes muted-text">No priced services match the current report filters.</div>
                      </div>
                    )}
                  </div>

                  <div className="category-section">
                    <h4>Report Rows</h4>
                    {reportSummary.services.length === 0 ? (
                      <div className="service-card">
                        <div className="service-notes muted-text">Run a wider date range or choose another vehicle to see report rows.</div>
                      </div>
                    ) : (
                      <div className="report-table-wrap">
                        <table className="comparison-table report-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Vehicle</th>
                              <th>Category</th>
                              <th>Mileage</th>
                              <th>Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportSummary.services.slice(0, 8).map((service) => (
                              <tr key={`${service.carId}-${service.serviceId}`}>
                                <td>{service.date}</td>
                                <td>{service.carName}</td>
                                <td>{service.serviceType}</td>
                                <td>{service.mileage.toLocaleString()} mi</td>
                                <td>{formatCurrency(service.cost)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Find a Vehicle</h2>
              <p>Open any vehicle record by ID or choose one from your garage.</p>
            </div>
            <div className="card-body">
              <form className="form-grid" onSubmit={handleLookup}>
                <div className="field-group">
                  <label htmlFor="lookupId">Car ID</label>
                  <input
                    id="lookupId"
                    onChange={(event) => setLookupId(event.target.value)}
                    placeholder="Enter car ID"
                    type="text"
                    value={lookupId}
                  />
                </div>
                <button className="btn btn-primary" type="submit">
                  View Vehicle
                </button>
              </form>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Add Vehicle</h2>
              <p>Create a new vehicle profile with its opening mileage.</p>
            </div>
            <div className="card-body">
              <form className="form-grid" onSubmit={handleAddCar}>
                <div className="field-row">
                  <div className="field-group">
                    <label htmlFor="make">Make</label>
                    <input
                      id="make"
                      onChange={(event) => updateCarField("make", event.target.value)}
                      placeholder="Honda"
                      required
                      type="text"
                      value={carForm.make}
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="model">Model</label>
                    <input
                      id="model"
                      onChange={(event) => updateCarField("model", event.target.value)}
                      placeholder="Civic"
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
                      onChange={(event) => updateCarField("year", event.target.value)}
                      placeholder="2018"
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
                      onChange={(event) => updateCarField("mileage", event.target.value)}
                      placeholder="116000"
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
                    onChange={(event) => updateCarField("imageUrl", event.target.value)}
                    placeholder="Optional image URL"
                    type="text"
                    value={carForm.imageUrl}
                  />
                </div>

                <ReminderRuleEditor
                  mode="create"
                  onAddRule={addReminderRule}
                  onRemoveRule={removeReminderRule}
                  onUpdateRule={updateReminderRuleField}
                  rules={carForm.serviceReminderRules}
                />

                <button className="btn btn-primary" type="submit">
                  Add Vehicle
                </button>
              </form>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Update Mileage</h2>
              <p>Record mileage changes without editing the whole vehicle profile.</p>
            </div>
            <div className="card-body">
              <form className="form-grid" onSubmit={handleUpdateMileage}>
                <div className="field-group">
                  <label htmlFor="mileageCarId">Vehicle</label>
                  <select
                    id="mileageCarId"
                    onChange={(event) => updateMileageField("carId", event.target.value)}
                    value={mileageForm.carId}
                  >
                    <option value="">Select a vehicle</option>
                    {cars.map((car) => (
                      <option key={car.carId} value={car.carId}>
                        {car.carName} (ID {car.carId})
                      </option>
                    ))}
                  </select>
                </div>

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
                      min="0"
                      onChange={(event) => updateMileageField("mileage", event.target.value)}
                      required
                      type="number"
                      value={mileageForm.mileage}
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label htmlFor="mileageNotes">Notes</label>
                  <textarea
                    id="mileageNotes"
                    onChange={(event) => updateMileageField("notes", event.target.value)}
                    placeholder="Optional context for this mileage entry"
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
                  <span>Allow a lower mileage if this entry is a correction.</span>
                </label>

                <button className="btn btn-secondary" type="submit">
                  Save Mileage Entry
                </button>
              </form>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Add Service</h2>
              <p>Record the service date, mileage, category, notes, and expense.</p>
            </div>
            <div className="card-body">
              <form className="form-grid" onSubmit={handleAddService}>
                <div className="field-group">
                  <label htmlFor="serviceCarId">Vehicle</label>
                  <select
                    id="serviceCarId"
                    onChange={(event) => updateServiceField("carId", event.target.value)}
                    required
                    value={serviceForm.carId}
                  >
                    <option value="">Select a vehicle</option>
                    {cars.map((car) => (
                      <option key={car.carId} value={car.carId}>
                        {car.carName} (ID {car.carId})
                      </option>
                    ))}
                  </select>
                </div>

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
                    <input
                      id="serviceCost"
                      min="0"
                      onChange={(event) => updateServiceField("cost", event.target.value)}
                      placeholder="Optional cost"
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
                    placeholder="Short description of the work performed"
                    type="text"
                    value={serviceForm.description}
                  />
                </div>

                <div className="field-group">
                  <label htmlFor="serviceNotes">Notes</label>
                  <textarea
                    id="serviceNotes"
                    onChange={(event) => updateServiceField("notes", event.target.value)}
                    placeholder="Optional service notes"
                    rows={3}
                    value={serviceForm.notes}
                  />
                </div>

                <button className="btn btn-secondary" type="submit">
                  Add Service Record
                </button>
              </form>
            </div>
          </section>
        </div>

        <div className="right-column">
          <section className="card inventory-card">
            <div className="card-header">
              <h2>Your Garage</h2>
              <p>Every vehicle below belongs to the signed-in account.</p>
            </div>
            <div className="card-body inventory-list">
              {cars.length === 0 ? (
                <div className="inventory-empty">No vehicles yet. Add your first one to get started.</div>
              ) : (
                cars.map((car) => (
                  <button
                    className={`inventory-item ${selectedCar?.carId === car.carId ? "active" : ""}`}
                    key={car.carId}
                    onClick={() => void fetchCar(car.carId)}
                    type="button"
                  >
                    <div className="inventory-item-title">{car.carName}</div>
                    <div className="inventory-item-meta">
                      <span>ID {car.carId}</span>
                      <span>{car.currentMileage.toLocaleString()} mi</span>
                      <span>{formatCurrency(car.lifetimeExpenses)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Maintenance Watch</h2>
              <p>Grouped reminder actions based on each vehicle&apos;s configured service categories.</p>
            </div>
            <div className="card-body panel-list">
              {attentionItems.length === 0 ? (
                <div className="inventory-empty">No vehicles are currently flagged for service attention.</div>
              ) : (
                <>
                  <ReminderWatchGroup
                    emptyLabel="No overdue reminders right now."
                    items={overdueAttentionItems}
                    label="Overdue"
                    onLogService={handleReminderAction}
                    onOpenCar={fetchCar}
                  />
                  <ReminderWatchGroup
                    emptyLabel="No due-soon reminders right now."
                    items={dueSoonAttentionItems}
                    label="Due Soon"
                    onLogService={handleReminderAction}
                    onOpenCar={fetchCar}
                  />
                </>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Recent Service Activity</h2>
              <p>The latest maintenance work across your garage.</p>
            </div>
            <div className="card-body panel-list">
              {recentServices.length === 0 ? (
                <div className="inventory-empty">Recent service activity will appear here once you log maintenance.</div>
              ) : (
                recentServices.map((service) => (
                  <button
                    className="panel-item"
                    key={`${service.carId}-${service.serviceId}`}
                    onClick={() => void fetchCar(service.carId)}
                    type="button"
                  >
                    <div className="panel-item-title">{service.serviceType}</div>
                    <div className="panel-item-copy">{service.carName}</div>
                    <div className="panel-item-meta">
                      <span>{service.date}</span>
                      <span>{service.mileage.toLocaleString()} mi</span>
                      <span>{formatCurrency(service.cost)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="result-panel">
            {message ? <div className={`status-card ${message.type}`}>{message.text}</div> : null}

            {selectedCar ? (
              <div className="detail-stack">
                <CarDetailView
                  car={selectedCar}
                  cancelEditingMileageEntry={cancelEditingMileageEntry}
                  cancelEditingService={cancelEditingService}
                  deletingMileageEntryId={deletingMileageEntryId}
                  deletingServiceId={deletingServiceId}
                  editMileageEntryForm={editMileageEntryForm}
                  editServiceForm={editServiceForm}
                  editingMileageEntryId={editingMileageEntryId}
                  editingServiceId={editingServiceId}
                  filteredServiceHistory={filteredServiceHistory}
                  handleDeleteMileageEntry={handleDeleteMileageEntry}
                  handleDeleteService={handleDeleteService}
                  handleSaveMileageEntryEdit={handleSaveMileageEntryEdit}
                  handleSaveServiceEdit={handleSaveServiceEdit}
                  isSavingMileageEntry={isSavingMileageEntry}
                  isSavingService={isSavingService}
                  serviceDateFrom={serviceDateFrom}
                  serviceDateTo={serviceDateTo}
                  serviceSearch={serviceSearch}
                  serviceSort={serviceSort}
                  setTrendDateFrom={setTrendDateFrom}
                  setTrendDateTo={setTrendDateTo}
                  setTrendServiceTypeFilter={setTrendServiceTypeFilter}
                  serviceTypeFilter={serviceTypeFilter}
                  serviceTypeOptions={serviceTypeOptions}
                  setServiceDateFrom={setServiceDateFrom}
                  setServiceDateTo={setServiceDateTo}
                  setServiceSearch={setServiceSearch}
                  setServiceSort={setServiceSort}
                  setServiceTypeFilter={setServiceTypeFilter}
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
                  triggerReminderAction={handleReminderAction}
                  startEditingMileageEntry={startEditingMileageEntry}
                  startEditingService={startEditingService}
                  updateEditMileageEntryField={updateEditMileageEntryField}
                  updateEditServiceField={updateEditServiceField}
                />

                <section className="detail-section detail-management">
                  <div className="detail-section-heading">
                    <h3>Manage Vehicle</h3>
                    <p>Edit profile fields, correct mileage, or remove the vehicle entirely.</p>
                  </div>

                  <form className="form-grid" onSubmit={handleSaveVehicle}>
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
                      onAddRule={addReminderRule}
                      onRemoveRule={removeReminderRule}
                      onUpdateRule={updateReminderRuleField}
                      rules={editCarForm.serviceReminderRules}
                    />

                    <label className="checkbox-row">
                      <input
                        checked={editCarForm.allowMileageCorrection}
                        onChange={(event) =>
                          updateEditCarField("allowMileageCorrection", event.target.checked)
                        }
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
                </section>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-inner">
                  <div className="empty-state-badge">CK</div>
                  <h3>Your vehicle workspace will appear here</h3>
                  <p>
                    Open a vehicle to review its summary, mileage history, service records,
                    and management actions in one place.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function CarDetailView({
  car,
  cancelEditingMileageEntry,
  cancelEditingService,
  deletingMileageEntryId,
  deletingServiceId,
  editMileageEntryForm,
  editServiceForm,
  editingMileageEntryId,
  editingServiceId,
  filteredServiceHistory,
  handleDeleteMileageEntry,
  handleDeleteService,
  handleSaveMileageEntryEdit,
  handleSaveServiceEdit,
  isSavingMileageEntry,
  isSavingService,
  serviceDateFrom,
  serviceDateTo,
  serviceSearch,
  serviceSort,
  setTrendDateFrom,
  setTrendDateTo,
  setTrendServiceTypeFilter,
  serviceTypeFilter,
  serviceTypeOptions,
  setServiceDateFrom,
  setServiceDateTo,
  setServiceSearch,
  setServiceSort,
  setServiceTypeFilter,
  trendAverageMonthlyExpense,
  trendAverageMonthlyMileage,
  trendAverageMonthlyServiceFrequency,
  trendCategoryExpenses,
  trendDateFrom,
  trendDateTo,
  trendExpensePoints,
  trendMilesDriven,
  trendMileagePoints,
  trendServiceTypeFilter,
  triggerReminderAction,
  startEditingMileageEntry,
  startEditingService,
  updateEditMileageEntryField,
  updateEditServiceField
}: {
  car: CarDetails;
  cancelEditingMileageEntry: () => void;
  cancelEditingService: () => void;
  deletingMileageEntryId: number | null;
  deletingServiceId: number | null;
  editMileageEntryForm: {
    mileage: string;
    date: string;
    notes: string;
    allowCorrection: boolean;
  };
  editServiceForm: {
    serviceDate: string;
    mileage: string;
    serviceType: string;
    description: string;
    notes: string;
    cost: string;
  };
  editingMileageEntryId: number | null;
  editingServiceId: number | null;
  filteredServiceHistory: ServiceHistoryItem[];
  handleDeleteMileageEntry: (entryId: number) => Promise<void>;
  handleDeleteService: (serviceId: number) => Promise<void>;
  handleSaveMileageEntryEdit: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  handleSaveServiceEdit: (event: SyntheticEvent<HTMLFormElement>) => Promise<void>;
  isSavingMileageEntry: boolean;
  isSavingService: boolean;
  serviceDateFrom: string;
  serviceDateTo: string;
  serviceSearch: string;
  serviceSort: (typeof serviceSortOptions)[number]["value"];
  setTrendDateFrom: (value: string) => void;
  setTrendDateTo: (value: string) => void;
  setTrendServiceTypeFilter: (value: string) => void;
  serviceTypeFilter: string;
  serviceTypeOptions: string[];
  setServiceDateFrom: (value: string) => void;
  setServiceDateTo: (value: string) => void;
  setServiceSearch: (value: string) => void;
  setServiceSort: (value: (typeof serviceSortOptions)[number]["value"]) => void;
  setServiceTypeFilter: (value: string) => void;
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
  triggerReminderAction: (carId: number, serviceType: string) => Promise<void>;
  startEditingMileageEntry: (entry: MileageHistoryItem) => void;
  startEditingService: (service: ServiceHistoryItem) => void;
  updateEditMileageEntryField: (
    field: "mileage" | "date" | "notes" | "allowCorrection",
    value: string | boolean
  ) => void;
  updateEditServiceField: (
    field: "serviceDate" | "mileage" | "serviceType" | "description" | "notes" | "cost",
    value: string
  ) => void;
}) {
  return (
    <>
      <div className="result-header">
        <div className="result-title">
          <h2>{car.carName}</h2>
          <p className="result-subtitle">
            Centralized vehicle overview, maintenance costs, and mileage history.
          </p>
          {car.needsAttention ? <div className="attention-pill">Maintenance attention recommended</div> : null}
        </div>

        {car.imageUrl ? (
          <div className="car-image-wrap">
            <img alt={`Image of ${car.carName}`} src={car.imageUrl} />
          </div>
        ) : null}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Car ID</div>
          <div className="stat-value">{car.carId}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Current Mileage</div>
          <div className="stat-value">{car.currentMileage.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Last Service</div>
          <div className="stat-value">{car.lastServiceDate}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Lifetime Expenses</div>
          <div className="stat-value">{formatCurrency(car.lifetimeExpenses)}</div>
        </div>
      </div>

      <div className="stats-grid compact">
        <div className="stat-card">
          <div className="stat-label">Service Count</div>
          <div className="stat-value">{car.serviceCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Average Service Cost</div>
          <div className="stat-value">{formatCurrency(car.averageServiceCost)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Miles Since Service</div>
          <div className="stat-value">
            {car.milesSinceLastService === null ? "N/A" : car.milesSinceLastService.toLocaleString()}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Days Since Service</div>
          <div className="stat-value">{car.daysSinceLastService ?? "N/A"}</div>
        </div>
      </div>

      <div className="detail-section">
        <div className={`reminder-card ${car.needsAttention ? "warning" : "ok"}`}>
          <div className="reminder-card-header">
            <div>
              <div className="reminder-title">Service Reminder Watch</div>
              <div className="reminder-copy">
                {car.serviceReminderRules.length === 0
                  ? "No reminder categories configured yet."
                  : `${car.serviceReminderRules.length} configured reminder ${
                      car.serviceReminderRules.length === 1 ? "category" : "categories"
                    }.`}
              </div>
            </div>
            <div className="reminder-status">
              {car.attentionReason ??
                (car.serviceReminderRules.length === 0
                  ? "Add a reminder rule in vehicle settings to start tracking due service."
                  : "No upcoming reminder flags right now.")}
            </div>
          </div>

          {car.serviceReminderRules.length === 0 ? null : (
            <div className="reminder-rule-list">
              {car.categoryReminders.map((reminder) => (
                <ReminderStatusCard
                  carId={car.carId}
                  key={reminder.serviceType}
                  onLogService={triggerReminderAction}
                  reminder={reminder}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="detail-section">
        <div className="detail-section-heading">
          <h3>Trend Snapshot</h3>
          <p>Filter trend data by date range and service category to analyze vehicle usage over time.</p>
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

        <div className="stats-grid compact">
          <div className="stat-card">
            <div className="stat-label">Miles In Scope</div>
            <div className="stat-value">{trendMilesDriven === null ? "N/A" : trendMilesDriven.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Monthly Miles</div>
            <div className="stat-value">
              {trendAverageMonthlyMileage === null ? "N/A" : `${trendAverageMonthlyMileage.toLocaleString()} mi`}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Monthly Expense</div>
            <div className="stat-value">{formatCurrency(trendAverageMonthlyExpense)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Service Events / Month</div>
            <div className="stat-value">
              {trendAverageMonthlyServiceFrequency === null ? "N/A" : trendAverageMonthlyServiceFrequency}
            </div>
          </div>
        </div>

        <div className="trend-grid">
          <TrendCard
            emptyLabel="Mileage trend will appear after a few recorded entries."
            label="Mileage Trend"
            points={trendMileagePoints}
            prefix=""
            suffix=" mi"
          />
          <TrendCard
            emptyLabel="Expense trend will appear after you add priced service records."
            label="Expense Trend"
            points={trendExpensePoints}
            prefix="$"
            suffix=""
          />
        </div>

        <div className="category-section">
          <h4>Expense By Service Category</h4>
          {trendCategoryExpenses.length === 0 ? (
            <div className="service-card">
              <div className="service-notes muted-text">No service costs match the current trend filters.</div>
            </div>
          ) : (
            <div className="category-list">
              {trendCategoryExpenses.map((item) => (
                <CategoryExpenseCard item={item} key={item.category} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="detail-section">
        <div className="detail-section-heading">
          <h3>Service History</h3>
          <p>Filter by category or search by notes, type, and description.</p>
        </div>

        <div className="toolbar-grid">
          <div className="field-group">
            <label htmlFor="serviceSearch">Search Records</label>
            <input
              id="serviceSearch"
              onChange={(event) => setServiceSearch(event.target.value)}
              placeholder="Oil, brakes, dealer, rotation..."
              type="text"
              value={serviceSearch}
            />
          </div>
          <div className="field-group">
            <label htmlFor="serviceTypeFilter">Category</label>
            <select
              id="serviceTypeFilter"
              onChange={(event) => setServiceTypeFilter(event.target.value)}
              value={serviceTypeFilter}
            >
              <option value="all">All categories</option>
              {serviceTypeOptions.map((serviceType) => (
                <option key={serviceType} value={serviceType}>
                  {serviceType}
                </option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="serviceDateFrom">From Date</label>
            <input
              id="serviceDateFrom"
              onChange={(event) => setServiceDateFrom(event.target.value)}
              type="date"
              value={serviceDateFrom}
            />
          </div>
          <div className="field-group">
            <label htmlFor="serviceDateTo">To Date</label>
            <input
              id="serviceDateTo"
              onChange={(event) => setServiceDateTo(event.target.value)}
              type="date"
              value={serviceDateTo}
            />
          </div>
          <div className="field-group">
            <label htmlFor="serviceSort">Sort By</label>
            <select
              id="serviceSort"
              onChange={(event) =>
                setServiceSort(event.target.value as (typeof serviceSortOptions)[number]["value"])
              }
              value={serviceSort}
            >
              {serviceSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredServiceHistory.length === 0 ? (
          <div className="service-card">
            <div className="service-notes muted-text">No service records match the current filters.</div>
          </div>
        ) : (
          <div className="service-list">
            {filteredServiceHistory.map((service) => (
              <div className="service-card" key={service.serviceId}>
                <div className="service-top">
                  <div className="service-type">{service.serviceType || "Service Entry"}</div>
                  <div className="service-actions">
                    <div className="service-date">{service.date}</div>
                    <button
                      className="btn btn-inline"
                      onClick={() => startEditingService(service)}
                      type="button"
                    >
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
                  </div>
                </div>

                <div className="service-meta">
                  <div className="service-meta-item">
                    <div className="service-meta-label">Mileage</div>
                    <div className="service-meta-value">{service.mileage.toLocaleString()}</div>
                  </div>
                  <div className="service-meta-item">
                    <div className="service-meta-label">Cost</div>
                    <div className="service-meta-value">{formatCurrency(service.cost)}</div>
                  </div>
                  <div className="service-meta-item">
                    <div className="service-meta-label">Service ID</div>
                    <div className="service-meta-value">{service.serviceId}</div>
                  </div>
                </div>

                <div className="service-notes">
                  <div>
                    <strong>Description:</strong> {service.description || "N/A"}
                  </div>
                  <div className="service-notes-row">
                    <strong>Notes:</strong> {service.notes || "N/A"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingServiceId !== null ? (
        <div className="detail-section">
          <div className="detail-section-heading">
            <h3>Edit Service Record</h3>
            <p>Update the service date, mileage, category, cost, and notes.</p>
          </div>

          <form className="form-grid" onSubmit={handleSaveServiceEdit}>
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
        </div>
      ) : null}

      <div className="detail-section">
        <div className="detail-section-heading">
          <h3>Mileage Timeline</h3>
          <p>Review how the vehicle mileage has changed over time and manage manual entries.</p>
        </div>

        <div className="timeline-list">
          {car.mileageHistory.map((entry) => (
            <MileageEntryCard
              deletingMileageEntryId={deletingMileageEntryId}
              entry={entry}
              handleDeleteMileageEntry={handleDeleteMileageEntry}
              startEditingMileageEntry={startEditingMileageEntry}
              key={entry.entryId}
            />
          ))}
        </div>
      </div>

      {editingMileageEntryId !== null ? (
        <div className="detail-section">
          <div className="detail-section-heading">
            <h3>Edit Mileage Entry</h3>
            <p>Update the recorded date, mileage, and notes for this manual entry.</p>
          </div>

          <form className="form-grid" onSubmit={handleSaveMileageEntryEdit}>
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
                onChange={(event) =>
                  updateEditMileageEntryField("allowCorrection", event.target.checked)
                }
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
        </div>
      ) : null}
    </>
  );
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
          <label>Reminder Rules</label>
          <p>Configure only the service categories you want CarKeeper to monitor.</p>
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
          <div className="service-notes muted-text">No reminder rules configured yet.</div>
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

              <div className="field-row">
                <div className="field-group">
                  <label htmlFor={`${prefix}ReminderDays-${index}`}>Interval Days</label>
                  <input
                    id={`${prefix}ReminderDays-${index}`}
                    min="1"
                    onChange={(event) =>
                      onUpdateRule(mode, index, "intervalDays", event.target.value)
                    }
                    required
                    type="number"
                    value={rule.intervalDays}
                  />
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReminderWatchGroup({
  emptyLabel,
  items,
  label,
  onLogService,
  onOpenCar
}: {
  emptyLabel: string;
  items: AttentionItem[];
  label: string;
  onLogService: (carId: number, serviceType: string) => Promise<void>;
  onOpenCar: (carId: string | number, successMessage?: string) => Promise<CarDetails | void>;
}) {
  return (
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
              <span>{item.currentMileage.toLocaleString()} mi</span>
              <span>Last service {item.lastServiceDate}</span>
              <span>
                {item.milesUntilDue === null ? "Mileage target N/A" : `${item.milesUntilDue.toLocaleString()} mi left`}
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
            Every {reminder.intervalMiles.toLocaleString()} miles or {reminder.intervalDays} days
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
            : `${reminder.latestServiceDate} at ${reminder.latestServiceMileage?.toLocaleString() ?? "N/A"} mi`}
        </span>
        <span>
          Next mileage target:{" "}
          {reminder.nextServiceMileage === null ? "N/A" : `${reminder.nextServiceMileage.toLocaleString()} mi`}
        </span>
        <span>
          Miles until due:{" "}
          {reminder.milesUntilDue === null ? "N/A" : `${reminder.milesUntilDue.toLocaleString()} mi`}
        </span>
        <span>Days until due: {reminder.daysUntilDue === null ? "N/A" : reminder.daysUntilDue}</span>
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
  return (
    <div className="timeline-card">
      <div className="timeline-top">
        <div className="timeline-date">{entry.date}</div>
        <div className="timeline-actions">
          <div className="timeline-mileage">{entry.mileage.toLocaleString()} mi</div>
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
                {Math.round(point.value).toLocaleString()}
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

function buildReportUrl(
  filters: { carId: string; dateFrom: string; dateTo: string },
  format?: "csv"
) {
  const params = new URLSearchParams();

  if (filters.carId) {
    params.set("carId", filters.carId);
  }

  if (filters.dateFrom) {
    params.set("dateFrom", filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set("dateTo", filters.dateTo);
  }

  if (format) {
    params.set("format", format);
  }

  const query = params.toString();
  return query ? `/api/reports?${query}` : "/api/reports";
}

function getReportFileName(filters: { carId: string; dateFrom: string; dateTo: string }) {
  const scope = filters.carId ? `car-${filters.carId}` : "garage";
  const start = filters.dateFrom || "all";
  const end = filters.dateTo || "all";
  return `carkeeper-report-${scope}-${start}-to-${end}.csv`;
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

function compareServices(
  left: ServiceHistoryItem,
  right: ServiceHistoryItem,
  sort: (typeof serviceSortOptions)[number]["value"]
) {
  const leftDate = parseDisplayDate(left.date).getTime();
  const rightDate = parseDisplayDate(right.date).getTime();
  const leftCost = left.cost ?? -1;
  const rightCost = right.cost ?? -1;

  switch (sort) {
    case "date-asc":
      return leftDate - rightDate;
    case "mileage-desc":
      return right.mileage - left.mileage;
    case "mileage-asc":
      return left.mileage - right.mileage;
    case "cost-desc":
      return rightCost - leftCost;
    case "cost-asc":
      return leftCost - rightCost;
    case "type-asc":
      return left.serviceType.localeCompare(right.serviceType);
    case "date-desc":
    default:
      return rightDate - leftDate;
  }
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
