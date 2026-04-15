import pandas as pd
import numpy as np
import json

np.random.seed(42)
n_samples = 5000

def generate_restaurant_data(n):
    data = []
    for _ in range(n):
        hour = np.random.randint(11, 23)
        day_of_week = np.random.randint(0, 7)
        party_size = np.random.choice([1,2,3,4,5,6,8,10], p=[0.05,0.30,0.20,0.25,0.08,0.07,0.03,0.02])
        tables_occupied = np.random.randint(0, 25)
        tables_total = 28
        queue_length = np.random.randint(0, 15)
        avg_party_ahead = np.random.uniform(1.5, 5.0)

        # Base dwell time by party size
        base_dwell = 20 + (party_size * 4)

        # Peak hours add wait
        is_peak = 1 if (13 <= hour <= 15 or 19 <= hour <= 22) else 0
        peak_factor = 1.4 if is_peak else 1.0

        # Weekend adds wait
        is_weekend = 1 if day_of_week >= 5 else 0
        weekend_factor = 1.2 if is_weekend else 1.0

        # Occupancy rate
        occupancy_rate = tables_occupied / tables_total

        # Calculate wait time
        if tables_occupied < tables_total * 0.5:
            wait = np.random.uniform(2, 8)
        else:
            available_soon = tables_total - tables_occupied
            if available_soon <= 0:
                available_soon = 1
            wait = (queue_length / max(available_soon, 1)) * base_dwell * peak_factor * weekend_factor
            wait = max(5, wait + np.random.normal(0, 3))

        wait = min(wait, 120)  # cap at 2 hours

        data.append({
            'hour_of_day': hour,
            'day_of_week': day_of_week,
            'party_size': party_size,
            'tables_occupied': tables_occupied,
            'tables_total': tables_total,
            'queue_length': queue_length,
            'avg_party_size_ahead': round(avg_party_ahead, 2),
            'occupancy_rate': round(occupancy_rate, 3),
            'is_peak_hour': is_peak,
            'is_weekend': is_weekend,
            'wait_minutes': round(max(2, wait), 1)
        })

    return pd.DataFrame(data)

df = generate_restaurant_data(n_samples)
df.to_csv('training_data.csv', index=False)
print(f"Generated {len(df)} training samples")
print(df.describe())
print(f"\nWait time distribution:")
print(f"  Mean: {df['wait_minutes'].mean():.1f} min")
print(f"  Median: {df['wait_minutes'].median():.1f} min")
print(f"  Max: {df['wait_minutes'].max():.1f} min")