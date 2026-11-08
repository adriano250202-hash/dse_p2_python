import time
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Permite integracao com a Web App nativa

# Endpoint base do Firebase Realtime Database
FIREBASE_URL = "https://dse-p2-545de-default-rtdb.firebaseio.com/dispositivos/esp32_01"

# -------------------------------------------------------------
# ROTAS DA API REST (CONTROLE E SANITIZACAO)
# -------------------------------------------------------------

@app.route('/api/status', methods=['GET'])
def obter_status_sistema():
    """Retorna o estado sanitizado de todos os sensores e atuadores."""
    try:
        response = requests.get(f"{FIREBASE_URL}.json", timeout=5)
        if response.status_code == 200:
            dados = response.json() or {}
            return jsonify({
                "status": "online",
                "sensores": dados.get('sensores', {}),
                "atuadores": dados.get('atuadores', {}),
                "configuracao": dados.get('configuracao', {})
            }), 200
        return jsonify({"erro": "Falha na leitura do Firebase"}), 500
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@app.route('/api/alarme/alternar', methods=['POST'])
def alternar_estado_alarme():
    """Ativa ou desativa o estado de vigilancia armada via API."""
    try:
        corpo = request.get_json() or {}
        novo_estado = corpo.get('armar', True)
        
        # Atualizacao do estado do atuador no Firebase
        requests.patch(
            f"{FIREBASE_URL}/atuadores.json",
            json={"alarme_armado": novo_estado},
            timeout=5
        )

        # Insercao de registro no historico
        log_entry = {
            "evento": "ARMADO" if novo_estado else "DESARMADO",
            "ocorrencia": f"Comando via API Python Backend ({request.remote_addr})",
            "acao": "Vigilancia Ativada" if novo_estado else "Sistema em Standby",
            "timestamp": int(time.time() * 1000)
        }
        requests.post(f"{FIREBASE_URL}/historico.json", json=log_entry, timeout=5)

        return jsonify({
            "sucesso": True,
            "mensagem": f"Alarme {'ARMADO' if novo_estado else 'DESARMADO'} via Python Backend"
        }), 200

    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@app.route('/api/sensibilidade', methods=['PUT'])
def atualizar_sensibilidade():
    """Ajusta a distancia limite do sensor ultrassonico com validacao."""
    try:
        data = request.get_json() or {}
        limite_cm = data.get('limite_cm', 35)

        # Validacao sanitizada de intervalo de seguranca
        if not isinstance(limite_cm, (int, float)) or limite_cm < 5 or limite_cm > 400:
            return jsonify({"erro": "Limite invalido. Intervalo permitido: 5cm a 400cm."}), 400

        requests.patch(
            f"{FIREBASE_URL}/configuracao.json",
            json={"limite_cm": limite_cm},
            timeout=5
        )
        return jsonify({"sucesso": True, "novo_limite": limite_cm}), 200

    except Exception as e:
        return jsonify({"erro": str(e)}), 500


if __name__ == '__main__':
    print("------------------------------------------------------------")
    print("[SERVER] API REST Python Backend Ativa")
    print("Servidor em execucao: http://localhost:5000/api/status")
    print("------------------------------------------------------------")
    app.run(host='0.0.0.0', port=5000, debug=True)