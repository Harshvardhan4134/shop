# import pandas as pd
# import numpy as np
# from datetime import datetime, timedelta
# import logging

# logger = logging.getLogger(__name__)

# def process_sap_data(df):
#     """Process SAP data from Excel and return structured data with job counts, backlog, urgency, and completion date."""
#     logger.info("Starting SAP data processing")

#     df.columns = df.columns.str.strip().str.lower()

#     column_mapping = {
#         'order': 'order_id',
#         'oper./act.': 'operation_number',
#         'oper.workcenter': 'work_center',
#         'description': 'task_description',
#         'opr. short text': 'short_text',
#         'work': 'planned_hours',
#         'actual work': 'actual_hours'
#     }

#     missing_columns = [col for col in column_mapping.keys() if col not in df.columns]
#     if missing_columns:
#         raise KeyError(f"Missing required columns in SAP data: {missing_columns}")

#     df.rename(columns=column_mapping, inplace=True)

#     now = datetime.now()
#     df['start_date'] = now - timedelta(days=np.random.randint(1, 10))
#     df['completion_date'] = df['start_date'] + timedelta(days=np.random.randint(5, 15))  # Estimated completion date

#     # Calculate remaining work
#     df['remaining_work'] = df['planned_hours'] - df['actual_hours']
#     df['remaining_work'] = df['remaining_work'].apply(lambda x: max(x, 0))  # Ensure no negative values

#     work_center_hours = df.groupby('work_center').agg({
#         'planned_hours': 'sum',
#         'actual_hours': 'sum',
#         'remaining_work': 'sum'
#     }).reset_index()

#     job_counts = df.groupby('work_center').size().reset_index(name='job_count')

#     work_center_hours['backlog'] = work_center_hours['remaining_work']

#     def determine_urgency(backlog, planned):
#         if planned == 0:
#             return "Normal"
#         ratio = backlog / planned
#         if ratio > 0.5:
#             return "Critical"
#         elif ratio > 0.2:
#             return "High"
#         else:
#             return "Normal"

#     work_center_hours['urgency'] = work_center_hours.apply(
#         lambda row: determine_urgency(row['backlog'], row['planned_hours']), axis=1
#     )

#     work_centers = df[['work_center']].drop_duplicates().rename(columns={'work_center': 'name'})
#     work_centers = work_centers.merge(work_center_hours, how='left', left_on='name', right_on='work_center')
#     work_centers = work_centers.merge(job_counts, how='left', left_on='name', right_on='work_center')

#     work_centers.drop(columns=['work_center_x', 'work_center_y'], inplace=True)
#     work_centers.fillna(0, inplace=True)
#     work_centers = work_centers.to_dict(orient='records')

#     jobs = df[['order_id', 'operation_number', 'work_center', 'task_description', 'short_text', 'planned_hours', 'actual_hours', 'start_date', 'completion_date', 'remaining_work']].to_dict(orient='records')

#     return {
#         "jobs": jobs,
#         "work_centers": work_centers,
#         "schedules": []
#     }


import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

def process_sap_data(df):
    """Process SAP data from Excel and return structured data."""
    try:
        logger.info("Starting SAP data processing")
        
        # Convert column names to lowercase and strip whitespace
        df.columns = df.columns.str.strip().str.lower()
        logger.debug(f"Processed columns: {df.columns.tolist()}")

        # Define expected columns and their alternatives
        column_mapping = {
            'order': ['order', 'job', 'order_id'],
            'oper./act.': ['oper./act.', 'operation', 'operation_number'],
            'oper.workcenter': ['oper.workcenter', 'work_center', 'workcenter'],
            'description': ['description', 'task_description', 'task'],
            'work': ['work', 'planned_hours', 'planned'],
            'actual work': ['actual work', 'actual_hours', 'actual']
        }

        # Verify required columns exist
        for key, alternatives in column_mapping.items():
            if not any(col in df.columns for col in alternatives):
                raise KeyError(f"Missing required column {key}. Expected one of: {alternatives}")

        # Add date fields for tracking
        now = datetime.now()
        df['start_date'] = now - timedelta(days=np.random.randint(1, 10, size=len(df)))
        df['completion_date'] = df['start_date'] + timedelta(days=np.random.randint(5, 15, size=len(df)))

        # Calculate remaining work
        df['remaining_work'] = df['work'].astype(float) - df['actual work'].astype(float)
        df['remaining_work'] = df['remaining_work'].apply(lambda x: max(x, 0))

        # Process work center statistics
        work_center_stats = df.groupby('oper.workcenter').agg({
            'work': 'sum',
            'actual work': 'sum',
            'remaining_work': 'sum'
        }).reset_index()

        # Calculate job counts per work center
        job_counts = df.groupby('oper.workcenter').size().reset_index(name='job_count')

        # Determine urgency levels
        def determine_urgency(row):
            if row['work'] == 0:
                return "Normal"
            ratio = row['remaining_work'] / row['work']
            if ratio > 0.5:
                return "Critical"
            elif ratio > 0.2:
                return "High"
            return "Normal"

        work_center_stats['urgency'] = work_center_stats.apply(determine_urgency, axis=1)

        # Prepare work centers data
        work_centers = (work_center_stats.merge(job_counts, on='oper.workcenter')
                       .rename(columns={'oper.workcenter': 'name'})
                       .to_dict('records'))

        # Prepare jobs data
        jobs = df[['order', 'oper./act.', 'oper.workcenter', 'description', 
                  'work', 'actual work', 'start_date', 'completion_date', 
                  'remaining_work']].to_dict('records')

        logger.info(f"Processed {len(jobs)} jobs across {len(work_centers)} work centers")
        
        return {
            "jobs": jobs,
            "work_centers": work_centers,
            "schedules": []
        }

    except Exception as e:
        logger.error(f"Error processing SAP data: {str(e)}")
        raise
