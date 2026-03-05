$(function () {
    const $inputtedID = $("#entered_car_id");
    const $enterButton = $("#enter_btn");
    const $out = $("#car_result");

    function renderCarSummary(car) {
        $out.html(`
            <h3>Car Summary</h3>
            <ul>
                <li><b>Car ID:</b> ${car["Car ID"]}</li>
                <li><b>Car Name:</b> ${car["Car Name"]}</li>
                <li><b>Current Mileage:</b> ${car["Current Mileage"]}</li>
                <li><b>Last Service Date:</b> ${car["Last Service Date"]}</li>
                <li><b>Lifetime Expenses:</b> ${car["Lifetime Expenses"]}</li>
            </ul>
        `);
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
            data: { id: id },

            success: function (data) {
                console.log("Request succeeded: /car?id=" + id);
                console.log("Response data:", data);
                renderCarSummary(data);
            },

            error: function (xhr) {
                console.log("Request failed: /car?id=" + id);
                console.log("HTTP status:", xhr.status);

            if (xhr.responseJSON) {
                console.log("Response JSON:", xhr.responseJSON);
            //} else {
            //     console.log("Response text:", xhr.responseText);
            }

            let msg = "Could not fetch car.";
            if (xhr.responseJSON && xhr.responseJSON.error) {
            msg = xhr.responseJSON.error;
            } else if (xhr.status === 404) {
            msg = "Car not found.";
            }
            renderError(msg);
            },
        });
    }

    // Click button -> lookup
    $enterButton.on("click", lookupCar);

    // Press Enter in input -> lookup
    $inputtedID.on("keydown", function (e) {
        if (e.key === "Enter") lookupCar();
    });
});