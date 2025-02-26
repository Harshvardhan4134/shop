document.addEventListener('DOMContentLoaded', function() {
    let workCenterChart = null;
    let isLoading = false; // Prevent multiple requests

    // File upload handling
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const formData = new FormData();
            const fileInput = document.getElementById('sapdata'); 

            if (!fileInput.files.length) {
                alert('❌ Please select a file first');
                return;
            }

            formData.append('file', fileInput.files[0]);

            // Show loading indicator
            document.getElementById('uploadStatus').style.display = 'block';
            document.getElementById('uploadButton').disabled = true;

            fetch('/upload', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                document.getElementById('uploadStatus').style.display = 'none';
                document.getElementById('uploadButton').disabled = false;

                if (data.status === "success") {
                    alert('✅ File uploaded and processed successfully!');
                    loadDashboardData(); // Refresh dashboard data after successful upload
                } else {
                    alert('❌ Error: ' + (data.error || 'Upload failed'));
                }
            })
            .catch(error => {
                document.getElementById('uploadStatus').style.display = 'none';
                document.getElementById('uploadButton').disabled = false;
                console.error('❌ Upload Error:', error);
                alert('❌ Upload failed: ' + error.message);
            });
        });
    }

    function loadDashboardData() {
        if (isLoading) return; // Prevent duplicate calls
        isLoading = true;

        document.getElementById('uploadStatus').style.display = 'block';

        Promise.all([
            fetch('/api/work_centers').then(res => res.json()),
            fetch('/api/jobs').then(res => res.json())
        ])
        .then(([workCenterData, jobsData]) => {
            console.log("🚀 Received work centers:", Object.keys(workCenterData).length);
            console.log("🚀 Received jobs:", jobsData.length);

            updateWorkCenterChart(workCenterData);
            updateEfficiencyMetrics(workCenterData);
            updateActiveJobs(jobsData);
            updateStatusCards(jobsData, workCenterData);
            updateUpcomingDeadlines(jobsData);
        })
        .finally(() => {
            document.getElementById('uploadStatus').style.display = 'none';
            isLoading = false; // Allow next request
            setTimeout(loadDashboardData, 300000); // Wait 5 minutes before calling again
        })
        .catch(error => {
            console.error('❌ Error loading dashboard data:', error);
            document.getElementById('uploadStatus').style.display = 'none';
            isLoading = false;
        });
    }

    function updateWorkCenterChart(data) {
        const ctx = document.getElementById('workCenterChart').getContext('2d');
        const labels = Object.keys(data);
        const availableWork = labels.map(wc => data[wc].available_work);
        const backlog = labels.map(wc => data[wc].backlog);

        if (workCenterChart) {
            workCenterChart.destroy();
        }

        workCenterChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Available Work',
                        data: availableWork,
                        backgroundColor: 'rgba(54, 162, 235, 0.5)'
                    },
                    {
                        label: 'Backlog',
                        data: backlog,
                        backgroundColor: 'rgba(255, 99, 132, 0.5)'
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    function updateStatusCards(jobs, workCenterData) {
        document.getElementById('activeJobs').textContent = jobs.length;

        const today = new Date().toISOString().split('T')[0];
        const completedToday = jobs.reduce((count, job) => {
            return count + job.work_orders.flatMap(wo =>
                wo.operations.filter(op => op.status === 'Completed' && op.completed_at?.startsWith(today))
            ).length;
        }, 0);
        document.getElementById('completedToday').textContent = completedToday;

        const overloadedCenters = Object.values(workCenterData).filter(
            data => (data.available_work + data.backlog) > 10
        ).length;
        document.getElementById('overloadedCenters').textContent = overloadedCenters;

        const pendingJobs = jobs.reduce((count, job) => {
            return count + job.work_orders.flatMap(wo =>
                wo.operations.filter(op =>
                    op.status !== 'Completed' && op.due_date &&
                    new Date(op.due_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                )
            ).length;
        }, 0);
        document.getElementById('pendingJobs').textContent = pendingJobs;
    }

    function updateUpcomingDeadlines(jobs) {
        const tableBody = document.getElementById('upcomingDeadlinesTable');
        tableBody.innerHTML = '';

        const deadlines = jobs.flatMap(job =>
            job.work_orders.map(wo => ({
                job_number: job.job_number,
                work_order: wo.work_order_number,
                due_date: wo.due_date,
                status: wo.operations.every(op => op.status === 'Completed') ? 'Completed' : 'In Progress',
                priority: new Date(wo.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) ? 'High' : 'Normal'
            }))
        ).filter(item => item.due_date)
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

        deadlines.slice(0, 10).forEach(item => {
            tableBody.innerHTML += `
                <tr>
                    <td>${item.job_number}</td>
                    <td>${item.work_order}</td>
                    <td>${new Date(item.due_date).toLocaleDateString()}</td>
                    <td><span class="badge bg-${item.status === 'Completed' ? 'success' : 'warning'}">${item.status}</span></td>
                    <td><span class="badge bg-${item.priority === 'High' ? 'danger' : 'info'}">${item.priority}</span></td>
                </tr>
            `;
        });
    }

    function updateEfficiencyMetrics(data) {
        const metricsDiv = document.getElementById('efficiencyMetrics');
        metricsDiv.innerHTML = '';

        Object.entries(data).forEach(([workCenter, metrics]) => {
            const efficiency = parseInt(metrics.efficiency);
            const color = efficiency >= 80 ? 'success' : efficiency >= 60 ? 'warning' : 'danger';

            metricsDiv.innerHTML += `
                <div class="mb-3">
                    <label class="form-label">${workCenter}</label>
                    <div class="progress">
                        <div class="progress-bar bg-${color}"
                             role="progressbar"
                             style="width: ${efficiency}%"
                             aria-valuenow="${efficiency}"
                             aria-valuemin="0"
                             aria-valuemax="100">
                            ${efficiency}%
                        </div>
                    </div>
                </div>
            `;
        });
    }

    function updateActiveJobs(jobs) {
        const tableBody = document.getElementById('activeJobsTable');
        tableBody.innerHTML = '';

        jobs.slice(0, 50).forEach(job => { // Only process 50 jobs
            job.work_orders.forEach(wo => {
                wo.operations.forEach(op => {
                    const progress = (op.actual_hours / op.planned_hours) * 100;
                    tableBody.innerHTML += `
                        <tr>
                            <td>${job.job_number}</td>
                            <td>${wo.work_order_number}</td>
                            <td>${op.operation_number}</td>
                            <td>${op.work_center}</td>
                            <td><span class="badge bg-${op.status === 'Completed' ? 'success' : 'warning'}">${op.status}</span></td>
                            <td>
                                <div class="progress">
                                    <div class="progress-bar" role="progressbar"
                                         style="width: ${progress}%"
                                         aria-valuenow="${progress}"
                                         aria-valuemin="0"
                                         aria-valuemax="100">
                                        ${Math.round(progress)}%
                                    </div>
                                </div>
                            </td>
                        </tr>
                    `;
                });
            });
        });
    }

    loadDashboardData();
});
