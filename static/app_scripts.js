$(function () {
    const $inputtedID = $("#entered_car_id");
    const $enterButton = $("#enter_btn");

    const $addCarButton = $("#add_car_btn");
    const $make = $("#make");
    const $model = $("#model");
    const $year = $("#year");
    const $mileage = $("#mileage");
    const $imageURL = $("#image_url");

    const $addServiceButton = $("#add_service_btn");
    const $serviceCarID = $("#service_car_id");
    const $serviceDate = $("#service_date");
    const $serviceMileage = $("#service_mileage");
    const $serviceType = $("#service_type");
    const $serviceDescription = $("#service_description");
    const $serviceNotes = $("#service_notes");
    const $serviceCost = $("#service_cost");

    const $out = $("#car_result");

    function formatCurrency(value) {
        if (value === null || value === undefined || value === "") return "N/A";
        const num = Number(value);
        if (Number.isNaN(num)) return value;
        return `$${num.toFixed(2)}`;
    }

    function renderMessage(type, msg) {
        $out.html(`
            <div class="status-card ${type}">
                ${msg}
            </div>
        `);
    }

    function renderError(msg) {
        $out.html(`
            <div class="status-card error">
                ${msg}
            </div>
            <div class="empty-state" style="min-height: 280px;">
                <div class="empty-state-inner">
                    <div class="empty-state-badge">!</div>
                    <h3>We couldn’t complete that action</h3>
                    <p>${msg}</p>
                </div>
            </div>
        `);
    }

    function renderCarSummary(car, successMessage = "") {
        const history = car["Service History"] || [];
        const hasImage = Boolean(car["Image URL"]);

        let html = "";

        if (successMessage) {
            html += `<div class="status-card success">${successMessage}</div>`;
        }

        html += `
            <div class="result-header">
                <div class="result-title">
                    <h2>${car["Car Name"]}</h2>
                    <p class="result-subtitle">
                        Vehicle overview, maintenance activity, and cost tracking in one place.
                    </p>
                </div>
                ${hasImage ? `
                    <div class="car-image-wrap">
                        <img src="${car["Image URL"]}" alt="Image of ${car["Car Name"]}">
                    </div>
                ` : ""}
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Car ID</div>
                    <div class="stat-value">${car["Car ID"]}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Current Mileage</div>
                    <div class="stat-value">${car["Current Mileage"]}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Last Service</div>
                    <div class="stat-value">${car["Last Service Date"]}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Lifetime Expenses</div>
                    <div class="stat-value">${formatCurrency(car["Lifetime Expenses"])}</div>
                </div>
            </div>

            <div class="stats-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
                <div class="stat-card">
                    <div class="stat-label">Service Count</div>
                    <div class="stat-value">${car["Service Count"]}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Status</div>
                    <div class="stat-value" style="font-size: 18px;">Tracked Vehicle</div>
                </div>
            </div>

            <div class="detail-section">
                <h3>Service History</h3>
        `;

        if (history.length === 0) {
            html += `
                <div class="service-card">
                    <div class="service-notes muted-text">
                        No service history has been recorded for this car yet.
                    </div>
                </div>
            `;
        } else {
            html += `<div class="service-list">`;

            history.forEach(service => {
                html += `
                    <div class="service-card">
                        <div class="service-top">
                            <div class="service-type">${service["Service Type"] || "Service Entry"}</div>
                            <div class="service-date">${service["Date"] || "N/A"}</div>
                        </div>

                        <div class="service-meta">
                            <div class="service-meta-item">
                                <div class="service-meta-label">Mileage</div>
                                <div class="service-meta-value">${service["Mileage"] ?? "N/A"}</div>
                            </div>
                            <div class="service-meta-item">
                                <div class="service-meta-label">Cost</div>
                                <div class="service-meta-value">${formatCurrency(service["Cost"])}</div>
                            </div>
                            <div class="service-meta-item">
                                <div class="service-meta-label">Service ID</div>
                                <div class="service-meta-value">${service["Service ID"] ?? "N/A"}</div>
                            </div>
                        </div>

                        <div class="service-notes">
                            <div><strong>Description:</strong> ${service["Description"] || "N/A"}</div>
                            <div style="margin-top: 6px;"><strong>Notes:</strong> ${service["Notes"] || "N/A"}</div>
                        </div>
                    </div>
                `;
            });

            html += `</div>`;
        }

        html += `</div>`;

        $out.html(html);
    }

    function lookupCar() {
        const id = $inputtedID.val().trim();

        if (!id) {
            renderError("Enter a car ID.");
            return;
        }

        $.ajax({
            url: "/car_info",
            method: "GET",
            dataType: "json",
            data: { car_id: id },

            success: function (data) {
                console.log("Request succeeded: /car_info?car_id=" + id);
                console.log("Response data:", data);
                renderCarSummary(data);
            },

            error: function (xhr) {
                console.log("Request failed: /car_info?car_id=" + id);
                console.log("HTTP status:", xhr.status);

                let msg = "Could not fetch car.";
                if (xhr.responseJSON && xhr.responseJSON.error) {
                    msg = xhr.responseJSON.error;
                } else if (xhr.status === 404) {
                    msg = "Car not found.";
                }
                renderError(msg);
            }
        });
    }

    function addCar() {
        const make = $make.val().trim();
        const model = $model.val().trim();
        const year = $year.val().trim();
        const mileage = $mileage.val().trim();
        const image_url = $imageURL.val().trim();

        if (!make || !model || !year || !mileage) {
            renderError("Make, model, year, and mileage are required.");
            return;
        }

        $.ajax({
            url: "/add_car",
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({
                make: make,
                model: model,
                year: year,
                mileage: mileage,
                image_url: image_url
            }),

            success: function (data) {
                console.log("Car added successfully.");
                console.log("Response data:", data);
                renderCarSummary(data, "Car added successfully.");

                $make.val("");
                $model.val("");
                $year.val("");
                $mileage.val("");
                $imageURL.val("");
            },

            error: function (xhr) {
                console.log("Add car failed.");
                console.log("HTTP status:", xhr.status);

                let msg = "Could not add car.";
                if (xhr.responseJSON && xhr.responseJSON.error) {
                    msg = xhr.responseJSON.error;
                }
                renderError(msg);
            }
        });
    }

    function addService() {
        const car_id = $serviceCarID.val().trim();
        const service_date = $serviceDate.val().trim();
        const mileage = $serviceMileage.val().trim();
        const service_type = $serviceType.val().trim();
        const description = $serviceDescription.val().trim();
        const notes = $serviceNotes.val().trim();
        const cost = $serviceCost.val().trim();

        if (!car_id || !service_date || !mileage || !service_type) {
            renderError("Car ID, service date, mileage, and service type are required.");
            return;
        }

        $.ajax({
            url: "/add_service",
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({
                car_id: car_id,
                service_date: service_date,
                mileage: mileage,
                service_type: service_type,
                description: description,
                notes: notes,
                cost: cost
            }),

            success: function (data) {
                console.log("Service added successfully.");
                console.log("Response data:", data);
                renderCarSummary(data, "Service record added successfully.");

                $serviceCarID.val("");
                $serviceDate.val("");
                $serviceMileage.val("");
                $serviceType.val("");
                $serviceDescription.val("");
                $serviceNotes.val("");
                $serviceCost.val("");
            },

            error: function (xhr) {
                console.log("Add service failed.");
                console.log("HTTP status:", xhr.status);

                let msg = "Could not add service.";
                if (xhr.responseJSON && xhr.responseJSON.error) {
                    msg = xhr.responseJSON.error;
                }
                renderError(msg);
            }
        });
    }

    $enterButton.on("click", lookupCar);
    $addCarButton.on("click", addCar);
    $addServiceButton.on("click", addService);

    $inputtedID.on("keydown", function (e) {
        if (e.key === "Enter") lookupCar();
    });
});