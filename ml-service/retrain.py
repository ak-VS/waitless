import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import pickle
import json
import os
import psycopg2
from dotenv import load_dotenv
from datetime import datetime

load_dotenv('../.env.local')

DATABASE_URL = os.getenv('DATABASE_URL')

def fetch_real_data():
    print("Fetching real training data from database...")
    try:
        conn = psycopg2.connect(DATABASE_URL, sslmode='require')
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                ts.party_size,
                ts.day_of_week,
                ts.hour_of_day,
                ts.dwell_minutes,
                rt.seats as table_seats,
                rt.zone,
                COUNT(ts2.id) FILTER (
                    WHERE ts2.restaurant_id = ts.restaurant_id 
                    AND ts2.seated_at <= ts.seated_at 
                    AND ts2.cleared_at IS NULL
                ) as tables_occupied_at_time,
                (SELECT COUNT(*) FROM restaurant_tables rt2 
                 WHERE rt2.restaurant_id = ts.restaurant_id) as tables_total
            FROM table_sessions ts
            JOIN restaurant_tables rt ON rt.id = ts.table_id
            LEFT JOIN table_sessions ts2 ON ts2.restaurant_id = ts.restaurant_id
            WHERE ts.dwell_minutes IS NOT NULL
            AND ts.dwell_minutes > 5
            AND ts.dwell_minutes < 180
            GROUP BY ts.id, ts.party_size, ts.day_of_week, ts.hour_of_day, 
                     ts.dwell_minutes, rt.seats, rt.zone, ts.restaurant_id, ts.seated_at
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        print(f"Fetched {len(rows)} real sessions from DB")
        return rows
    except Exception as e:
        print(f"DB fetch failed: {e}")
        return []

def build_features_from_real(rows):
    data = []
    for row in rows:
        party_size, day_of_week, hour_of_day, dwell_minutes, \
        table_seats, zone, tables_occupied, tables_total = row

        is_peak = 1 if (13 <= hour_of_day <= 15 or 19 <= hour_of_day <= 22) else 0
        is_weekend = 1 if day_of_week >= 5 else 0
        occupancy_rate = tables_occupied / max(tables_total, 1)

        data.append({
            'hour_of_day': hour_of_day,
            'day_of_week': day_of_week,
            'party_size': party_size,
            'tables_occupied': tables_occupied,
            'tables_total': tables_total,
            'queue_length': max(0, int(occupancy_rate * 5)),
            'avg_party_size_ahead': party_size,
            'occupancy_rate': round(occupancy_rate, 3),
            'is_peak_hour': is_peak,
            'is_weekend': is_weekend,
            'wait_minutes': round(dwell_minutes, 1)
        })
    return pd.DataFrame(data)

def retrain():
    print(f"\n{'='*50}")
    print(f"WAITLESS ML RETRAINING — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"{'='*50}")

    # Load existing synthetic data
    synthetic_df = pd.read_csv('training_data.csv')
    print(f"Synthetic samples: {len(synthetic_df)}")

    # Fetch real data from DB
    real_rows = fetch_real_data()

    if len(real_rows) >= 50:
        real_df = build_features_from_real(real_rows)
        # Weight real data 3x more than synthetic
        real_df_weighted = pd.concat([real_df] * 3, ignore_index=True)
        combined_df = pd.concat([synthetic_df, real_df_weighted], ignore_index=True)
        print(f"Real samples: {len(real_df)} (weighted 3x)")
        print(f"Combined samples: {len(combined_df)}")
    else:
        combined_df = synthetic_df
        print(f"Not enough real data yet ({len(real_rows)} sessions). Using synthetic only.")
        print(f"Need 50+ completed sessions for real data training.")

    FEATURES = [
        'hour_of_day', 'day_of_week', 'party_size',
        'tables_occupied', 'tables_total', 'queue_length',
        'avg_party_size_ahead', 'occupancy_rate',
        'is_peak_hour', 'is_weekend'
    ]

    X = combined_df[FEATURES]
    y = combined_df['wait_minutes']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print(f"\nTraining new model...")
    new_model = xgb.XGBRegressor(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=3,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        n_jobs=-1
    )
    new_model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    y_pred = new_model.predict(X_test)
    new_mae = mean_absolute_error(y_test, y_pred)
    new_rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    new_r2 = r2_score(y_test, y_pred)

    print(f"\nNew model performance:")
    print(f"  MAE:  {new_mae:.2f} min")
    print(f"  RMSE: {new_rmse:.2f} min")
    print(f"  R²:   {new_r2:.4f}")

    # Load old model metrics
    old_mae = float('inf')
    try:
        with open('model/metadata.json', 'r') as f:
            old_meta = json.load(f)
            old_mae = old_meta.get('mae', float('inf'))
        print(f"\nOld model MAE: {old_mae:.2f} min")
    except:
        print("No existing model found")

    # Replace if better or if no model exists
    if new_mae <= old_mae * 1.05:  # allow 5% tolerance
        with open('model/wait_time_model.pkl', 'wb') as f:
            pickle.dump(new_model, f)

        metadata = {
            'features': FEATURES,
            'mae': round(new_mae, 2),
            'rmse': round(new_rmse, 2),
            'r2': round(new_r2, 4),
            'n_training_samples': len(X_train),
            'real_samples': len(real_rows),
            'model_type': 'XGBoostRegressor',
            'last_trained': datetime.now().isoformat()
        }
        with open('model/metadata.json', 'w') as f:
            json.dump(metadata, f, indent=2)

        print(f"\n✓ Model updated — MAE improved from {old_mae:.2f} to {new_mae:.2f} min")
    else:
        print(f"\n✗ New model worse — keeping old model (old MAE: {old_mae:.2f}, new: {new_mae:.2f})")

    print(f"\n{'='*50}")
    print("Retraining complete")
    print(f"{'='*50}\n")

if __name__ == '__main__':
    retrain()