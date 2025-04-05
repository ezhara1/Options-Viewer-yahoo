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
    margin: { top: 40, right: 60, bottom: 40, left: 60 }
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
    
    // Define chart layout
    const margin = { top: 40, right: 50, bottom: 40, left: 50 };
    const chartWidth = canvas.width - margin.left - margin.right;
    const priceHeight = (canvas.height - margin.top - margin.bottom) * 0.7;
    const volumeHeight = (canvas.height - margin.top - margin.bottom) * 0.3;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw title
    ctx.font = '16px Arial';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvas.width / 2, 20);
    
    // Draw price chart
    drawPriceChart(ctx, validData, margin.left, margin.top, chartWidth, priceHeight, minPrice, maxPrice, minDate, maxDate);
    
    // Draw volume chart
    drawVolumeChart(ctx, validData, margin.left, margin.top + priceHeight, chartWidth, volumeHeight, maxVolume, minDate, maxDate);
    
    // Draw axes
    drawAxes(ctx, margin.left, margin.top, chartWidth, priceHeight, volumeHeight, minPrice, maxPrice, maxVolume, minDate, maxDate);
    
    // Add mouse events for future interactivity
    canvas.addEventListener('mousemove', function(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // For future tooltip implementation
    });
    
    console.log('Chart rendered successfully');
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
        
        ctx.beginPath();
        ctx.arc(pointX, pointY, 4, 0, Math.PI * 2); 
        ctx.fillStyle = data[i].color.stroke;
        ctx.fill();
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
