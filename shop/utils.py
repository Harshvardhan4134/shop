from app import db
from models import Job, WorkOrder, Operation
from datetime import datetime, timedelta
import pandas as pd
import logging

def process_sapdata(df):
    """Process uploaded SAPDATA Excel file and update database"""
    try:
        logging.debug(f"📊 Excel Columns Found: {df.columns.tolist()}")

        column_mappings = {
            'job_number': ['Order', 'ORDER', 'Job'],
            'work_order_number': ['Order', 'ORDER', 'Work Order'],
            'operation_number': ['Oper./Act.', 'OPERATION', 'Operation'],
            'work_center': ['Oper.WorkCenter', 'WORK_CENTER', 'Work Center'],
            'planned_hours': ['Work', 'PLANNED_HOURS', 'Planned Hours'],
            'actual_hours': ['Actual work', 'ACTUAL_HOURS', 'Actual Hours'],
        }

        for _, row in df.iterrows():
            try:
                # Extract job number
                job_number = next((str(row[col]).strip() for col in column_mappings['job_number']
                                   if col in df.columns and pd.notna(row[col])), None)
                if not job_number:
                    logging.error(f"❌ Missing Job Number: {row}")
                    continue

                # Extract work order number
                work_order_number = job_number  # Some cases work order is same as job number

                # Extract operation number
                operation_number = None
                for col in column_mappings['operation_number']:
                    if col in df.columns and pd.notna(row[col]):
                        try:
                            operation_number = int(float(str(row[col]).strip()))
                            break
                        except ValueError:
                            logging.error(f"❌ Invalid Operation Number: {row[col]}")
                            continue
                if operation_number is None:
                    logging.error(f"❌ Missing Operation Number: {row}")
                    continue

                # Extract work center
                work_center = next((str(row[col]).strip() for col in column_mappings['work_center']
                                    if col in df.columns and pd.notna(row[col])), None)
                if not work_center:
                    logging.error(f"❌ Missing Work Center: {row}")
                    continue

                # Extract planned & actual hours
                planned_hours = next((float(row[col]) for col in column_mappings['planned_hours']
                                      if col in df.columns and pd.notna(row[col])), 0)
                actual_hours = next((float(row[col]) for col in column_mappings['actual_hours']
                                     if col in df.columns and pd.notna(row[col])), 0)

                # ✅ **Fix: Check if Job exists before inserting**
                job = Job.query.filter_by(job_number=job_number).first()
                if not job:
                    job = Job(job_number=job_number)
                    db.session.add(job)
                    db.session.commit()
                    logging.info(f"✅ Created New Job: {job_number}")

                # ✅ **Fix: Check if Work Order exists before inserting**
                work_order = WorkOrder.query.filter_by(
                    work_order_number=work_order_number,
                    job_id=job.id  # Ensure correct Job ID
                ).first()

                if not work_order:
                    work_order = WorkOrder(
                        work_order_number=work_order_number,
                        job_id=job.id
                    )
                    db.session.add(work_order)
                    db.session.commit()
                    logging.info(f"✅ Created New Work Order: {work_order_number}")
                else:
                    logging.info(f"🔄 Work Order {work_order_number} already exists, skipping insertion.")

                # ✅ **Fix: Check if Operation exists before inserting**
                operation = Operation.query.filter_by(
                    work_order_id=work_order.id,
                    operation_number=operation_number
                ).first()

                if not operation:
                    operation = Operation(
                        operation_number=operation_number,
                        work_order_id=work_order.id,
                        work_center=work_center,
                        planned_hours=planned_hours,
                        actual_hours=actual_hours,
                        status='Not Started'
                    )
                    db.session.add(operation)
                    logging.info(f"✅ Created New Operation: {operation_number} for Work Order {work_order_number}")
                else:
                    operation.planned_hours = planned_hours
                    operation.actual_hours = actual_hours
                    logging.info(f"🔄 Updated Operation: {operation_number}")

                db.session.commit()

            except Exception as e:
                db.session.rollback()
                logging.error(f"❌ Error Processing Row: {row.to_dict() if hasattr(row, 'to_dict') else row}")
                logging.error(f"❌ Error Details: {str(e)}")
                continue

    except Exception as e:
        db.session.rollback()
        logging.error(f"❌ Fatal Error Processing SAPDATA: {str(e)}")
        raise

def calculate_forecast(operations):
    """Calculate forecasted hours based on historical data and current trends"""
    if not operations:
        return 0

    completed_ops = [op for op in operations if op.status == 'Completed']
    if not completed_ops:
        return sum(op.planned_hours for op in operations)

    efficiency_factor = sum(op.actual_hours for op in completed_ops) / sum(op.planned_hours for op in completed_ops)
    remaining_ops = [op for op in operations if op.status != 'Completed']

    forecasted_hours = sum(op.planned_hours * efficiency_factor for op in remaining_ops)
    return round(forecasted_hours, 2)