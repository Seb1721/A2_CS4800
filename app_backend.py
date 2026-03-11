from flask import Flask, render_template, request, jsonify
from pprint import pformat
from carkeeper_app import add_car, add_service, update_mileage, list_cars, find_car, car_summary

app = Flask(__name__)

# Seed with test values to showcase functionality
_seeded = False
def seed():
    global _seeded
    if _seeded:
        return
    _seeded = True

    if len(list_cars()) > 0:
        return

    c1 = add_car("Honda", "Civic", 2018, 116000,
                 "https://file.kelleybluebookimages.com/kbb/base/evox/CP/11185/2018-Honda-Civic-front_11185_032_2400x1800_WA.png"
    )
    
    c2 = add_car("Toyota", "Camry", 2012, 153200,
                 "https://file.kelleybluebookimages.com/kbb/images/content/editorial/2012%20Toyota%20Camry%20SE%20Limited%20Edition%20front%20static.jpg"
    )

    add_service(c1["car_id"], "02/20/26", 116000, "Oil", "Oil change", notes="0W-20 synthetic", cost="52.10")
    add_service(c1["car_id"], "03/10/26", 116400, "Inspection", "Safety check", notes="No charge", cost="")

    add_service(c2["car_id"], "01/15/26", 153200, "Brakes", "Pads", notes="Front pads", cost="220")

# Index and current landing page
@app.route("/")
def start_index_route():
    seed()
    return render_template("index.html")

# Placeholder / may remove
@app.route("/all_cars")
def all_cars_route():
    seed()
    summaries = [car_summary(c) for c in list_cars()]

    return "<pre>" + pformat(summaries) + "</pre>"

@app.route("/car_info")
def car_info_route():
    seed()
    try:
        car_id = int(request.args.get("car_id", "0"))
    except ValueError:
        return jsonify({"error": "Car id must be a valid number."}), 400

    c = find_car(car_id)
    if not c:
        return jsonify({"error": f"Car id {car_id} not found"}), 404
    
    return jsonify(car_summary(c)) 

@app.route("/add_car", methods=["POST"])
def add_car_route():
    seed()
    data = request.get_json()

    try:
        make = data.get("make", "").strip()
        model = data.get("model", "").strip()
        year = int(data.get("year", 0))
        mileage = int(data.get("mileage", 0))
        image_url = data.get("image_url", "").strip()

        if not make or not model:
            return jsonify({"error": "Make and model are required."}), 400
        
        if year <= 0:
            return jsonify({"error": "Enter a valid year."}), 400
        
        if mileage < 0:
            return jsonify({"error": "Mileage cannot be negative."}), 400
        
        new_car = add_car(make, model, year, mileage, image_url)

        return jsonify(car_summary(new_car)), 201

    except ValueError:
        return jsonify({"error": "Year and mileage must be valid numbers."}), 400

@app.route("/add_service", methods=["POST"])
def add_service_route():
    seed()
    data = request.get_json()

    try:
        car_id = int(data.get("car_id", 0))
        service_date = data.get("service_date", "").strip()
        mileage = int(data.get("mileage", 0))
        service_type = data.get("service_type", "").strip()
        description = data.get("description", "").strip()
        notes = data.get("notes", "").strip()
        cost = data.get("cost", "")

        if car_id <= 0:
            return jsonify({"error": "Enter a valid car ID."}), 400

        if not service_date or not service_type:
            return jsonify({"error": "Service date and service type are required."}), 400

        if mileage < 0:
            return jsonify({"error": "Mileage cannot be negative."}), 400

        car = find_car(car_id)
        if not car:
            return jsonify({"error": f"Car id {car_id} not found"}), 404

        add_service(car_id, service_date, mileage, service_type, description, notes, cost)

        updated_car = find_car(car_id)
        return jsonify(car_summary(updated_car)), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)