$(function () {
    const $inputtedID = $("#entered_car_id");
    const $enterButton = $("#enter_btn");
    const $addCarButton = $("#add_car_btn");
    const $make = $("#make");
    const $model = $("#model");
    const $year = $("#year");
    const $mileage = $("#mileage");
    const $imageURL = $("#image_url");
    // Added
    const $addServiceButton = $("#add_service_btn");
    const $serviceCarID = $("#service_car_id");
    const $serviceDate = $("#service_date");
    const $serviceMileage = $("#service_mileage");
    const $serviceType = $("#service_type");
    const $serviceDescription = $("#service_description");
    const $serviceNotes = $("#service_notes");
    const $serviceCost = $("#service_cost");
    //
    const $out = $("#car_result");

    function renderCarSummary(car) {
        let html = `
            <h3>Car Summary</h3>
            <ul>
                <li><b>Car ID:</b> ${car["Car ID"]}</li>
                <li><b>Car Name:</b> ${car["Car Name"]}</li>
                <li><b>Current Mileage:</b> ${car["Current Mileage"]}</li>
                <li><b>Last Service Date:</b> ${car["Last Service Date"]}</li>
                <li><b>Lifetime Expenses:</b> ${car["Lifetime Expenses"]}</li>
                <li><b>Service Count:</b> ${car["Service Count"]}</li>
            </ul>
        `;

        if (car["Image URL"]) {
            html += `
                <img
                    src="${car["Image URL"]}"
                    alt="Image of ${car["Car Name"]}"
                    style="max-width: 300px; display: block; margin-top: 10px;"
                >
            `;
        }

        const history = car["Service History"] || [];

        html += `<h3 style="margin-top: 24px;">Service History</h3>`;

        if (history.length === 0) {
            html += `<p>No service history recorded yet.</p>`;
        } else {
            html += `<ul>`;
            history.forEach(service => {
                html += `
                    <li style="margin-bottom: 14px;">
                        <b>${service["Date"]}</b> — ${service["Service Type"]} at ${service["Mileage"]} miles
                        <br>
                        <b>Description:</b> ${service["Description"] || "N/A"}
                        <br>
                        <b>Notes:</b> ${service["Notes"] || "N/A"}
                        <br>
                        <b>Cost:</b> ${service["Cost"] !== null && service["Cost"] !== undefined ? `$${service["Cost"]}` : "N/A"}
                    </li>
                `;
            });
            html += `</ul>`;
        }

        $out.html(html);
    }

    function renderError(msg) {
        $out.html(`<p style="color:red;"><b>${msg}</b></p>`);
    }

    function lookupCar() {
        const id = $inputtedID.val().trim();

        if (!id) {
            renderError("Enter a car id.");
            return;
        }

        $.ajax({
            url: "/car_info",
            method: "GET",
            dataType: "json",
            data: { car_id: id },

            success: function (data) {
                console.log("Request succeeded: car_info?id=" + id);
                console.log("Response data:", data);
                renderCarSummary(data);
            },

            error: function (xhr) {
                console.log("Request failed: car_info?id=" + id);
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
        const make = $make.val().trim()
        const model = $model.val().trim()
        const year = $year.val().trim()
        const mileage = $mileage.val().trim()
        const image_url = $imageURL.val().trim()

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

            // If the request succeeds, run the function and store the returned response into data
            success: function(data) {
                console.log("Car added successfully.");
                console.log("Response data:", data);
                renderCarSummary(data);

                // Clear form inputs
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
                renderCarSummary(data);

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

    // Click button interactions
    $enterButton.on("click", lookupCar);
    $addCarButton.on("click", addCar);
    $addServiceButton.on("click", addService);

    // Press Enter on keyboard -> lookup
    $inputtedID.on("keydown", function (e) {
        if (e.key === "Enter") lookupCar();
    });
});