let chartState = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    canvas: null,
    ctx: null,
    data: [],
    minPrice: 0,
    maxPrice: 0,
    maxVolume: 0,
    dateRange: { min: null, max: null },
    margin: { top: 40, right: 60, bottom: 40, left: 60 },
    tooltip: {
        visible: false,
        x: 0,
        y: 0,
        dataPoint: null,
        hoverDistance: 15 // Distance in pixels to activate tooltip
    }
};

function createPriceChart(container, data, title) {
    // Clear the container completely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    // Debug the incoming data
    console.log('Chart data received:', JSON.stringify(data));

    if (!data || data.length === 0) {
        console.error('No data available for chart');
        container.innerHTML = '<div class="alert alert-warning">No price history data available.</div>';
        return;
    }

    // Create a simple canvas for drawing
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(1600, container.clientWidth * 0.95 || 1200); 
    canvas.height = 600; 
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';
    canvas.style.border = '1px solid #ddd';
    container.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    
    // Process and validate data
    const validData = [];
    
    data.forEach(item => {
        const date = new Date(item.date);
        const price = parseFloat(item.price);
        const volume = parseInt(item.volume) || 0;
        const type = item.type || 'Option';
        
        if (!isNaN(date.getTime()) && !isNaN(price)) {
            let color;
            if (type === 'Call') {
                color = { fill: 'rgba(76, 120, 168, 0.6)', stroke: 'rgba(76, 120, 168, 1)' };
            } else if (type === 'Put') {
                color = { fill: 'rgba(228, 87, 86, 0.6)', stroke: 'rgba(228, 87, 86, 1)' };
            } else {
                color = { fill: 'rgba(114, 183, 178, 0.6)', stroke: 'rgba(114, 183, 178, 1)' };
            }
            
            validData.push({
                date: date,
                price: price,
                volume: volume,
                type: type,
                color: color
            });
        }
    });
    
    // Sort by date
    validData.sort((a, b) => a.date - b.date);
    
    if (validData.length < 2) {
        console.error('Not enough valid data points for chart');
        container.innerHTML = '<div class="alert alert-warning">Not enough valid data to display chart.</div>';
        return;
    }
    
    // Calculate data ranges
    const minPrice = Math.min(...validData.map(d => d.price));
    const maxPrice = Math.max(...validData.map(d => d.price));
    const maxVolume = Math.max(...validData.map(d => d.volume));
    const minDate = validData[0].date;
    const maxDate = validData[validData.length - 1].date;
    
    console.log('Data ranges:', {
        price: [minPrice, maxPrice],
        volume: [0, maxVolume],
        date: [minDate, maxDate]
    });
    
    // Initialize chart state
    chartState = {
        // Viewport state
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        
        // Interaction state
        isDragging: false,
        lastMouseX: 0,
        lastMouseY: 0,
        
        // Chart data
        canvas: canvas,
        ctx: ctx,
        data: validData,
        title: title,
        
        // Chart dimensions
        chartWidth: canvas.width - 100, // Accounting for margins
        chartHeight: canvas.height - 80, // Accounting for margins
        
        // Data ranges
        minPrice: minPrice,
        maxPrice: maxPrice,
        maxVolume: maxVolume,
        minDate: minDate,
        maxDate: maxDate,
        
        // Original data ranges (for reset)
        originalMinPrice: minPrice,
        originalMaxPrice: maxPrice,
        originalMinDate: minDate,
        originalMaxDate: maxDate,
        
        // Layout
        margin: { top: 40, right: 50, bottom: 40, left: 50 },
        priceHeightRatio: 0.7,
        volumeHeightRatio: 0.3,
        
        // Tooltip
        tooltip: {
            visible: false,
            x: 0,
            y: 0,
            dataPoint: null,
            hoverDistance: 15 // Distance in pixels to activate tooltip
        }
    };
    
    // Set up event listeners for zoom and pan
    setupChartInteraction(canvas);
    
    // Initial draw
    drawChartWithViewport();
    
    // Add reset button
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Zoom';
    resetButton.style.margin = '10px auto';
    resetButton.style.display = 'block';
    resetButton.addEventListener('click', function() {
        resetChartView();
    });
    container.appendChild(resetButton);
    
    console.log('Chart rendered successfully');
}

// Set up event listeners for zoom and pan
function setupChartInteraction(canvas) {
    // Mouse wheel for zooming
    canvas.addEventListener('wheel', function(e) {
        e.preventDefault();
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Determine zoom direction
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        
        // Calculate the point to zoom toward (in data space)
        const dataX = getDataXFromPixel(mouseX);
        const dataY = getDataYFromPixel(mouseY);
        
        // Apply zoom to data ranges
        zoomChart(dataX, dataY, zoomFactor);
        
        // Redraw
        drawChartWithViewport();
    });
    
    // Mouse down for panning
    canvas.addEventListener('mousedown', function(e) {
        const rect = canvas.getBoundingClientRect();
        chartState.isDragging = true;
        chartState.lastMouseX = e.clientX - rect.left;
        chartState.lastMouseY = e.clientY - rect.top;
        canvas.style.cursor = 'grabbing';
    });
    
    // Mouse move for panning and tooltips
    canvas.addEventListener('mousemove', function(e) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        if (chartState.isDragging) {
            // Calculate the movement in data space
            panChart(chartState.lastMouseX, chartState.lastMouseY, mouseX, mouseY);
            
            // Update last position
            chartState.lastMouseX = mouseX;
            chartState.lastMouseY = mouseY;
            
            // Hide tooltip while dragging
            chartState.tooltip.visible = false;
            
            // Redraw
            drawChartWithViewport();
        } else {
            // Check for nearby data points for tooltip
            const nearestPoint = findNearestDataPoint(mouseX, mouseY);
            
            if (nearestPoint) {
                chartState.tooltip.visible = true;
                chartState.tooltip.x = mouseX;
                chartState.tooltip.y = mouseY;
                chartState.tooltip.dataPoint = nearestPoint;
                drawChartWithViewport(); // Redraw with tooltip
            } else if (chartState.tooltip.visible) {
                chartState.tooltip.visible = false;
                drawChartWithViewport(); // Redraw without tooltip
            }
        }
    });
    
    // Mouse up to end panning
    canvas.addEventListener('mouseup', function() {
        chartState.isDragging = false;
        canvas.style.cursor = 'default';
    });
    
    // Mouse leave to end panning and hide tooltip
    canvas.addEventListener('mouseleave', function() {
        chartState.isDragging = false;
        chartState.tooltip.visible = false;
        canvas.style.cursor = 'default';
        drawChartWithViewport();
    });
    
    // Double click to reset view
    canvas.addEventListener('dblclick', function() {
        resetChartView();
    });
}

// Find the nearest data point to the mouse position
function findNearestDataPoint(mouseX, mouseY) {
    const { data, margin, chartWidth, chartHeight, minDate, maxDate, minPrice, maxPrice, priceHeightRatio } = chartState;
    const priceChartHeight = chartHeight * priceHeightRatio;
    
    // Only look for points in the price chart area
    if (mouseX < margin.left || mouseX > margin.left + chartWidth || 
        mouseY < margin.top || mouseY > margin.top + priceChartHeight) {
        return null;
    }
    
    // Add padding to price range
    const pricePadding = (maxPrice - minPrice) * 0.1;
    const yMin = minPrice - pricePadding;
    const yMax = maxPrice + pricePadding;
    
    let nearestPoint = null;
    let minDistance = chartState.tooltip.hoverDistance;
    
    // Find the closest data point
    for (let i = 0; i < data.length; i++) {
        const pointX = margin.left + mapValue(data[i].date.getTime(), minDate.getTime(), maxDate.getTime(), 0, chartWidth);
        const pointY = margin.top + priceChartHeight - mapValue(data[i].price, yMin, yMax, 0, priceChartHeight);
        
        const distance = Math.sqrt(Math.pow(mouseX - pointX, 2) + Math.pow(mouseY - pointY, 2));
        
        if (distance < minDistance) {
            minDistance = distance;
            nearestPoint = data[i];
        }
    }
    
    return nearestPoint;
}

// Convert pixel X to data X (date)
function getDataXFromPixel(pixelX) {
    const { margin, chartWidth, minDate, maxDate } = chartState;
    
    // Calculate position within chart area
    const chartX = pixelX - margin.left;
    const normalizedX = chartX / chartWidth;
    
    // Convert to date
    const dateRange = maxDate.getTime() - minDate.getTime();
    return new Date(minDate.getTime() + dateRange * normalizedX);
}

// Convert pixel Y to data Y (price)
function getDataYFromPixel(pixelY) {
    const { margin, chartHeight, minPrice, maxPrice, priceHeightRatio } = chartState;
    
    // Calculate position within price chart area
    const priceChartHeight = chartHeight * priceHeightRatio;
    const chartY = pixelY - margin.top;
    
    // Only process if within price chart area
    if (chartY >= 0 && chartY <= priceChartHeight) {
        const normalizedY = 1 - (chartY / priceChartHeight);
        return minPrice + (maxPrice - minPrice) * normalizedY;
    }
    
    return null;
}

// Zoom the chart around a specific point
function zoomChart(dataX, dataY, zoomFactor) {
    const { minDate, maxDate, minPrice, maxPrice } = chartState;
    
    // Calculate date range midpoint and new range
    const dateRange = maxDate.getTime() - minDate.getTime();
    const newDateRange = dateRange / zoomFactor;
    
    // Calculate price range midpoint and new range
    const priceRange = maxPrice - minPrice;
    const newPriceRange = priceRange / zoomFactor;
    
    // Calculate new min/max dates centered on dataX
    if (dataX) {
        const datePercent = (dataX.getTime() - minDate.getTime()) / dateRange;
        const newMinDate = new Date(dataX.getTime() - newDateRange * datePercent);
        const newMaxDate = new Date(dataX.getTime() + newDateRange * (1 - datePercent));
        chartState.minDate = newMinDate;
        chartState.maxDate = newMaxDate;
    }
    
    // Calculate new min/max prices centered on dataY
    if (dataY !== null) {
        const pricePercent = (dataY - minPrice) / priceRange;
        const newMinPrice = dataY - newPriceRange * pricePercent;
        const newMaxPrice = dataY + newPriceRange * (1 - pricePercent);
        chartState.minPrice = newMinPrice;
        chartState.maxPrice = newMaxPrice;
    }
}

// Pan the chart based on mouse movement
function panChart(lastX, lastY, currentX, currentY) {
    const { margin, chartWidth, chartHeight, minDate, maxDate, minPrice, maxPrice, priceHeightRatio } = chartState;
    
    // Calculate movement as percentage of chart dimensions
    const dateRange = maxDate.getTime() - minDate.getTime();
    const priceRange = maxPrice - minPrice;
    const priceChartHeight = chartHeight * priceHeightRatio;
    
    // Calculate horizontal pan (date)
    const xDelta = (currentX - lastX) / chartWidth;
    const dateDelta = dateRange * xDelta;
    chartState.minDate = new Date(minDate.getTime() - dateDelta);
    chartState.maxDate = new Date(maxDate.getTime() - dateDelta);
    
    // Calculate vertical pan (price) - only if within price chart area
    if (lastY >= margin.top && lastY <= margin.top + priceChartHeight) {
        const yDelta = (currentY - lastY) / priceChartHeight;
        const priceDelta = priceRange * yDelta;
        chartState.minPrice = minPrice + priceDelta;
        chartState.maxPrice = maxPrice + priceDelta;
    }
}

// Reset chart view to original state
function resetChartView() {
    const { originalMinPrice, originalMaxPrice, originalMinDate, originalMaxDate } = chartState;
    
    chartState.minPrice = originalMinPrice;
    chartState.maxPrice = originalMaxPrice;
    chartState.minDate = originalMinDate;
    chartState.maxDate = originalMaxDate;
    
    drawChartWithViewport();
}

// Main drawing function with viewport
function drawChartWithViewport() {
    const { canvas, ctx, title, margin, chartWidth, chartHeight, priceHeightRatio, volumeHeightRatio } = chartState;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate chart areas
    const priceHeight = chartHeight * priceHeightRatio;
    const volumeHeight = chartHeight * volumeHeightRatio;
    
    // Draw title
    ctx.font = '16px Arial';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvas.width / 2, 20);
    
    // Draw price chart
    drawPriceChart(ctx, chartState.data, margin.left, margin.top, chartWidth, priceHeight, 
                  chartState.minPrice, chartState.maxPrice, chartState.minDate, chartState.maxDate);
    
    // Draw volume chart
    drawVolumeChart(ctx, chartState.data, margin.left, margin.top + priceHeight, chartWidth, volumeHeight, 
                   chartState.maxVolume, chartState.minDate, chartState.maxDate);
    
    // Draw axes
    drawAxes(ctx, margin.left, margin.top, chartWidth, priceHeight, volumeHeight, 
            chartState.minPrice, chartState.maxPrice, chartState.maxVolume, chartState.minDate, chartState.maxDate);
    
    // Draw zoom indicator
    const originalDateRange = chartState.originalMaxDate.getTime() - chartState.originalMinDate.getTime();
    const currentDateRange = chartState.maxDate.getTime() - chartState.minDate.getTime();
    const zoomLevel = originalDateRange / currentDateRange;
    
    if (zoomLevel > 1.1) {
        ctx.font = '12px Arial';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'right';
        ctx.fillText(`Zoom: ${zoomLevel.toFixed(1)}x`, canvas.width - 10, canvas.height - 10);
    }
    
    // Draw tooltip if visible
    if (chartState.tooltip.visible && chartState.tooltip.dataPoint) {
        drawTooltip(ctx, chartState.tooltip.x, chartState.tooltip.y, chartState.tooltip.dataPoint);
    }
}

// Draw the price chart
function drawPriceChart(ctx, data, x, y, width, height, minPrice, maxPrice, minDate, maxDate) {
    // Add padding to price range
    const pricePadding = (maxPrice - minPrice) * 0.1;
    const yMin = minPrice - pricePadding;
    const yMax = maxPrice + pricePadding;
    
    // Draw background
    ctx.fillStyle = 'rgba(240, 248, 255, 0.5)';
    ctx.fillRect(x, y, width, height);
    
    // Group data by type
    const callData = data.filter(d => d.type === 'Call');
    const putData = data.filter(d => d.type === 'Option' || d.type === 'Put');
    
    // Draw Call line if we have data
    if (callData.length > 1) {
        ctx.beginPath();
        
        // Map first point
        const firstX = x + mapValue(callData[0].date.getTime(), minDate.getTime(), maxDate.getTime(), 0, width);
        const firstY = y + height - mapValue(callData[0].price, yMin, yMax, 0, height);
        ctx.moveTo(firstX, firstY);
        
        // Map remaining points
        for (let i = 1; i < callData.length; i++) {
            const pointX = x + mapValue(callData[i].date.getTime(), minDate.getTime(), maxDate.getTime(), 0, width);
            const pointY = y + height - mapValue(callData[i].price, yMin, yMax, 0, height);
            ctx.lineTo(pointX, pointY);
        }
        
        // Style and stroke the line
        ctx.strokeStyle = 'rgba(76, 120, 168, 1)'; 
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    // Draw Put line if we have data
    if (putData.length > 1) {
        ctx.beginPath();
        
        // Map first point
        const firstX = x + mapValue(putData[0].date.getTime(), minDate.getTime(), maxDate.getTime(), 0, width);
        const firstY = y + height - mapValue(putData[0].price, yMin, yMax, 0, height);
        ctx.moveTo(firstX, firstY);
        
        // Map remaining points
        for (let i = 1; i < putData.length; i++) {
            const pointX = x + mapValue(putData[i].date.getTime(), minDate.getTime(), maxDate.getTime(), 0, width);
            const pointY = y + height - mapValue(putData[i].price, yMin, yMax, 0, height);
            ctx.lineTo(pointX, pointY);
        }
        
        // Style and stroke the line
        ctx.strokeStyle = 'rgba(228, 87, 86, 1)'; 
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    // Draw points for all data
    for (let i = 0; i < data.length; i++) {
        const pointX = x + mapValue(data[i].date.getTime(), minDate.getTime(), maxDate.getTime(), 0, width);
        const pointY = y + height - mapValue(data[i].price, yMin, yMax, 0, height);
        
        // Only draw points that are within the visible area
        if (pointX >= x && pointX <= x + width && pointY >= y && pointY <= y + height) {
            ctx.beginPath();
            ctx.arc(pointX, pointY, 4, 0, Math.PI * 2); 
            ctx.fillStyle = data[i].color.stroke;
            ctx.fill();
        }
    }
    
    // Draw a legend
    const legendX = x + width - 120;
    const legendY = y + 20;
    
    // Call legend
    ctx.beginPath();
    ctx.rect(legendX, legendY, 15, 15);
    ctx.fillStyle = 'rgba(76, 120, 168, 0.6)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(76, 120, 168, 1)';
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.textAlign = 'left';
    ctx.font = '12px Arial';
    ctx.fillText('Call', legendX + 20, legendY + 12);
    
    // Put legend
    ctx.beginPath();
    ctx.rect(legendX, legendY + 25, 15, 15);
    ctx.fillStyle = 'rgba(228, 87, 86, 0.6)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(228, 87, 86, 1)';
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.textAlign = 'left';
    ctx.font = '12px Arial';
    ctx.fillText('Put', legendX + 20, legendY + 37);
}

// Draw the volume chart
function drawVolumeChart(ctx, data, x, y, width, height, maxVolume, minDate, maxDate) {
    // Draw background
    ctx.fillStyle = 'rgba(245, 245, 245, 0.5)';
    ctx.fillRect(x, y, width, height);
    
    // Calculate bar width
    const barWidth = Math.max(1, width / data.length * 0.8);
    
    // Draw volume bars
    for (let i = 0; i < data.length; i++) {
        const barX = x + mapValue(data[i].date.getTime(), minDate.getTime(), maxDate.getTime(), 0, width) - barWidth / 2;
        const barHeight = mapValue(data[i].volume, 0, maxVolume, 0, height);
        
        ctx.fillStyle = data[i].color.fill;
        ctx.fillRect(barX, y + height - barHeight, barWidth, barHeight);
        
        ctx.strokeStyle = data[i].color.stroke;
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, y + height - barHeight, barWidth, barHeight);
    }
}

// Draw axes and labels
function drawAxes(ctx, x, y, width, priceHeight, volumeHeight, minPrice, maxPrice, maxVolume, minDate, maxDate) {
    const totalHeight = priceHeight + volumeHeight;
    
    // Add padding to price range
    const pricePadding = (maxPrice - minPrice) * 0.1;
    const yMin = minPrice - pricePadding;
    const yMax = maxPrice + pricePadding;
    
    // Draw axes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    // X-axis (bottom)
    ctx.beginPath();
    ctx.moveTo(x, y + totalHeight);
    ctx.lineTo(x + width, y + totalHeight);
    ctx.stroke();
    
    // Y-axis (left)
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + totalHeight);
    ctx.stroke();
    
    // Draw price axis ticks and labels
    const priceStep = calculateNiceStep(yMin, yMax, 5);
    for (let price = Math.ceil(yMin / priceStep) * priceStep; price <= yMax; price += priceStep) {
        const tickY = y + priceHeight - mapValue(price, yMin, yMax, 0, priceHeight);
        
        // Draw tick
        ctx.beginPath();
        ctx.moveTo(x - 5, tickY);
        ctx.lineTo(x, tickY);
        ctx.stroke();
        
        // Draw grid line
        ctx.strokeStyle = '#ddd';
        ctx.beginPath();
        ctx.moveTo(x, tickY);
        ctx.lineTo(x + width, tickY);
        ctx.stroke();
        ctx.strokeStyle = '#333';
        
        // Draw label
        ctx.font = '10px Arial';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#333';
        ctx.fillText('$' + price.toFixed(2), x - 8, tickY);
    }
    
    // Draw volume axis ticks and labels
    const volumeStep = calculateNiceStep(0, maxVolume, 2);
    for (let vol = 0; vol <= maxVolume; vol += volumeStep) {
        const tickY = y + priceHeight + volumeHeight - mapValue(vol, 0, maxVolume, 0, volumeHeight);
        
        // Only draw if within volume chart area
        if (tickY >= y + priceHeight && tickY <= y + totalHeight) {
            // Draw tick
            ctx.beginPath();
            ctx.moveTo(x - 5, tickY);
            ctx.lineTo(x, tickY);
            ctx.stroke();
            
            // Draw label
            ctx.font = '10px Arial';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#333';
            ctx.fillText(formatVolume(vol), x - 8, tickY);
        }
    }
    
    // Draw date axis ticks and labels
    const dateCount = 5;
    const timeRange = maxDate.getTime() - minDate.getTime();
    const timeStep = timeRange / (dateCount - 1);
    
    for (let i = 0; i < dateCount; i++) {
        const date = new Date(minDate.getTime() + timeStep * i);
        const tickX = x + mapValue(date.getTime(), minDate.getTime(), maxDate.getTime(), 0, width);
        
        // Draw tick
        ctx.beginPath();
        ctx.moveTo(tickX, y + totalHeight);
        ctx.lineTo(tickX, y + totalHeight + 5);
        ctx.stroke();
        
        // Draw label
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#333';
        ctx.fillText(formatDate(date), tickX, y + totalHeight + 8);
    }
    
    // Draw axis titles
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // Price axis title
    ctx.save();
    ctx.translate(x - 35, y + priceHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Price', 0, 0);
    ctx.restore();
    
    // Volume axis title
    ctx.save();
    ctx.translate(x - 35, y + priceHeight + volumeHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Volume', 0, 0);
    ctx.restore();
    
    // Date axis title
    ctx.fillText('Date', x + width / 2, y + totalHeight + 30);
}

// Helper function to map a value from one range to another
function mapValue(value, inMin, inMax, outMin, outMax) {
    // Handle edge cases
    if (inMax === inMin) return (outMin + outMax) / 2;
    if (value <= inMin) return outMin;
    if (value >= inMax) return outMax;
    
    return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
}

// Calculate a nice step size for axis ticks
function calculateNiceStep(min, max, targetSteps) {
    const range = max - min;
    const roughStep = range / targetSteps;
    
    // Round to a nice number
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const normalized = roughStep / magnitude;
    
    let niceStep;
    if (normalized < 1.5) niceStep = 1;
    else if (normalized < 3) niceStep = 2;
    else if (normalized < 7) niceStep = 5;
    else niceStep = 10;
    
    return niceStep * magnitude;
}

// Format date for display
function formatDate(date) {
    return (date.getMonth() + 1) + '/' + date.getDate();
}

// Format volume for display
function formatVolume(volume) {
    if (volume >= 1e9) return (volume / 1e9).toFixed(1) + 'B';
    if (volume >= 1e6) return (volume / 1e6).toFixed(1) + 'M';
    if (volume >= 1e3) return (volume / 1e3).toFixed(1) + 'K';
    return volume.toString();
}

// Draw tooltip for data point
function drawTooltip(ctx, x, y, dataPoint) {
    // Format date
    const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    const formattedDate = dataPoint.date.toLocaleDateString(undefined, dateOptions);
    
    // Format time if available
    let formattedTime = '';
    if (dataPoint.date.getHours() || dataPoint.date.getMinutes()) {
        formattedTime = dataPoint.date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    
    // Prepare tooltip content
    const lines = [
        `Date: ${formattedDate}${formattedTime ? ' ' + formattedTime : ''}`,
        `Type: ${dataPoint.type}`,
        `Price: $${dataPoint.price.toFixed(2)}`
    ];
    
    // Add additional price data if available
    if (dataPoint.open !== undefined) lines.push(`Open: $${dataPoint.open.toFixed(2)}`);
    if (dataPoint.close !== undefined) lines.push(`Close: $${dataPoint.close.toFixed(2)}`);
    if (dataPoint.high !== undefined) lines.push(`High: $${dataPoint.high.toFixed(2)}`);
    if (dataPoint.low !== undefined) lines.push(`Low: $${dataPoint.low.toFixed(2)}`);
    if (dataPoint.volume !== undefined) lines.push(`Volume: ${dataPoint.volume.toLocaleString()}`);
    
    // Calculate tooltip dimensions
    const lineHeight = 20;
    const padding = 8;
    const maxLineWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
    const tooltipWidth = maxLineWidth + padding * 2;
    const tooltipHeight = lines.length * lineHeight + padding * 2;
    
    // Position tooltip to avoid going off-screen
    let tooltipX = x + 15;
    let tooltipY = y - 15;
    
    if (tooltipX + tooltipWidth > ctx.canvas.width) {
        tooltipX = x - tooltipWidth - 15;
    }
    
    if (tooltipY + tooltipHeight > ctx.canvas.height) {
        tooltipY = ctx.canvas.height - tooltipHeight - 5;
    }
    
    if (tooltipY < 5) {
        tooltipY = 5;
    }
    
    // Draw tooltip background with shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = dataPoint.color.stroke;
    ctx.lineWidth = 2;
    
    // Draw rounded rectangle
    const radius = 5;
    ctx.beginPath();
    ctx.moveTo(tooltipX + radius, tooltipY);
    ctx.lineTo(tooltipX + tooltipWidth - radius, tooltipY);
    ctx.quadraticCurveTo(tooltipX + tooltipWidth, tooltipY, tooltipX + tooltipWidth, tooltipY + radius);
    ctx.lineTo(tooltipX + tooltipWidth, tooltipY + tooltipHeight - radius);
    ctx.quadraticCurveTo(tooltipX + tooltipWidth, tooltipY + tooltipHeight, tooltipX + tooltipWidth - radius, tooltipY + tooltipHeight);
    ctx.lineTo(tooltipX + radius, tooltipY + tooltipHeight);
    ctx.quadraticCurveTo(tooltipX, tooltipY + tooltipHeight, tooltipX, tooltipY + tooltipHeight - radius);
    ctx.lineTo(tooltipX, tooltipY + radius);
    ctx.quadraticCurveTo(tooltipX, tooltipY, tooltipX + radius, tooltipY);
    ctx.closePath();
    
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    
    // Draw tooltip header with type color
    ctx.fillStyle = dataPoint.color.fill;
    ctx.fillRect(tooltipX, tooltipY, tooltipWidth, lineHeight);
    
    // Draw tooltip content
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    // Draw header text (first line)
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(lines[0], tooltipX + padding, tooltipY + lineHeight / 2);
    
    // Draw remaining lines
    ctx.font = '12px Arial';
    ctx.fillStyle = '#333';
    for (let i = 1; i < lines.length; i++) {
        ctx.fillText(lines[i], tooltipX + padding, tooltipY + padding + i * lineHeight);
    }
    
    // Draw connecting line to data point
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    // Determine which side of the tooltip to connect to
    if (tooltipX > x) {
        ctx.lineTo(tooltipX, tooltipY + tooltipHeight / 2);
    } else {
        ctx.lineTo(tooltipX + tooltipWidth, tooltipY + tooltipHeight / 2);
    }
    
    ctx.strokeStyle = dataPoint.color.stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
}
