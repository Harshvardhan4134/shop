
document.addEventListener('DOMContentLoaded', function() {
    let calendar;
    const calendarEl = document.getElementById('calendar');

    // Initialize FullCalendar
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        editable: true,
        droppable: true,
        height: 'auto',
        eventDrop: function(info) {
            updateSchedule(info.event);
        },
        eventClick: function(info) {
            showJobModal(info.event);
        },
        drop: function(info) {
            const jobId = info.draggedEl.dataset.jobId;
            showJobModal(null, info.date, jobId);
        },
        events: '/api/schedule'
    });

    calendar.render();

    // Load unscheduled jobs
    function loadUnscheduledJobs() {
        fetch('/api/jobs')
            .then(response => response.json())
            .then(data => {
                const unscheduledDiv = document.getElementById('unscheduledJobs');
                unscheduledDiv.innerHTML = '';
                
                data.forEach(job => {
                    if (!job.scheduled) {
                        const jobItem = document.createElement('div');
                        jobItem.className = 'list-group-item';
                        jobItem.draggable = true;
                        jobItem.dataset.jobId = job.id;
                        jobItem.innerHTML = `
                            <h6 class="mb-1">${job.Task}</h6>
                            <small class="text-muted">
                                Work Center: ${job.Work_Center}<br>
                                Planned Hours: ${job.Planned_Hours}
                            </small>
                        `;
                        unscheduledDiv.appendChild(jobItem);
                        
                        // Make item draggable
                        new FullCalendar.Draggable(jobItem, {
                            eventData: {
                                title: job.Task,
                                id: job.id,
                                extendedProps: {
                                    workCenter: job.Work_Center,
                                    plannedHours: job.Planned_Hours
                                }
                            }
                        });
                    }
                });
            });
    }

    function showJobModal(event, date, jobId) {
        const modal = new bootstrap.Modal(document.getElementById('jobModal'));
        const titleInput = document.getElementById('jobTitle');
        const dateInput = document.getElementById('scheduleDate');
        const hoursInput = document.getElementById('hours');
        
        if (event) {
            titleInput.value = event.title;
            dateInput.value = event.start.toISOString().split('T')[0];
            hoursInput.value = event.extendedProps.plannedHours;
        } else {
            const draggedJob = document.querySelector(`[data-job-id="${jobId}"]`);
            titleInput.value = draggedJob.querySelector('h6').textContent;
            dateInput.value = date.toISOString().split('T')[0];
            hoursInput.value = draggedJob.querySelector('small').textContent.match(/Planned Hours: (\d+)/)[1];
        }
        
        modal.show();
    }

    function updateSchedule(event) {
        fetch('/api/schedule/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: event.id,
                start: event.start,
                end: event.end || event.start,
                title: event.title,
                extendedProps: event.extendedProps
            })
        });
    }

    // Initial load
    loadUnscheduledJobs();

    // Save schedule button handler
    document.getElementById('saveSchedule').addEventListener('click', function() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('jobModal'));
        // Add your save logic here
        modal.hide();
    });
});
