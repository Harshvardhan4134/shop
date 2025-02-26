import os
import pandas as pd
from flask import render_template, request, jsonify
from app import app, db
from models import Job, WorkOrder, Operation
from utils import process_sapdata, calculate_forecast
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
import logging

@app.route('/')
def dashboard():
    work_centers = db.session.query(Operation.work_center).distinct().all()
    work_centers = [wc[0] for wc in work_centers]
    return render_template('dashboard.html', work_centers=work_centers)

@app.route('/scheduling')
def scheduling():
    return render_template('scheduling.html')

@app.route('/forecasting')
def forecasting():
    return render_template('forecasting.html')

@app.route('/work_centers')
def work_centers():
    return render_template('work_centers.html')

@app.route('/purchase')
def purchase():
    return render_template('purchase.html')

@app.route('/api/purchase')
def get_purchase_data():
    purchase_orders = []
    for job in db.session.query(Job).all():
        for wo in job.work_orders:
            if hasattr(wo, 'purchase_order'):
                purchase_orders.append({
                    'po_number': wo.purchase_order,
                    'material': wo.material,
                    'quantity': wo.quantity,
                    'delivery_date': wo.delivery_date.strftime('%Y-%m-%d') if wo.delivery_date else 'N/A',
                    'status': wo.status,
                    'value': wo.value or 0
                })

    metrics = {
        'open_pos': len([po for po in purchase_orders if po['status'] == 'Open']),
        'total_value': sum(po['value'] for po in purchase_orders),
        'pending_deliveries': len([po for po in purchase_orders if po['status'] in ['Open', 'In Transit']]),
        'late_deliveries': len([po for po in purchase_orders if po['status'] == 'Delayed']),
        'status_distribution': [
            len([po for po in purchase_orders if po['status'] == 'Open']),
            len([po for po in purchase_orders if po['status'] == 'In Transit']),
            len([po for po in purchase_orders if po['status'] == 'Delivered']),
            len([po for po in purchase_orders if po['status'] == 'Delayed'])
        ]
    }

    timeline_data = {
        'dates': [],
        'quantities': []
    }
    
    return jsonify({
        'purchase_orders': purchase_orders,
        'metrics': metrics,
        'timeline': timeline_data
    })

@app.route('/api/jobs')
def get_jobs():
    """Fetch all jobs with work orders & operations"""
    jobs = Job.query.all()

    # Debugging logs
    logging.info(f"📌 Found {len(jobs)} jobs in database")

    if not jobs:
        return jsonify([])  # Return empty list if no jobs exist

    result = []

    for job in jobs:
        job_data = {
            'job_number': job.job_number,
            'status': job.work_orders[0].operations[0].status if job.work_orders else "Unknown",
            'start_date': job.work_orders[0].operations[0].scheduled_date.isoformat() if job.work_orders and job.work_orders[0].operations[0].scheduled_date else None,
            'due_date': job.work_orders[0].operations[0].completed_at.isoformat() if job.work_orders and job.work_orders[0].operations[0].completed_at else None,
            'work_orders': []
        }

        for wo in job.work_orders:
            work_order_data = {
                'work_order_number': wo.work_order_number,
                'operations': []
            }

            for op in wo.operations:
                operation_data = {
                    'operation_number': op.operation_number,
                    'work_center': op.work_center,
                    'planned_hours': op.planned_hours,
                    'actual_hours': op.actual_hours,
                    'status': op.status,
                    'scheduled_date': op.scheduled_date.isoformat() if op.scheduled_date else None,
                    'completed_at': op.completed_at.isoformat() if op.completed_at else None
                }
                work_order_data['operations'].append(operation_data)

            job_data['work_orders'].append(work_order_data)

        result.append(job_data)

    logging.info(f"📌 API `/api/jobs` returned {len(result)} jobs")
    return jsonify(result)


@app.route('/api/forecast')
def get_forecast():
    work_centers = db.session.query(Operation.work_center).distinct().all()
    forecast_data = {}

    for wc in work_centers:
        work_center = wc[0]
        operations = Operation.query.filter_by(work_center=work_center).all()

        planned = sum(op.planned_hours for op in operations)
        actual = sum(op.actual_hours for op in operations)
        remaining = planned - actual
        forecasted = calculate_forecast(operations)

        forecast_data[work_center] = {
            "planned": planned,
            "actual": actual,
            "forecasted": forecasted,
            "remaining": remaining
        }

    return jsonify(forecast_data)

@app.route('/api/schedule', methods=['GET', 'POST'])
def schedule():
    if request.method == 'POST':
        data = request.json
        operation = Operation.query.get(data['operation_id'])
        if operation:
            operation.scheduled_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
            db.session.commit()
            return jsonify({"status": "success"})
        return jsonify({"status": "error", "message": "Operation not found"}), 404

    operations = Operation.query.filter(Operation.scheduled_date.isnot(None)).all()
    events = [{
        "id": op.id,
        "title": f"{op.work_order.work_order_number} - Op {op.operation_number}",
        "start": op.scheduled_date.isoformat(),
        "work_center": op.work_center
    } for op in operations]
    return jsonify(events)

@app.route('/api/work_centers')
def get_work_centers():
    work_centers = db.session.query(Operation.work_center).distinct().all()
    result = {}

    for wc in work_centers:
        work_center = wc[0]
        operations = Operation.query.filter_by(work_center=work_center).all()

        available = len([op for op in operations if op.status == 'Ready'])
        backlog = len([op for op in operations if op.status == 'Not Started'])
        total_planned = sum(op.planned_hours for op in operations) or 1
        total_actual = sum(op.actual_hours for op in operations)
        efficiency = round((total_actual / total_planned) * 100)

        result[work_center] = {
            "available_work": available,
            "backlog": backlog,
            "efficiency": f"{efficiency}%"
        }

    return jsonify(result)

@app.route('/upload', methods=['POST'])
def upload_sapdata():
    try:
        logging.info("📂 Starting file upload process...")

        if 'file' not in request.files:
            logging.error("❌ No file part in request")
            return jsonify({"error": "No file provided"}), 400

        file = request.files['file']
        logging.info(f"📌 Received file: {file.filename}")

        if file.filename == '':
            logging.error("❌ No selected file")
            return jsonify({"error": "No file selected"}), 400

        if not file.filename.endswith('.xlsx'):
            logging.error(f"❌ Invalid file format: {file.filename}")
            return jsonify({"error": "Invalid file format. Please upload an Excel (.xlsx) file"}), 400

        # Ensure upload folder exists
        if not os.path.exists(app.config['UPLOAD_FOLDER']):
            os.makedirs(app.config['UPLOAD_FOLDER'])
            logging.info(f"📁 Created upload folder: {app.config['UPLOAD_FOLDER']}")

        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        logging.info(f"📂 Saving file to: {filepath}")

        try:
            # Save file
            file.save(filepath)
            logging.info("✅ File saved successfully")

            # Open the file using `with` statement to ensure it gets closed properly
            with open(filepath, "rb") as f:
                df = pd.read_excel(f, engine='openpyxl')

            logging.info(f"📊 Excel file loaded. Columns found: {df.columns.tolist()}")
            print(df.head())  # Print first few rows for debugging

            # Process the data
            process_sapdata(df)
            logging.info("✅ Data processed successfully")

            # Remove the file after processing
            if os.path.exists(filepath):  # Check if file exists before deleting
                os.remove(filepath)
                logging.info("🗑️ Temporary file removed")

            return jsonify({"status": "success", "message": "Data imported successfully"})

        except Exception as e:
            logging.error(f"❌ Error during file processing: {str(e)}")

            # Remove file only if it exists
            if os.path.exists(filepath):
                os.remove(filepath)

            return jsonify({"error": f"Error processing file: {str(e)}"}), 500

    except Exception as e:
        logging.error(f"❌ Upload error: {str(e)}")
        return jsonify({"error": str(e)}), 500
