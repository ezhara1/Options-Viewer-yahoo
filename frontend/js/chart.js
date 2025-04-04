function createPriceChart(container, data, title) {
    // Clear the container
    container.innerHTML = '';
    
    // Debug the incoming data
    console.log('Chart data received:', JSON.stringify(data));
    
    if (!data || data.length === 0) {
        console.error('No data available for chart');
        container.innerHTML = '<div class="alert alert-warning">No price history data available to display in chart.</div>';
        return;
    }
    
    // Format dates and ensure all data is valid
    const formattedData = data.map(item => {
        return {
            date: new Date(item.date).toISOString().split('T')[0],
            price: parseFloat(item.price) || 0,
            volume: parseInt(item.volume) || 0,
            type: item.type || 'Option'
        };
    });
    
    // Create a unique ID for this chart to avoid signal name conflicts
    const chartId = 'chart_' + Date.now();
    
    // Create a chart specification with zoom and pan functionality
    const spec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "title": title,
        "width": "container",
        "height": 500, // Increased height
        "autosize": {
            "type": "fit",
            "contains": "padding"
        },
        "data": {
            "values": formattedData
        },
        "vconcat": [
            {
                // Main price chart (top)
                "height": 400, // Increased height
                "mark": {
                    "type": "line",
                    "point": true,
                    "tooltip": true
                },
                "selection": {
                    "grid": {
                        "type": "interval",
                        "bind": "scales"
                    }
                },
                "encoding": {
                    "x": {
                        "field": "date",
                        "type": "temporal",
                        "title": "Date",
                        "axis": {
                            "format": "%b %d, %Y",
                            "labelAngle": -45
                        }
                    },
                    "y": {
                        "field": "price",
                        "type": "quantitative",
                        "title": "Price ($)",
                        "axis": {
                            "format": "$,.2f"
                        }
                    },
                    "color": {
                        "field": "type",
                        "type": "nominal",
                        "scale": {
                            "domain": ["Call", "Put", "Option"],
                            "range": ["#4c78a8", "#e45756", "#72b7b2"]
                        },
                        "title": "Option Type"
                    },
                    "tooltip": [
                        {"field": "date", "type": "temporal", "title": "Date", "format": "%b %d, %Y"},
                        {"field": "price", "type": "quantitative", "title": "Price", "format": "$,.2f"},
                        {"field": "volume", "type": "quantitative", "title": "Volume", "format": ","},
                        {"field": "type", "type": "nominal", "title": "Type"}
                    ]
                }
            },
            {
                // Volume bars (bottom)
                "height": 100,
                "mark": {
                    "type": "bar",
                    "opacity": 0.5,
                    "tooltip": true
                },
                "selection": {
                    "grid": {
                        "type": "interval",
                        "bind": "scales"
                    }
                },
                "encoding": {
                    "x": {
                        "field": "date",
                        "type": "temporal",
                        "title": "Date"
                    },
                    "y": {
                        "field": "volume",
                        "type": "quantitative",
                        "title": "Volume",
                        "axis": {
                            "format": "~s"
                        }
                    },
                    "color": {
                        "field": "type",
                        "type": "nominal",
                        "scale": {
                            "domain": ["Call", "Put", "Option"],
                            "range": ["#4c78a8", "#e45756", "#72b7b2"]
                        },
                        "legend": null
                    },
                    "tooltip": [
                        {"field": "date", "type": "temporal", "title": "Date", "format": "%b %d, %Y"},
                        {"field": "volume", "type": "quantitative", "title": "Volume", "format": ","},
                        {"field": "type", "type": "nominal", "title": "Type"}
                    ]
                }
            }
        ]
    };
    
    // Create a unique div inside the container for this chart
    const chartDiv = document.createElement('div');
    chartDiv.id = chartId;
    chartDiv.style.width = '50%';
    chartDiv.style.height = '50%';
    container.appendChild(chartDiv);
    
    try {
        // Embed the chart
        vegaEmbed('#' + chartId, spec, {
            actions: {
                export: true,
                source: false,
                compiled: false,
                editor: false
            },
            renderer: "svg", // Use SVG renderer for better quality
            tooltip: {
                theme: "light"
            }
        }).then(result => {
            console.log('Chart created successfully with ID:', chartId);
        }).catch(error => {
            console.error('Error creating chart:', error);
            container.innerHTML = `<div class="alert alert-danger">Error creating chart: ${error.message}</div>`;
        });
    } catch (error) {
        console.error('Exception when creating chart:', error);
        container.innerHTML = `<div class="alert alert-danger">Error creating chart: ${error.message}</div>`;
    }
}
