# Car Tracker (Windows + VS Code)

## Setup + Run (PowerShell in VS Code, from the project root)

# 1) Create venv (first time only)
py -m venv .venv

# 2) Activate venv (each new terminal). If blocked, run the first line once.
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1

# 3) Install Flask + save dependencies
py -m pip install --upgrade pip
py -m pip install flask
py -m pip freeze > requirements.txt

# 4) Run the program
py .\src\car_data.py

# VS Code: Ctrl+Shift+P → Python: Select Interpreter → .venv\Scripts\python.exe

# Note: Have to re-add env variable for MONGODB_URI upon terminal close/open
# Get connection string from MongoDB Compass
$env:MONGODB_URI="your_mongodb_connection_string_here"