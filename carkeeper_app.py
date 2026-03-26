from datetime import datetime
from pymongo import MongoClient
from secrets_config import get_mongodb_uri

MONGODB_URI = get_mongodb_uri()
mongo_client = MongoClient(MONGODB_URI)

db = mongo_client["car_info"]
collection = db["car_summary"]

# Tracks total services across all cars
TOTAL_SERVICES = 0

# Helper functions to fix formatting of 'datetime' date object
# Parses date string 
def parse_mmddyy(service_date):
    try:
        return datetime.strptime(service_date.strip(), "%m/%d/%y")
    except ValueError:
        raise ValueError("Date must be in mm/dd/yy format.")

# Formats mmddyy into string
def format_mmddyy(service_date):
    return service_date.strftime("%m/%d/%y") if service_date is not None else "N/A"

# Make a unique car id based on largest id already in mongodb
def _new_car_id():
    # Find largest (last) car id in mongodb collection and assigns car dictionary to last_car
    last_car = collection.find_one(sort=[("car_id", -1)])
    # If last car and id exist, return largest (last) car id + 1, else return 1 for first car
    if last_car and "car_id" in last_car:
        return last_car["car_id"] + 1
    return 1

# Make a unique service id based on all existing service entries 
def _new_service_id():
    max_service_id = 0
    # Iterate through every service in each car and track the max service id number
    for car in collection.find({}, {"service_history.service_id": 1, "_id": 0}):
        for service in car.get("service_history", []):
            service_id = service.get("service_id", 0) 
            if service_id > max_service_id:
                max_service_id = service_id
    # returns next available service id
    return max_service_id + 1

# Rebuild TOTAL_SERVICES from mongodb when app starts
def initialize_total_services():
    global TOTAL_SERVICES
    total = 0
    for car in collection.find({}, {"service_count": 1, "_id": 0}):
        total += car.get("service_count", 0)
    TOTAL_SERVICES = total
    return TOTAL_SERVICES

# Core operations

def add_car(make, model, year, current_mileage=0, image_url=""):
    # Creates a car dictionary and inserts it into MongoDB
    car = {
        "car_id": _new_car_id(),
        "make": make,
        "model": model,
        "year": int(year),
        "current_mileage": int(current_mileage),
        "last_service_date": None,
        "service_history": [],
        "service_count": 0,
        "lifetime_cost": 0.0,
        "image_url": image_url.strip()
    }
    collection.insert_one(car)
    return car 

# Returns the car dictionary for the given car id, None if not found
def find_car(car_id):
    return collection.find_one({"car_id": int(car_id)}, {"_id": 0})

# Updates a car's current mileage and returns updated car entry
def update_mileage(car_id, new_mileage):
    car = find_car(car_id)
    if car is None:
        raise ValueError("Car not found.")
    
    new_mileage = int(new_mileage)

    # Preventing mileage from going backwards
    if new_mileage < car["current_mileage"]:
        raise ValueError("Mileage cannot go backwards.")
    
    collection.update_one(
        {"car_id": int(car_id)},
        {"$set": {"current_mileage": new_mileage}}
    )
    updated_car = find_car(car_id)
    return updated_car

# Adds a service entry to a specific car. Service date should be datetime format (ex: date(2026, 2, 22))    
def add_service(car_id, service_date, mileage, service_type, description="", notes="", cost=0):
    global TOTAL_SERVICES
    car = find_car(car_id)
    if car is None:
        raise ValueError("Car not found.")
    
    parsed_service_date = parse_mmddyy(service_date)
    mileage = int(mileage)

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
        "service_id": _new_service_id(),
        "date": parsed_service_date,
        "mileage": mileage,
        "service_type": service_type,
        "description": description, 
        "notes": notes,
        "cost": cost_value
    }
    # If no service history exists, create an empty list
    updated_history = car.get("service_history", [])
    updated_history.append(service_entry)
    # Car fields which will be updated on the database
    updated_fields = {
        "service_history": updated_history,
        "last_service_date": parsed_service_date,
        "service_count": car.get("service_count", 0) + 1
    }

    if mileage > car["current_mileage"]:
        updated_fields["current_mileage"] = mileage
    
    if cost_value is not None:
        updated_fields["lifetime_cost"] = round(car.get("lifetime_cost", 0) + cost_value, 2)

    collection.update_one(
        {"car_id": int(car_id)},
        {"$set": updated_fields}
    )
    TOTAL_SERVICES += 1
    return service_entry

# Returns list of cars (unformatted)
def list_cars():
    return list(collection.find({}, {"_id": 0}))

# Returns total services added while app is running (persistent with mongodb)
def get_total_services():
    return TOTAL_SERVICES

# Returns number of services for one car
def get_car_service_count(car_id):
    car = find_car(car_id)
    if car is None:
        raise ValueError("Car not found.")
    return car.get("service_count", 0)

# Returns a formatted dictionary that can be sent as JSON for a car object
def car_summary(car):
    return {
        "Car ID": car["car_id"],
        "Car Name": f'{car["year"]} {car["make"]} {car["model"]}',
        "Current Mileage": car["current_mileage"],
        "Last Service Date": format_mmddyy(car.get("last_service_date")),
        "Lifetime Expenses": round(car.get("lifetime_cost", 0), 2),
        "Service Count": car.get("service_count", 0),
        "Image URL": car.get("image_url", "")
    }

def car_details(car):
    raw_history = sorted(
        car.get("service_history", []),
        key=lambda s: s.get("date"),
        reverse=True
    )

    formatted_history = []
    for service in raw_history:
        formatted_history.append({
            "Service ID": service.get("service_id"),
            "Date": format_mmddyy(service.get("date")),
            "Mileage": service.get("mileage"),
            "Service Type": service.get("service_type"),
            "Description": service.get("description", ""),
            "Notes": service.get("notes", ""),
            "Cost": service.get("cost")
        })

    return {
        "Car ID": car["car_id"],
        "Car Name": f'{car["year"]} {car["make"]} {car["model"]}',
        "Current Mileage": car["current_mileage"],
        "Last Service Date": format_mmddyy(car.get("last_service_date")),
        "Lifetime Expenses": round(car.get("lifetime_cost", 0), 2),
        "Service Count": car.get("service_count", 0),
        "Image URL": car.get("image_url", ""),
        "Service History": formatted_history
    }

initialize_total_services()