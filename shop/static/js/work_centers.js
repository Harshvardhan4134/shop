document.addEventListener('DOMContentLoaded', function() {
    // Fetch work center data
    fetch('/api/work_centers')
        .then(response => response.json())
        .then(data => {
            updateWorkCenterTable(data);
            createStatusChart(data);
            createEfficiencyChart(data);
        });

    // Work Center Status Chart
    function createStatusChart(data) {
        const ctx = document.getElementById('workCenterStatus').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(data),
                datasets: [{
                    label: 'Available Work',
                    data: Object.values(data).map(wc => wc.available_work),
                    backgroundColor: 'rgba(75, 192, 192, 0.5)'
                }, {
                    label: 'Backlog',
                    data: Object.values(data).map(wc => wc.backlog),
                    backgroundColor: 'rgba(255, 99, 132, 0.5)'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Efficiency Chart
    function createEfficiencyChart(data) {
        const ctx = document.getElementById('efficiencyChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: Object.keys(data),
                datasets: [{
                    label: 'Efficiency',
                    data: Object.values(data).map(wc => parseInt(wc.efficiency)),
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    // Performance Trend Chart
    const performanceCtx = document.getElementById('performanceTrend').getContext('2d');
    new Chart(performanceCtx, {
        type: 'line',
        data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{
                label: 'Average Efficiency',
                data: [85, 87, 90, 92],
                borderColor: 'rgba(75, 192, 192, 1)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: false,
                    min: 80,
                    max: 100
                }
            }
        }
    });

    // Issue Distribution Chart
    const issueCtx = document.getElementById('issueDistribution').getContext('2d');
    new Chart(issueCtx, {
        type: 'doughnut',
        data: {
            labels: ['No Issues', 'Minor Issues', 'Major Issues'],
            datasets: [{
                data: [70, 20, 10],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(255, 99, 132, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });

    function updateWorkCenterTable(data) {
        const tableBody = document.getElementById('workCenterTable');
        tableBody.innerHTML = '';

        Object.entries(data).forEach(([workCenter, metrics]) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${workCenter}</td>
                <td>${metrics.available_work}</td>
                <td>${metrics.backlog}</td>
                <td>${metrics.efficiency}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="viewDetails('${workCenter}')">
                        View Details
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }
});

function viewDetails(workCenter) {
    // Implement work center details view
    console.log(`Viewing details for ${workCenter}`);
}
