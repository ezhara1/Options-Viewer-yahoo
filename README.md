# Options Price Viewer

A web application that displays options prices sourced from Yahoo Finance. This application allows users to:

- Select a ticker symbol
- Choose an expiration date
- View option chains (calls and puts)
- Select specific strike prices
- View detailed contract information
- See historical price charts using Vega

## Project Structure

- `backend/`: Python Flask API that fetches data from Yahoo Finance
- `frontend/`: JavaScript web application that displays the data

## Setup Instructions

1. Install backend dependencies:
   ```
   cd backend
   pip install -r requirements.txt
   ```

2. Start the backend server:
   ```
   python app.py
   ```

3. Open the frontend in your browser:
   ```
   cd frontend
   ```
   Open `index.html` in your browser or use a local server.
