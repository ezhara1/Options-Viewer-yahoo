// API base URL - change this to your backend URL
const API_BASE_URL = 'http://localhost:5000/api';

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // DOM Elements
    const tickerInput = document.getElementById('ticker');
    const loadTickerBtn = document.getElementById('loadTicker');
    const expiryDateSelect = document.getElementById('expiryDate');
    const viewOptionsBtn = document.getElementById('viewOptionsBtn');
    const optionsTable = document.getElementById('optionsTable');
    const optionsTableTitle = document.getElementById('optionsTableTitle');
    const chartContainers = document.getElementById('chartContainers');
    const chartSectionTemplate = document.getElementById('chartSectionTemplate');
    const optionsForm = document.getElementById('optionsForm');

    // Current state
    let currentTicker = '';
    let currentExpiryDate = '';
    let currentOptionsChain = null;
    let currentStockPrice = 0;
    let activeChartSection = null;

    // Add event listeners
    if (loadTickerBtn) {
        loadTickerBtn.addEventListener('click', loadTickerOptions);
    }
    
    if (expiryDateSelect) {
        expiryDateSelect.addEventListener('change', handleExpiryDateChange);
    }
    
    if (optionsForm) {
        optionsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            loadOptionsChain();
        });
    }

    // Functions
    async function loadTickerOptions() {
        if (!tickerInput) return;
        
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
            
            if (!expiryDateSelect) return;
            
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
            if (optionsTableTitle) {
                optionsTableTitle.textContent = `${ticker} Options Chain`;
            }
            
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
            currentStockPrice = data.underlyingPrice;
            
            // Populate options table
            populateOptionsTable(data);
            
            // Clear any existing chart sections
            if (chartContainers) {
                chartContainers.innerHTML = '';
            }
            activeChartSection = null;
            
        } catch (error) {
            console.error('Error loading options chain:', error);
            showError(optionsForm, error.message);
        } finally {
            setLoading(false);
        }
    }

    function populateOptionsTable(options) {
        if (!optionsTable) return;
        
        const tableBody = optionsTable.querySelector('tbody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        if (!options || !options.calls || !options.puts) {
            tableBody.innerHTML = '<tr><td colspan="9" class="text-center">No options data available</td></tr>';
            return;
        }
        
        // Combine calls and puts by strike price
        const strikeMap = new Map();
        
        // Process calls
        options.calls.forEach(call => {
            if (!strikeMap.has(call.strike)) {
                strikeMap.set(call.strike, { call, put: null });
            } else {
                strikeMap.get(call.strike).call = call;
            }
        });
        
        // Process puts
        options.puts.forEach(put => {
            if (!strikeMap.has(put.strike)) {
                strikeMap.set(put.strike, { call: null, put });
            } else {
                strikeMap.get(put.strike).put = put;
            }
        });
        
        // Sort by strike price
        const sortedStrikes = Array.from(strikeMap.keys()).sort((a, b) => a - b);
        
        // Create table rows
        sortedStrikes.forEach(strike => {
            const { call, put } = strikeMap.get(strike);
            
            const row = document.createElement('tr');
            row.dataset.strike = strike;
            
            // Strike price
            row.innerHTML = `
                <td>${strike.toFixed(2)}</td>
                
                <!-- Call data -->
                <td>${call ? formatPrice(call.lastPrice) : 'N/A'}</td>
                <td>${call ? formatPrice(call.bid) + ' / ' + formatPrice(call.ask) : 'N/A'}</td>
                <td>${call ? formatNumber(call.volume) : 'N/A'}</td>
                <td>${call ? formatNumber(call.openInterest) : 'N/A'}</td>
                
                <!-- Put data -->
                <td>${put ? formatPrice(put.lastPrice) : 'N/A'}</td>
                <td>${put ? formatPrice(put.bid) + ' / ' + formatPrice(put.ask) : 'N/A'}</td>
                <td>${put ? formatNumber(put.volume) : 'N/A'}</td>
                <td>${put ? formatNumber(put.openInterest) : 'N/A'}</td>
            `;
            
            // Add click event to show chart
            row.addEventListener('click', () => {
                handleRowClick(strike, call, put);
            });
            
            tableBody.appendChild(row);
        });
        
        // Enable view options button
        if (viewOptionsBtn) {
            viewOptionsBtn.disabled = false;
        }
    }

    function handleExpiryDateChange() {
        if (!expiryDateSelect) return;
        
        const selectedDate = expiryDateSelect.value;
        
        if (selectedDate) {
            currentExpiryDate = selectedDate;
            if (viewOptionsBtn) {
                viewOptionsBtn.disabled = false;
            }
        } else {
            currentExpiryDate = '';
            if (viewOptionsBtn) {
                viewOptionsBtn.disabled = true;
            }
        }
    }

    async function handleRowClick(strike, call, put) {
        if (!optionsTable || !chartContainers || !chartSectionTemplate) return;
        
        // Toggle active class on the clicked row
        const rows = optionsTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
            if (parseFloat(row.dataset.strike) === strike) {
                row.classList.add('active');
            } else {
                row.classList.remove('active');
            }
        });
        
        // Hide any active chart section
        if (activeChartSection) {
            activeChartSection.classList.remove('active');
        }
        
        // Check if chart section for this strike already exists
        let chartSection = document.querySelector(`.chart-section[data-strike="${strike}"]`);
        
        // If not, create a new one
        if (!chartSection) {
            // Clone the template
            const template = chartSectionTemplate.content.cloneNode(true);
            chartSection = template.querySelector('.chart-section');
            if (!chartSection) return;
            
            chartSection.dataset.strike = strike;
            const strikePriceElement = chartSection.querySelector('.strike-price');
            if (strikePriceElement) {
                strikePriceElement.textContent = strike;
            }
            
            // Add to the container
            chartContainers.appendChild(chartSection);
            
            // Load chart data
            await loadOptionCharts(strike, call, put, chartSection);
        }
        
        // Show this chart section
        chartSection.classList.add('active');
        activeChartSection = chartSection;
        
        // Scroll to the chart section
        chartSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function loadOptionCharts(strike, call, put, chartSection) {
        if (!currentTicker || !currentExpiryDate || !chartSection) {
            return;
        }
        
        const chartContainer = chartSection.querySelector('.chart-container');
        if (!chartContainer) return;
        
        chartContainer.innerHTML = '<div class="alert alert-info">Loading price history data...</div>';
        
        try {
            // Load call option history if available
            let callData = null;
            if (call) {
                const callResponse = await fetch(`${API_BASE_URL}/tickers/${currentTicker}/option-history?type=call&strike=${strike}&expiry=${currentExpiryDate}`);
                const callResult = await callResponse.json();
                
                if (callResponse.ok && callResult.data && callResult.data.length > 0) {
                    callData = callResult.data.map(item => ({
                        ...item,
                        type: 'Call'
                    }));
                }
            }
            
            // Load put option history if available
            let putData = null;
            if (put) {
                const putResponse = await fetch(`${API_BASE_URL}/tickers/${currentTicker}/option-history?type=put&strike=${strike}&expiry=${currentExpiryDate}`);
                const putResult = await putResponse.json();
                
                if (putResponse.ok && putResult.data && putResult.data.length > 0) {
                    putData = putResult.data.map(item => ({
                        ...item,
                        type: 'Put'
                    }));
                }
            }
            
            // Combine data for the chart
            const chartData = [];
            if (callData) chartData.push(...callData);
            if (putData) chartData.push(...putData);
            
            if (chartData.length === 0) {
                chartContainer.innerHTML = '<div class="alert alert-warning">No price history data available for this option.</div>';
                return;
            }
            
            // Create the chart
            const title = `${currentTicker} ${strike} Strike - Expiry: ${formatDate(currentExpiryDate)}`;
            createPriceChart(chartContainer, chartData, title);
            
        } catch (error) {
            console.error('Error loading option history:', error);
            
            // Create a more detailed error message
            let errorMessage = error.message;
            if (error.message.includes('No historical data available')) {
                errorMessage = 'Yahoo Finance does not provide historical data for this option contract. Try a more liquid contract or a different expiration date.';
            }
            
            chartContainer.innerHTML = `<div class="alert alert-danger">${errorMessage}</div>`;
        }
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
            optionsForm,
            optionsTable
        ];
        
        elements.forEach(el => {
            if (el) {
                if (isLoading) {
                    el.classList.add('loading');
                } else {
                    el.classList.remove('loading');
                }
            }
        });
    }

    function showError(element, message) {
        if (!element) return;
        
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
}
