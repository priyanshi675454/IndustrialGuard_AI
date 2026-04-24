import pandas as pd
import numpy as np

np.random.seed(42)
n = 500

data = pd.DataFrame({
    'machine_id': [f'M{str(i%10+1).zfill(3)}' for i in range(n)],
    'temperature': np.random.normal(75, 15, n),
    'vibration': np.random.normal(40, 10, n),
    'pressure': np.random.normal(100, 20, n),
    'rpm': np.random.normal(3000, 500, n),
    'oil_level': np.random.normal(70, 15, n),
    'hours_run': np.random.randint(100, 5000, n),
    'failure': np.random.choice([0, 1], n, p=[0.75, 0.25])
})

# Make failures realistic - high temp + vibration = more failure
data.loc[(data['temperature'] > 85) & (data['vibration'] > 50), 'failure'] = 1
data.loc[(data['pressure'] > 120) & (data['rpm'] > 3500), 'failure'] = 1

data.to_csv('sensor_data.csv', index=False)
print("✅ Dataset created! Rows:", len(data))
print(data.head())