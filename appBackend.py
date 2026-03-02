from datetime import datetime
from pprint import pprint

# Helper functions to fix formatting of 'datetime' date object
# Parses date string 
def parse_mmddyy(service_date):
    try:
        return datetime.strptime(service_date.strip(), "%m/%d/%y").date()
    except ValueError:
        raise ValueError("Date must be in mm/dd/yy format.")

# Formats mmddyy into string
def format_mmddyy(service_date):
    return service_date.strftime("%m/%d/%y") if service_date is not None else "N/A"

# Creates a list of car objects named CARS
CARS = []

_next_car_id = 1
_next_service_id = 1

def _new_car_id():
    # Make a unique car id (1, 2, 3, ...)
    # Must declare global to update global variable
    global _next_car_id
    car_id = _next_car_id
    _next_car_id += 1
    return car_id

def _new_service_id():
    # Make a unique service id (1, 2, 3, ...)
    # Must declare global to update global variable
    global _next_service_id
    service_id = _next_service_id
    _next_service_id += 1
    return service_id

# Core operations
def add_car(make, model, year, current_mileage=0):
    # Adds car into CARS list
    # Each car is a dictionary. Adds descriptors and information in k/v pairs.
    car = {
        "id": _new_car_id(),
        "make": make,
        "model": model,
        "year": int(year),
        "current_mileage": int(current_mileage),
        "last_service_date": None,
        "service_history": [],
        "lifetime_cost": 0.0
    }
    # Adds car dictionary object to list of CARS & returns 
    CARS.append(car)
    return car 

def find_car(car_id):
    # Returns the car dictionary for the given car id, None if not found
    for car in CARS:
        if car["id"] == car_id:
            return car
    return None 

def update_mileage(car_id, new_mileage):
    # Updates a car's current mileage
    car = find_car(car_id)
    if car is None:
        raise ValueError("Car not found.")
    
    new_mileage = int(new_mileage)

    # Preventing mileage from going backwards
    if new_mileage < car["current_mileage"]:
        raise ValueError("Mileage cannot go backwards.")
    
    car["current_mileage"] = new_mileage 
    return car

def add_service(car_id, service_date, mileage, category, subcategory, notes="", cost=None):
    # Adds a service entry to a specific car. Service date should be datetime format (ex: date(2026, 2, 22))
    car = find_car(car_id)
    if car is None:
        raise ValueError("Car not found.")
    
    service_date = parse_mmddyy(service_date)

    if cost == "" or cost is None:
        cost_value = None
    else:
        try:
            cost_value = float(cost)
        except (TypeError, ValueError):
            raise ValueError("Cost must be a double, or blank.")

        if cost_value < 0:
            raise ValueError("Cost cannot be negative.")
    
    service_entry = {
        "id": _new_service_id(),
        "date": service_date,
        "mileage": int(mileage),
        "category": category,
        "subcategory": subcategory, 
        "notes": notes,
        "cost": cost_value
    }

    car["service_history"].append(service_entry)

    # Update summary fields (mileage, last service date)
    car["last_service_date"] = service_date
    if service_entry["mileage"] > car["current_mileage"]:
        car["current_mileage"] = service_entry["mileage"]

    if cost_value is not None:
        car["lifetime_cost"] += cost_value

    return service_entry

def list_cars():
    # Returns list of cars
    return CARS

def car_summary(car):
    # Formats a summary for user. Assigns each printable aspect a key and value??????? for ease of display
    return {
        "Car ID": car["id"],
        "Car Name": f'{car["year"]} {car["make"]} {car["model"]}',
        "Current Mileage": car["current_mileage"],
        "Last Service Date": format_mmddyy(car["last_service_date"]),
        "Lifetime Expenses": round(car["lifetime_cost"], 2)
    }

# -------------------------
# Testing
# -------------------------

if __name__ == "__main__":
    # Add cars
    c1 = add_car("Honda", "Civic", 2018, 116000)
    c2 = add_car("Toyota", "Camry", 2012, 153200)

    # Update mileage
    update_mileage(c1["id"], 116250)

    # Add services (with different cost cases)
    add_service(c1["id"], "02/20/26", 116000, "Oil", "Oil change", notes="0W-20 synthetic", cost="52.10")
    add_service(c1["id"], "03/01/26", 116250, "Tires", "Rotation", notes="Front->back", cost=0)
    add_service(c1["id"], "03/10/26", 116400, "Inspection", "Safety check", notes="No charge", cost="")

    add_service(c2["id"], "01/15/26", 153200, "Brakes", "Pads", notes="Front pads", cost=220)

    # Print summaries
    print("\n--- Car Summaries ---")
    for car in list_cars():
        pprint(car_summary(car))

    # Print detailed service history for c1
    print("\n--- Service History for c1 ---")
    car = find_car(c1["id"])
    for e in car["service_history"]:
        print(
            f'#{e["id"]} {format_mmddyy(e["date"])} '
            f'{e["category"]}: {e["subcategory"]} '
            f'Miles={e["mileage"]} | Cost={e["cost"]} | Notes={e["notes"]}'
        )

    # Quick checks (will raise AssertionError if something is wrong)
    assert find_car(c1["id"])["current_mileage"] == 116400
    assert round(find_car(c1["id"])["lifetime_cost"], 2) == 52.10  # only the paid one counts
    assert round(find_car(c2["id"])["lifetime_cost"], 2) == 220.00

    print("\nAll tests passed.")
