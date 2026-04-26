from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import datetime

app = Flask(__name__)
CORS(app)

# Feature names must match exactly what the model was trained on
FEATURE_NAMES = ['temperature', 'vibration', 'pressure', 'rpm', 'oil_level', 'hours_run']

# Load trained model
model = joblib.load('failure_model.pkl')

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json

        # FIX #1: Use DataFrame with feature names to match training (removes sklearn warning)
        features_df = pd.DataFrame([{
            'temperature': float(data.get('temperature', 75)),
            'vibration':   float(data.get('vibration', 40)),
            'pressure':    float(data.get('pressure', 100)),
            'rpm':         float(data.get('rpm', 3000)),
            'oil_level':   float(data.get('oil_level', 70)),
            'hours_run':   float(data.get('hours_run', 1000)),
        }])

        prediction   = model.predict(features_df)[0]
        probability  = model.predict_proba(features_df)[0][1]
        risk_percent = round(float(probability) * 100, 2)

        if risk_percent >= 70:
            status = "CRITICAL"
            action = "Immediate maintenance required!"
        elif risk_percent >= 40:
            status = "WARNING"
            action = "Schedule maintenance soon."
        else:
            status = "NORMAL"
            action = "Machine operating normally."

        # FIX #2: Use timezone-aware UTC (replaces deprecated utcnow)
        return jsonify({
            'machine_id':   data.get('machine_id', 'Unknown'),
            'risk_percent': risk_percent,
            'status':       status,
            'action':       action,
            'timestamp':    datetime.datetime.now(datetime.timezone.utc).isoformat()
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 400


# FIX #3: Add /chat route so server.cjs /api/chat proxy works
@app.route('/chat', methods=['POST'])
def chat():
    try:
        data    = request.json
        message = data.get('message', '')
        # This is a simple echo — server.cjs has a better fallback
        # Real Claude API calls are made from server.cjs directly
        return jsonify({'reply': f'AI received: {message}. Use Claude API key in server.cjs for smart responses.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'AI Server Running ✅'})


if __name__ == '__main__':
    print("🚀 AI Prediction Server starting on port 1000...")
    app.run(debug=True, port=1000)