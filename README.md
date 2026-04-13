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
py .\src\app_backend.py

# VS Code: Ctrl+Shift+P → Python: Select Interpreter → .venv\Scripts\python.exe

# Note: Have to re-add env variable for MONGODB_URI upon terminal close/open
# Get connection string from MongoDB Compass
$env:MONGODB_URI="your_mongodb_connection_string_here"
export MONGODB_URI="your_mongodb_connection_string_here"

# Reactivate venv when entering aws terminal:
source .venv/bin/activate

AWS
#Connect to instance
#Open A2_CS4800 directory
#Activate venv
    source .venv/bin/activate
#Run app 
    nohup python3.14 app_backend.py > log.txt &