import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler
import pickle
import json
import os

print("Loading training data...")
df = pd.read_csv('training_data.csv')

FEATURES = [
    'hour_of_day',
    'day_of_week', 
    'party_size',
    'tables_occupied',
    'tables_total',
    'queue_length',
    'avg_party_size_ahead',
    'occupancy_rate',
    'is_peak_hour',
    'is_weekend'
]

X = df[FEATURES]
y = df['wait_minutes']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print(f"Training samples: {len(X_train)}")
print(f"Test samples: {len(X_test)}")

# Train XGBoost
print("\nTraining XGBoost model...")
model = xgb.XGBRegressor(
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

model.fit(
    X_train, y_train,
    eval_set=[(X_test, y_test)],
    verbose=False
)

# Evaluate
y_pred = model.predict(X_test)
mae = mean_absolute_error(y_test, y_pred)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
r2 = r2_score(y_test, y_pred)

print(f"\n{'='*40}")
print(f"MODEL PERFORMANCE")
print(f"{'='*40}")
print(f"MAE:  {mae:.2f} minutes")
print(f"RMSE: {rmse:.2f} minutes")
print(f"R²:   {r2:.4f}")
print(f"{'='*40}")

# Feature importance
importance = dict(zip(FEATURES, model.feature_importances_))
importance_sorted = sorted(importance.items(), key=lambda x: x[1], reverse=True)
print(f"\nFeature Importance:")
for feat, imp in importance_sorted:
    bar = '█' * int(imp * 50)
    print(f"  {feat:<25} {bar} {imp:.4f}")

# Save model
os.makedirs('model', exist_ok=True)
with open('model/wait_time_model.pkl', 'wb') as f:
    pickle.dump(model, f)

# Save feature list and metadata
metadata = {
    'features': FEATURES,
    'mae': round(mae, 2),
    'rmse': round(rmse, 2),
    'r2': round(r2, 4),
    'n_training_samples': len(X_train),
    'model_type': 'XGBoostRegressor'
}
with open('model/metadata.json', 'w') as f:
    json.dump(metadata, f, indent=2)

print(f"\nModel saved to model/wait_time_model.pkl")
print(f"Metadata saved to model/metadata.json")
print(f"\nModel is ready for serving!")