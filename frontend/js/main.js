// API base URL - change this to your backend URL
const API_BASE_URL = 'http://localhost:5000/api';

// DOM Elements
const tickerInput = document.getElementById('ticker');
const loadTickerBtn = document.getElementById('loadTicker');
const expiryDateSelect = document.getElementById('expiryDate');
const optionTypeRadios = document.querySelectorAll('input[name="optionType"]');
const viewOptionsBtn = document.getElementById('viewOptionsBtn');
const strikePriceSelect = document.getElementById('strikePrice');
const viewHistoryBtn = document.getElementById('viewHistoryBtn');
const optionsTable = document.getElementById('optionsTable');
const optionsTableTitle = document.getElementById('optionsTableTitle');
const inTheMoneyToggle = document.getElementById('inTheMoney');
const contractDetails = document.getElementById('contractDetails');
const priceHistoryTable = document.getElementById('priceHistoryTable');
const collapsibleHeaders = document.querySelectorAll('.card-header[data-bs-toggle="collapse"]');

// Current state
let currentTicker = '';
let currentExpiryDate = '';
let currentOptionType = 'calls';
let currentOptionsChain = null;
let currentStockPrice = 0;
let currentPriceHistoryData = null;

// Event Listeners
loadTickerBtn.addEventListener('click', loadTickerOptions);
expiryDateSelect.addEventListener('change', handleExpiryDateChange);
optionTypeRadios.forEach(radio => {
    radio.addEventListener('change', handleOptionTypeChange);
});
document.getElementById('optionsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    loadOptionsChain();
});
strikePriceSelect.addEventListener('change', handleStrikePriceChange);
viewHistoryBtn.addEventListener('click', loadOptionHistory);
inTheMoneyToggle.addEventListener('change', highlightInTheMoney);

// Setup collapsible sections
collapsibleHeaders.forEach(header => {
    header.addEventListener('click', function() {
        const target = document.querySelector(this.getAttribute('data-bs-target'));
        const isExpanded = this.getAttribute('aria-expanded') === 'true';
        
        // Toggle aria-expanded attribute
        this.setAttribute('aria-expanded', !isExpanded);
        
        // Toggle the collapse class
        if (isExpanded) {
            this.classList.add('collapsed');
        } else {
            this.classList.remove('collapsed');
        }
    });
});

// Functions
async function loadTickerOptions() {
    const ticker = tickerInput.value.trim().toUpperCase();
    
    if (!ticker) {
        showError(tickerInput, 'Please enter a valid ticker symbol');
        return;
    }
    
    setLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/tickers/${ticker}/options`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to load ticker data');
        }
        
        // Clear existing options
        expiryDateSelect.innerHTML = '<option value="">Select expiry date</option>';
        
        // Add new expiry dates
        data.expirationDates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            option.textContent = formatDate(date);
            expiryDateSelect.appendChild(option);
        });
        
        // Enable expiry date select
        expiryDateSelect.disabled = false;
        
        // Update current ticker
        currentTicker = ticker;
        
        // Update UI
        optionsTableTitle.textContent = `${ticker} Options Chain`;
        
    } catch (error) {
        console.error('Error loading ticker options:', error);
        showError(tickerInput, error.message);
    } finally {
        setLoading(false);
    }
}

async function loadOptionsChain() {
    if (!currentTicker || !currentExpiryDate) {
        return;
    }
    
    setLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/tickers/${currentTicker}/options?date=${currentExpiryDate}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to load options chain');
        }
        
        // Store options chain data
        currentOptionsChain = data;
        currentStockPrice = data.underlyingPrice || 0;
        
        // Populate options table
        populateOptionsTable(data[currentOptionType]);
        
        // Populate strike prices
        populateStrikePrices(data[currentOptionType]);
        
        // Enable strike price select
        strikePriceSelect.disabled = false;
        
    } catch (error) {
        console.error('Error loading options chain:', error);
        showError(document.getElementById('optionsForm'), error.message);
    } finally {
        setLoading(false);
    }
}

function populateOptionsTable(options) {
    const tableBody = optionsTable.querySelector('tbody');
    tableBody.innerHTML = '';
    
    options.forEach(option => {
        const row = document.createElement('tr');
        row.dataset.strike = option.strike;
        
        row.innerHTML = `
            <td>${option.strike.toFixed(2)}</td>
            <td>${formatPrice(option.lastPrice)}</td>
            <td>${formatPrice(option.bid)}</td>
            <td>${formatPrice(option.ask)}</td>
            <td>${formatPrice(option.change)}</td>
            <td>${option.percentChange ? option.percentChange.toFixed(2) + '%' : 'N/A'}</td>
            <td>${formatNumber(option.volume)}</td>
            <td>${formatNumber(option.openInterest)}</td>
            <td>${option.impliedVolatility ? (option.impliedVolatility * 100).toFixed(2) + '%' : 'N/A'}</td>
        `;
        
        row.addEventListener('click', () => {
            // Set the strike price in the select
            strikePriceSelect.value = option.strike;
            
            // Trigger change event
            const event = new Event('change');
            strikePriceSelect.dispatchEvent(event);
        });
        
        tableBody.appendChild(row);
    });
    
    // Highlight in-the-money options if enabled
    if (inTheMoneyToggle.checked) {
        highlightInTheMoney();
    }
}

function populateStrikePrices(options) {
    strikePriceSelect.innerHTML = '<option value="">Select strike price</option>';
    
    options.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option.strike;
        optionEl.textContent = option.strike.toFixed(2);
        strikePriceSelect.appendChild(optionEl);
    });
}

function handleExpiryDateChange() {
    currentExpiryDate = expiryDateSelect.value;
    
    if (currentExpiryDate) {
        viewOptionsBtn.disabled = false;
    } else {
        viewOptionsBtn.disabled = true;
    }
    
    // Reset strike price
    strikePriceSelect.innerHTML = '<option value="">Select strike price</option>';
    strikePriceSelect.disabled = true;
    
    // Hide contract details
    contractDetails.classList.add('d-none');
    
    // Disable view history button
    viewHistoryBtn.disabled = true;
}

function handleOptionTypeChange() {
    currentOptionType = document.querySelector('input[name="optionType"]:checked').value;
    
    if (currentOptionsChain) {
        populateOptionsTable(currentOptionsChain[currentOptionType]);
        populateStrikePrices(currentOptionsChain[currentOptionType]);
    }
    
    // Reset strike price
    strikePriceSelect.value = '';
    
    // Hide contract details
    contractDetails.classList.add('d-none');
    
    // Disable view history button
    viewHistoryBtn.disabled = true;
}

function handleStrikePriceChange() {
    const strike = parseFloat(strikePriceSelect.value);
    
    if (!strike || !currentOptionsChain) {
        contractDetails.classList.add('d-none');
        viewHistoryBtn.disabled = true;
        return;
    }
    
    // Find the option with the selected strike price
    const option = currentOptionsChain[currentOptionType].find(opt => opt.strike === strike);
    
    if (option) {
        // Update contract details
        document.getElementById('contractSymbol').textContent = option.contractSymbol || 'N/A';
        document.getElementById('lastPrice').textContent = formatPrice(option.lastPrice);
        document.getElementById('bidPrice').textContent = formatPrice(option.bid);
        document.getElementById('askPrice').textContent = formatPrice(option.ask);
        document.getElementById('volume').textContent = formatNumber(option.volume);
        document.getElementById('openInterest').textContent = formatNumber(option.openInterest);
        document.getElementById('impliedVolatility').textContent = option.impliedVolatility ? 
            (option.impliedVolatility * 100).toFixed(2) + '%' : 'N/A';
        
        // Show contract details
        contractDetails.classList.remove('d-none');
        
        // Enable view history button
        viewHistoryBtn.disabled = false;
        
        // Highlight the selected row in the table
        const rows = optionsTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
            row.classList.remove('table-primary');
            if (parseFloat(row.dataset.strike) === strike) {
                row.classList.add('table-primary');
            }
        });
    }
}

async function loadOptionHistory() {
    if (!currentTicker || !currentExpiryDate || !strikePriceSelect.value) {
        return;
    }
    
    const strike = strikePriceSelect.value;
    const optionType = currentOptionType === 'calls' ? 'call' : 'put';
    
    setLoading(true);
    
    try {
        const response = await fetch(
            `${API_BASE_URL}/tickers/${currentTicker}/option-history?` + 
            `expiry=${currentExpiryDate}&strike=${strike}&type=${optionType}`
        );
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to load option history');
        }
        
        console.log('Raw API response:', data);
        
        // Check if data exists and has the expected format
        if (!data.data || !Array.isArray(data.data)) {
            throw new Error('Invalid data format received from server');
        }
        
        // Store the price history data
        currentPriceHistoryData = data.data;
        
        // Create a direct copy of the data for the chart
        // This ensures we're not modifying the original data
        const chartData = [...data.data];
        
        // Create chart with the data
        createPriceChart(
            chartData, 
            `${currentTicker} ${optionType.toUpperCase()} $${strike} Expiring ${formatDate(currentExpiryDate)}`
        );
        
        // Populate price history table
        populatePriceHistoryTable(data.data);
        
        // Check if there's a note about limited data
        if (data.note) {
            // Show a notification to the user
            const chartContainer = document.getElementById('priceChart');
            const noteDiv = document.createElement('div');
            noteDiv.className = 'alert alert-warning mt-3';
            noteDiv.textContent = data.note;
            
            // Remove any existing notes
            const existingNote = chartContainer.parentNode.querySelector('.alert');
            if (existingNote) {
                existingNote.remove();
            }
            
            // Add the note after the chart
            chartContainer.parentNode.insertBefore(noteDiv, chartContainer.nextSibling);
        }
        
        // Expand the price history sections if they're collapsed
        const priceChartCollapse = document.getElementById('priceChartCollapse');
        const priceHistoryTableCollapse = document.getElementById('priceHistoryTableCollapse');
        
        if (!priceChartCollapse.classList.contains('show')) {
            document.querySelector('[data-bs-target="#priceChartCollapse"]').click();
        }
        
        if (!priceHistoryTableCollapse.classList.contains('show')) {
            document.querySelector('[data-bs-target="#priceHistoryTableCollapse"]').click();
        }
        
    } catch (error) {
        console.error('Error loading option history:', error);
        
        // Create a more detailed error message
        let errorMessage = error.message;
        if (error.message.includes('No historical data available')) {
            errorMessage = 'Yahoo Finance does not provide historical data for this option contract. Try a more liquid contract or a different expiration date.';
        }
        
        showError(document.getElementById('contractForm'), errorMessage);
        
        // Clear any existing chart and table
        document.getElementById('priceChart').innerHTML = '<div class="alert alert-warning">No price history data available to display in chart.</div>';
        clearPriceHistoryTable();
    } finally {
        setLoading(false);
    }
}

function populatePriceHistoryTable(data) {
    const tableBody = priceHistoryTable.querySelector('tbody');
    tableBody.innerHTML = '';
    
    if (!data || data.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="3" class="text-center">No price history data available</td>';
        tableBody.appendChild(row);
        return;
    }
    
    // Sort data by date (newest first)
    const sortedData = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedData.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(item.date)}</td>
            <td>${formatPrice(item.price)}</td>
            <td>${formatNumber(item.volume)}</td>
        `;
        tableBody.appendChild(row);
    });
}

function clearPriceHistoryTable() {
    const tableBody = priceHistoryTable.querySelector('tbody');
    tableBody.innerHTML = '<tr><td colspan="3" class="text-center">No data available</td></tr>';
}

function highlightInTheMoney() {
    if (!currentOptionsChain || !currentStockPrice) return;
    
    const rows = optionsTable.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const strike = parseFloat(row.dataset.strike);
        row.classList.remove('in-the-money');
        
        if (currentOptionType === 'calls' && strike < currentStockPrice) {
            row.classList.add('in-the-money');
        } else if (currentOptionType === 'puts' && strike > currentStockPrice) {
            row.classList.add('in-the-money');
        }
    });
}

// Helper Functions
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatPrice(price) {
    if (price === null || price === undefined) return 'N/A';
    return '$' + price.toFixed(2);
}

function formatNumber(num) {
    if (num === null || num === undefined) return 'N/A';
    return num.toLocaleString();
}

function setLoading(isLoading) {
    const elements = [
        document.getElementById('optionsForm'),
        document.getElementById('contractForm'),
        optionsTable
    ];
    
    elements.forEach(el => {
        if (isLoading) {
            el.classList.add('loading');
        } else {
            el.classList.remove('loading');
        }
    });
}

function showError(element, message) {
    // Remove existing error messages
    const existingError = element.parentNode.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Create error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    // Add after the element
    element.parentNode.insertBefore(errorDiv, element.nextSibling);
    
    // Remove after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}
