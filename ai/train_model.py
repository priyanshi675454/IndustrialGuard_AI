import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import joblib

# Load data
df = pd.read_csv('sensor_data.csv')
print("✅ Data loaded:", df.shape)

# Features and target
features = ['temperature', 'vibration', 'pressure', 'rpm', 'oil_level', 'hours_run']
X = df[features]
y = df['failure']

# Split data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train model
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

# Accuracy
predictions = model.predict(X_test)
accuracy = accuracy_score(y_test, predictions)
print(f"✅ Model Accuracy: {accuracy * 100:.2f}%")
print(classification_report(y_test, predictions))

# Save model
joblib.dump(model, 'failure_model.pkl')
print("✅ Model saved as failure_model.pkl")