from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import datetime

app = Flask(__name__)
CORS(app)

# Load trained model
model = joblib.load('failure_model.pkl')

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        
        features = [[
            data['temperature'],
            data['vibration'],
            data['pressure'],
            data['rpm'],
            data['oil_level'],
            data['hours_run']
        ]]
        
        prediction = model.predict(features)[0]
        probability = model.predict_proba(features)[0][1]
        risk_percent = round(probability * 100, 2)
        
        if risk_percent >= 70:
            status = "CRITICAL"
            action = "Immediate maintenance required!"
        elif risk_percent >= 40:
            status = "WARNING"
            action = "Schedule maintenance soon."
        else:
            status = "NORMAL"
            action = "Machine operating normally."
        
        return jsonify({
            'machine_id': data.get('machine_id', 'Unknown'),
            'risk_percent': risk_percent,
            'status': status,
            'action': action,
            'timestamp': datetime.datetime.utcnow().isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'AI Server Running ✅'})

if __name__ == '__main__':
    print("🚀 AI Prediction Server starting on port 5000...")
    app.run(debug=True, port=1000)