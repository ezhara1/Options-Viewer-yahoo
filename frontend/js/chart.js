function createPriceChart(data, title) {
    const chartContainer = document.getElementById('priceChart');
    chartContainer.innerHTML = '';
    
    // Debug the incoming data
    console.log('Chart data received:', JSON.stringify(data));
    
    if (!data || data.length === 0) {
        console.error('No data available for chart');
        chartContainer.innerHTML = '<div class="alert alert-warning">No price history data available to display in chart.</div>';
        return;
    }
    
    // Create a canvas element for the chart
    const canvasContainer = document.createElement('div');
    canvasContainer.style.width = '100%';
    canvasContainer.style.height = '400px';
    canvasContainer.style.position = 'relative';
    
    const titleElement = document.createElement('h5');
    titleElement.textContent = title;
    titleElement.style.textAlign = 'center';
    titleElement.style.marginBottom = '20px';
    
    const canvas = document.createElement('canvas');
    canvas.width = canvasContainer.clientWidth || 800;
    canvas.height = 350;
    canvas.style.width = '100%';
    canvas.style.height = '350px';
    
    canvasContainer.appendChild(titleElement);
    canvasContainer.appendChild(canvas);
    chartContainer.appendChild(canvasContainer);
    
    // Sort data by date
    const sortedData = [...data].sort((a, b) => {
        return new Date(a.date) - new Date(b.date);
    });
    
    // Extract price values for scaling
    const prices = sortedData.map(item => parseFloat(item.price) || 0);
    const minPrice = Math.min(...prices) * 0.9;  // Add 10% padding
    const maxPrice = Math.max(...prices) * 1.1;  // Add 10% padding
    
    // Extract dates for x-axis
    const dates = sortedData.map(item => new Date(item.date));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    
    // Get canvas context
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw chart background
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Set chart margins
    const margin = {
        top: 20,
        right: 30,
        bottom: 50,
        left: 60
    };
    
    const chartWidth = canvas.width - margin.left - margin.right;
    const chartHeight = canvas.height - margin.top - margin.bottom;
    
    // Function to map data values to canvas coordinates
    function xScale(date) {
        const dateValue = new Date(date).getTime();
        const minValue = minDate.getTime();
        const maxValue = maxDate.getTime();
        return margin.left + (dateValue - minValue) / (maxValue - minValue) * chartWidth;
    }
    
    function yScale(price) {
        return margin.top + chartHeight - ((price - minPrice) / (maxPrice - minPrice) * chartHeight);
    }
    
    // Draw axes
    ctx.beginPath();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    // X-axis
    ctx.moveTo(margin.left, margin.top + chartHeight);
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
    
    // Y-axis
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + chartHeight);
    ctx.stroke();
    
    // Draw Y-axis labels
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    
    const yTickCount = 5;
    for (let i = 0; i <= yTickCount; i++) {
        const price = minPrice + (maxPrice - minPrice) * (i / yTickCount);
        const y = yScale(price);
        
        ctx.beginPath();
        ctx.moveTo(margin.left - 5, y);
        ctx.lineTo(margin.left, y);
        ctx.stroke();
        
        ctx.fillText('$' + price.toFixed(2), margin.left - 10, y + 4);
    }
    
    // Draw X-axis labels (dates)
    ctx.textAlign = 'center';
    
    // Determine how many x-axis labels to show based on data length
    const xLabelCount = Math.min(sortedData.length, 7);
    const xLabelStep = Math.ceil(sortedData.length / xLabelCount);
    
    for (let i = 0; i < sortedData.length; i += xLabelStep) {
        const date = new Date(sortedData[i].date);
        const x = xScale(date);
        
        ctx.beginPath();
        ctx.moveTo(x, margin.top + chartHeight);
        ctx.lineTo(x, margin.top + chartHeight + 5);
        ctx.stroke();
        
        const formattedDate = `${date.getMonth() + 1}/${date.getDate()}`;
        ctx.fillText(formattedDate, x, margin.top + chartHeight + 20);
    }
    
    // Draw axis titles
    ctx.textAlign = 'center';
    ctx.font = '14px Arial';
    ctx.fillText('Date', margin.left + chartWidth / 2, canvas.height - 10);
    
    ctx.save();
    ctx.translate(15, margin.top + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Price ($)', 0, 0);
    ctx.restore();
    
    // Draw the price line
    ctx.beginPath();
    ctx.strokeStyle = '#4c78a8';
    ctx.lineWidth = 2;
    
    // Move to the first point
    if (sortedData.length > 0) {
        const firstPoint = sortedData[0];
        ctx.moveTo(xScale(new Date(firstPoint.date)), yScale(parseFloat(firstPoint.price) || 0));
        
        // Draw lines to subsequent points
        for (let i = 1; i < sortedData.length; i++) {
            const point = sortedData[i];
            ctx.lineTo(xScale(new Date(point.date)), yScale(parseFloat(point.price) || 0));
        }
    }
    
    ctx.stroke();
    
    // Draw data points
    ctx.fillStyle = '#4c78a8';
    
    sortedData.forEach(point => {
        const x = xScale(new Date(point.date));
        const y = yScale(parseFloat(point.price) || 0);
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Add a legend for the data table below the chart
    const legendContainer = document.createElement('div');
    legendContainer.className = 'mt-3 text-center';
    legendContainer.innerHTML = '<small class="text-muted">See detailed price history in the table below</small>';
    chartContainer.appendChild(legendContainer);
}
