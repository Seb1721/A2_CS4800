"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import type { CarDetails, CarSummary } from "@/lib/types";

type DashboardClientProps = {
  initialCars: CarSummary[];
  username: string;
};

const emptyCarForm = {
  make: "",
  model: "",
  year: "",
  mileage: "",
  imageUrl: ""
};

const emptyServiceForm = {
  carId: "",
  serviceDate: "",
  mileage: "",
  serviceType: "",
  description: "",
  notes: "",
  cost: ""
};

export function DashboardClient({ initialCars, username }: DashboardClientProps) {
  const router = useRouter();
  const [cars, setCars] = useState(initialCars);
  const [selectedCar, setSelectedCar] = useState<CarDetails | null>(null);
  const [lookupId, setLookupId] = useState("");
  const [carForm, setCarForm] = useState(emptyCarForm);
  const [serviceForm, setServiceForm] = useState(emptyServiceForm);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  function updateCarField(field: keyof typeof emptyCarForm, value: string) {
    setCarForm((current) => ({ ...current, [field]: value }));
  }

  function updateServiceField(field: keyof typeof emptyServiceForm, value: string) {
    setServiceForm((current) => ({ ...current, [field]: value }));
  }

  async function refreshCars() {
    const response = await fetch("/api/cars", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Could not refresh the car list.");
    }
    const updatedCars = (await response.json()) as CarSummary[];
    setCars(updatedCars);
  }

  async function fetchCar(carId: string | number, successMessage?: string) {
    setMessage(null);
    const response = await fetch(`/api/cars/${carId}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error ?? "Could not load car.");
    }

    setSelectedCar(payload as CarDetails);
    if (successMessage) {
      setMessage({ type: "success", text: successMessage });
    }
  }

  async function handleLookup(event?: FormEvent) {
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

  async function handleAddCar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const response = await fetch("/api/cars", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          make: carForm.make,
          model: carForm.model,
          year: Number(carForm.year),
          mileage: Number(carForm.mileage),
          imageUrl: carForm.imageUrl
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not add car.");
      }

      const createdCar = payload as CarDetails;
      setCarForm(emptyCarForm);
      setLookupId(String(createdCar.carId));
      setSelectedCar(createdCar);
      await refreshCars();
      setMessage({ type: "success", text: "Car added successfully." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not add car." });
    }
  }

  async function handleAddService(event: FormEvent<HTMLFormElement>) {
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
          serviceDate: serviceForm.serviceDate,
          mileage: Number(serviceForm.mileage),
          serviceType: serviceForm.serviceType,
          description: serviceForm.description,
          notes: serviceForm.notes,
          cost: serviceForm.cost
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not add service.");
      }

      const updatedCar = payload as CarDetails;
      setServiceForm(emptyServiceForm);
      setLookupId(String(updatedCar.carId));
      setSelectedCar(updatedCar);
      await refreshCars();
      setMessage({ type: "success", text: "Service record added successfully." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Could not add service." });
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

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="top-bar">
          <div>
            <h1>CarKeeper</h1>
            <p>
              Securely manage mileage, maintenance, and ownership costs in a single Next.js
              dashboard backed by MongoDB.
            </p>
            <div className="hero-meta">
              <div className="meta-chip">Next.js App Router</div>
              <div className="meta-chip">MongoDB-backed data</div>
              <div className="meta-chip">Private per-user records</div>
            </div>
          </div>

          <div className="account-panel">
            <div className="signed-in-card">
              <span className="signed-in-label">Signed in as</span>
              <span className="signed-in-name">{username}</span>
            </div>
            <button className="btn btn-ghost" disabled={isLoggingOut} onClick={handleLogout} type="button">
              {isLoggingOut ? "Signing out..." : "Log Out"}
            </button>
          </div>
        </div>
      </section>

      <div className="dashboard-grid">
        <div className="left-column">
          <section className="card">
            <div className="card-header">
              <h2>Find a Car</h2>
              <p>Search by car ID to load its latest service history and mileage snapshot.</p>
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
                  View Car
                </button>
              </form>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Add New Car</h2>
              <p>Create a private vehicle record connected to your account.</p>
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

                <button className="btn btn-primary" type="submit">
                  Add Car
                </button>
              </form>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2>Add Service</h2>
              <p>Record completed maintenance for a car that belongs to your account.</p>
            </div>
            <div className="card-body">
              <form className="form-grid" onSubmit={handleAddService}>
                <div className="field-row">
                  <div className="field-group">
                    <label htmlFor="serviceCarId">Car ID</label>
                    <input
                      id="serviceCarId"
                      min="1"
                      onChange={(event) => updateServiceField("carId", event.target.value)}
                      placeholder="1"
                      required
                      type="number"
                      value={serviceForm.carId}
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="serviceDate">Service Date</label>
                    <input
                      id="serviceDate"
                      onChange={(event) => updateServiceField("serviceDate", event.target.value)}
                      placeholder="MM/DD/YY"
                      required
                      type="text"
                      value={serviceForm.serviceDate}
                    />
                  </div>
                </div>

                <div className="field-row">
                  <div className="field-group">
                    <label htmlFor="serviceMileage">Mileage at Service</label>
                    <input
                      id="serviceMileage"
                      min="0"
                      onChange={(event) => updateServiceField("mileage", event.target.value)}
                      placeholder="116500"
                      required
                      type="number"
                      value={serviceForm.mileage}
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="serviceType">Service Type</label>
                    <input
                      id="serviceType"
                      onChange={(event) => updateServiceField("serviceType", event.target.value)}
                      placeholder="Oil Change"
                      required
                      type="text"
                      value={serviceForm.serviceType}
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label htmlFor="serviceDescription">Description</label>
                  <input
                    id="serviceDescription"
                    onChange={(event) => updateServiceField("description", event.target.value)}
                    placeholder="Optional description"
                    type="text"
                    value={serviceForm.description}
                  />
                </div>

                <div className="field-group">
                  <label htmlFor="serviceNotes">Notes</label>
                  <input
                    id="serviceNotes"
                    onChange={(event) => updateServiceField("notes", event.target.value)}
                    placeholder="Optional notes"
                    type="text"
                    value={serviceForm.notes}
                  />
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

                <button className="btn btn-secondary" type="submit">
                  Add Service
                </button>
              </form>
            </div>
          </section>
        </div>

        <div className="right-column">
          <section className="card inventory-card">
            <div className="card-header">
              <h2>Your Garage</h2>
              <p>Every car below belongs to the currently signed-in account.</p>
            </div>
            <div className="card-body inventory-list">
              {cars.length === 0 ? (
                <div className="inventory-empty">No cars yet. Add your first vehicle to get started.</div>
              ) : (
                cars.map((car) => (
                  <button
                    className="inventory-item"
                    key={car.carId}
                    onClick={() => void fetchCar(car.carId)}
                    type="button"
                  >
                    <div className="inventory-item-title">{car.carName}</div>
                    <div className="inventory-item-meta">
                      <span>ID {car.carId}</span>
                      <span>{car.currentMileage.toLocaleString()} mi</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="result-panel">
            {message ? <div className={`status-card ${message.type}`}>{message.text}</div> : null}

            {selectedCar ? (
              <CarDetailView car={selectedCar} />
            ) : (
              <div className="empty-state">
                <div className="empty-state-inner">
                  <div className="empty-state-badge">CK</div>
                  <h3>Your vehicle dashboard will appear here</h3>
                  <p>
                    Search by car ID or select a car from your garage to view its summary,
                    service history, and total recorded costs.
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

function CarDetailView({ car }: { car: CarDetails }) {
  return (
    <>
      <div className="result-header">
        <div className="result-title">
          <h2>{car.carName}</h2>
          <p className="result-subtitle">
            Vehicle overview, maintenance history, and cost tracking in one place.
          </p>
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
          <div className="stat-label">Status</div>
          <div className="stat-value stat-status">Tracked Vehicle</div>
        </div>
      </div>

      <div className="detail-section">
        <h3>Service History</h3>

        {car.serviceHistory.length === 0 ? (
          <div className="service-card">
            <div className="service-notes muted-text">No service history has been recorded yet.</div>
          </div>
        ) : (
          <div className="service-list">
            {car.serviceHistory.map((service) => (
              <div className="service-card" key={service.serviceId}>
                <div className="service-top">
                  <div className="service-type">{service.serviceType || "Service Entry"}</div>
                  <div className="service-date">{service.date}</div>
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
    </>
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
