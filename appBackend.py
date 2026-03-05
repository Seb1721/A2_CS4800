from flask import Flask, render_template, request, jsonify
from pprint import pformat
from app_database import add_car, add_service, update_mileage, list_cars, find_car, car_summary

app = Flask(__name__)

# Seeds with test values to showcase functionality
_seeded = False
def seed():
    global _seeded
    if _seeded:
        return
    _seeded = True

    c1 = add_car("Honda", "Civic", 2018, 116000)
    c2 = add_car("Toyota", "Camry", 2012, 153200)

    add_service(c1["id"], "02/20/26", 116000, "Oil", "Oil change", notes="0W-20 synthetic", cost="52.10")
    add_service(c1["id"], "03/10/26", 116400, "Inspection", "Safety check", notes="No charge", cost="")

    add_service(c2["id"], "01/15/26", 153200, "Brakes", "Pads", notes="Front pads", cost="220")

# Index and current landing page
@app.route("/")
def start_index():
    seed()
    return render_template("index.html")

# Placeholder / may remove
@app.route("/all_cars")
def all_cars():
    seed()
    summaries = [car_summary(c) for c in list_cars()]

    return "<pre>" + pformat(summaries) + "</pre>"

@app.route("/car_info")
def car_info():
    seed()
    # 'request.args' holds the arguments being passed into the url query (after the ?).
    # In the test case it's the id=1 located in the url. If the id cannot be found, use 0 to trigger warning
    car_id = int(request.args.get("id", "0"))
    c = find_car(car_id)
    if not c:
        return jsonify({"error": f"Car id {car_id} not found"}), 404
    
    return jsonify(car_summary(c))  

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)