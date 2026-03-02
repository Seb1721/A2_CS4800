from datetime import dates

CARS = []

_next_car_id = 1
_next_service_id = 1

def new_car_id():
    # Make a unique car id (1, 2, 3, ...)
    global _next_car_id
    car_id = _next_car_id
    _next_car_id += 1
    return car_id

def _new_service_id():
    global _next_service_id
    service_id = _next_service_id
    _next_service_id += 1
    return service_id

# Core operations
def add_car(make, model, year, current_mileage=0):
    # Adds car into CARS list
    # Each car is a dictionary 
    car = {
        "id": _new_car_id(),
        "make": make,
        "model": model,
        "year": int(year),
        "current_mileage": int(current_mileage),
        "last_service_date": None,
        "service_history": []   
    }
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

def add