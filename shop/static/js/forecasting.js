document.addEventListener('DOMContentLoaded', function() {
    let forecastChart = null;
    const forecastCtx = document.getElementById('forecastChart').getContext('2d');

    function loadForecastData() {
        fetch('/api/forecast')
            .then(response => response.json())
            .then(data => {
                updateForecastChart(data);
                updateForecastTable(data);
            })
            .catch(error => {
                console.error('Error loading forecast data:', error);
                alert('Failed to load forecast data');
            });
    }

    function updateForecastChart(data) {
        const workCenters = Object.keys(data);
        const planned = workCenters.map(wc => data[wc].planned);
        const actual = workCenters.map(wc => data[wc].actual);
        const forecasted = workCenters.map(wc => data[wc].forecasted);

        if (forecastChart) {
            forecastChart.destroy();
        }

        forecastChart = new Chart(forecastCtx, {
            type: 'bar',
            data: {
                labels: workCenters,
                datasets: [
                    {
                        label: 'Planned Hours',
                        data: planned,
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Actual Hours',
                        data: actual,
                        backgroundColor: 'rgba(75, 192, 192, 0.5)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Forecasted Hours',
                        data: forecasted,
                        backgroundColor: 'rgba(255, 206, 86, 0.5)',
                        borderColor: 'rgba(255, 206, 86, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Work Hours Forecast by Work Center',
                        font: {
                            size: 16
                        }
                    },
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Hours'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Work Centers'
                        }
                    }
                }
            }
        });
    }

    function updateForecastTable(data) {
        const tableBody = document.getElementById('forecastTable');
        tableBody.innerHTML = '';

        Object.entries(data).forEach(([workCenter, metrics]) => {
            const row = document.createElement('tr');
            
            // Calculate efficiency percentage
            const efficiency = metrics.actual / metrics.planned * 100;
            const efficiencyClass = efficiency >= 90 ? 'success' : 
                                  efficiency >= 70 ? 'warning' : 'danger';

            row.innerHTML = `
                <td>${workCenter}</td>
                <td>${metrics.planned.toFixed(1)}</td>
                <td>${metrics.actual.toFixed(1)}</td>
                <td>${metrics.forecasted.toFixed(1)}</td>
                <td>
                    <span class="badge bg-${efficiencyClass}">
                        ${metrics.remaining.toFixed(1)}
                    </span>
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Add summary row
        const totalPlanned = Object.values(data).reduce((sum, metrics) => sum + metrics.planned, 0);
        const totalActual = Object.values(data).reduce((sum, metrics) => sum + metrics.actual, 0);
        const totalForecasted = Object.values(data).reduce((sum, metrics) => sum + metrics.forecasted, 0);
        const totalRemaining = Object.values(data).reduce((sum, metrics) => sum + metrics.remaining, 0);

        const summaryRow = document.createElement('tr');
        summaryRow.className = 'table-active fw-bold';
        summaryRow.innerHTML = `
            <td>Total</td>
            <td>${totalPlanned.toFixed(1)}</td>
            <td>${totalActual.toFixed(1)}</td>
            <td>${totalForecasted.toFixed(1)}</td>
            <td>${totalRemaining.toFixed(1)}</td>
        `;
        tableBody.appendChild(summaryRow);
    }

    // Add refresh button functionality
    const refreshButton = document.createElement('button');
    refreshButton.className = 'btn btn-sm btn-outline-primary float-end';
    refreshButton.innerHTML = '<i class="fas fa-sync"></i> Refresh Data';
    refreshButton.addEventListener('click', loadForecastData);

    // Add the refresh button to the card header
    const cardHeader = document.querySelector('.card-header');
    cardHeader.appendChild(refreshButton);

    // Initial load
    loadForecastData();

    // Set up automatic refresh every 5 minutes
    setInterval(loadForecastData, 300000);
});
