from flask import Flask, render_template, request
from pprint import pformat
from car_database import add_car, add_service, update_mileage, list_cars, find_car, car_summary

app = Flask(__name__)

# Seed with test values to showcase functionality
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

@app.route("/")
def start_index():
    return render_template("index.html")

@app.route("/test")
def home():
    seed()
    # Use &amp; so the page displays '&' correctly (HTML escaping)
    # %20 in notes means a space in the URL
    return (
        "Try these URLs:<br>"
        "/cars<br>"
        "/car?id=1<br>"
        "/add_car?make=Ford&amp;model=Ranger&amp;year=2004&amp;current_mileage=210000<br>"
        "/mileage?car_id=1&amp;new_mileage=116900<br>"
        "/service?car_id=1&amp;date=03/20/26&amp;mileage=116800&amp;category=Oil&amp;subcategory=Topoff&amp;notes=Added%201qt&amp;cost=9.50<br>"
    )


@app.route("/cars")
def cars():
    seed()
    summaries = [car_summary(c) for c in list_cars()]
    return "<pre>" + pformat(summaries) + "</pre>"


@app.route("/car")
def car():
    seed()
    # 'request.args' holds the arguments being passed into the url query (after the ?).
    # In the test case it's the id=1 located in the url. If the id cannot be found, use 0 to trigger warning
    car_id = int(request.args.get("id", "0"))
    c = find_car(car_id)
    if not c:
        return f"Car id {car_id} not found", 404
    return "<pre>" + pformat(c) + "</pre>"


@app.route("/add_car")
def add_car_route():
    seed()
    make = request.args.get("make", "")
    model = request.args.get("model", "")
    year = request.args.get("year", "")
    current_mileage = request.args.get("current_mileage", "0")

    if not (make and model and year):
        return "Missing make/model/year", 400

    c = add_car(make, model, year, current_mileage)
    return "<pre>" + pformat(car_summary(c)) + "</pre>"


@app.route("/mileage")
def mileage():
    seed()
    car_id = int(request.args.get("car_id", "0"))
    new_mileage = request.args.get("new_mileage", "")

    try:
        c = update_mileage(car_id, new_mileage)
        return "<pre>" + pformat(car_summary(c)) + "</pre>"
    except Exception as e:
        return str(e), 400


@app.route("/service")
def service():
    seed()
    car_id = int(request.args.get("car_id", "0"))
    date = request.args.get("date", "")
    mileage = request.args.get("mileage", "")
    category = request.args.get("category", "")
    subcategory = request.args.get("subcategory", "")
    notes = request.args.get("notes", "")
    cost = request.args.get("cost", "")

    try:
        entry = add_service(car_id, date, mileage, category, subcategory, notes=notes, cost=cost)
        return "<pre>" + pformat(entry) + "</pre>"
    except Exception as e:
        return str(e), 400


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)