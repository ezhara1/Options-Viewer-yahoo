from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
import pandas as pd
from datetime import datetime

app = Flask(__name__)
CORS(app)

@app.route('/api/tickers/<ticker>/options', methods=['GET'])
def get_options_chain(ticker):
    try:
        # Get ticker data
        ticker_data = yf.Ticker(ticker)
        
        # Get expiration dates
        expiration_dates = ticker_data.options
        
        if not expiration_dates:
            return jsonify({"error": "No options data available for this ticker"}), 404
            
        # Return just the expiration dates if no date is specified
        if 'date' not in request.args:
            return jsonify({"expirationDates": expiration_dates})
        
        # Get options chain for specific date
        expiry = request.args.get('date')
        if expiry not in expiration_dates:
            return jsonify({"error": "Invalid expiration date"}), 400
            
        options = ticker_data.option_chain(expiry)
        
        # Get underlying stock price
        stock_info = ticker_data.info
        underlying_price = stock_info.get('regularMarketPrice', None)
        
        # Convert to dict for JSON serialization
        calls = options.calls.to_dict(orient='records')
        puts = options.puts.to_dict(orient='records')
        
        # Format the data
        for option_list in [calls, puts]:
            for option in option_list:
                for key, value in option.items():
                    if pd.isna(value):
                        option[key] = None
                    elif isinstance(value, (pd.Timestamp, datetime)):
                        option[key] = value.isoformat()
                    elif isinstance(value, float):
                        option[key] = round(value, 4)
        
        return jsonify({
            "ticker": ticker,
            "expiryDate": expiry,
            "underlyingPrice": underlying_price,
            "calls": calls,
            "puts": puts
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/tickers/<ticker>/option-history', methods=['GET'])
def get_option_history(ticker):
    try:
        # Required parameters
        contract_type = request.args.get('type')  # 'call' or 'put'
        strike = request.args.get('strike')
        expiry = request.args.get('expiry')
        
        if not all([contract_type, strike, expiry]):
            return jsonify({"error": "Missing required parameters: type, strike, and expiry"}), 400
            
        # Get the ticker data
        ticker_data = yf.Ticker(ticker)
        
        # Check if options attribute exists
        if not hasattr(ticker_data, 'options') or not ticker_data.options:
            return jsonify({
                "error": "No options data available for this ticker",
                "details": "Yahoo Finance could not retrieve options data for this ticker symbol."
            }), 404
            
        # Check if the expiry date is valid
        if expiry not in ticker_data.options:
            return jsonify({
                "error": "Invalid expiration date",
                "details": f"The expiration date {expiry} is not available for {ticker}."
            }), 400
        
        # Get options chain
        try:
            options_chain = ticker_data.option_chain(expiry)
            
            # Get the appropriate option type chain
            option_chain = options_chain.calls if contract_type.lower() == 'call' else options_chain.puts
            
            # Filter by strike price
            filtered_options = option_chain[option_chain['strike'] == float(strike)]
            
            if filtered_options.empty:
                return jsonify({
                    "error": "Strike price not found",
                    "details": f"No {contract_type} option with strike price {strike} found for {ticker} expiring on {expiry}."
                }), 404
            
            # Get the contract symbol
            if 'contractSymbol' not in filtered_options.columns:
                return jsonify({
                    "error": "Contract symbol not available",
                    "details": "The Yahoo Finance API did not return contract symbols for this option chain."
                }), 500
                
            contract_symbol = filtered_options.iloc[0]['contractSymbol']
            
            # Create a new ticker object for the option contract
            option_ticker = yf.Ticker(contract_symbol)
            
            # Calculate date range (1 month back from today)
            end_date = datetime.now().strftime("%Y-%m-%d")
            start_date = (datetime.now() - pd.Timedelta(days=30)).strftime("%Y-%m-%d")
            
            # Get historical data
            history = option_ticker.history(start=start_date, end=end_date)
            
            if history.empty:
                # If no historical data, return current price only
                today = datetime.now().strftime("%Y-%m-%d")
                history_data = [{
                    "date": today,
                    "price": round(filtered_options.iloc[0]['lastPrice'], 2),
                    "volume": int(filtered_options.iloc[0]['volume']) if 'volume' in filtered_options.columns and not pd.isna(filtered_options.iloc[0]['volume']) else 0
                }]
                
                return jsonify({
                    "symbol": contract_symbol,
                    "data": history_data,
                    "note": "Historical data not available. Showing current price only."
                })
            
            # Format for Vega
            history_data = []
            for date, row in history.iterrows():
                # Check if Close and Volume columns exist
                close_price = row["Close"] if "Close" in row and not pd.isna(row["Close"]) else None
                volume = row["Volume"] if "Volume" in row and not pd.isna(row["Volume"]) else 0
                
                if close_price is not None:
                    history_data.append({
                        "date": date.strftime("%Y-%m-%d"),
                        "price": round(close_price, 2),
                        "volume": int(volume)
                    })
            
            if not history_data:
                return jsonify({
                    "error": "No valid price data available",
                    "details": "The historical data retrieved does not contain valid price information."
                }), 404
                
            return jsonify({
                "symbol": contract_symbol,
                "data": history_data
            })
            
        except Exception as e:
            return jsonify({
                "error": "Failed to retrieve option data",
                "details": f"Error: {str(e)}"
            }), 500
            
    except Exception as e:
        return jsonify({
            "error": str(e),
            "details": "There was an error retrieving historical data. This may be due to limitations in Yahoo Finance's API or the specific contract you selected."
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
