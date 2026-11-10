import time
import os
import requests
from datetime import datetime

from splash_hacker import SplashHackerAlien

# -------------------------------------------------------------
# CONFIGURACAO DE CONEXAO AO FIREBASE REALTIME DATABASE
# -------------------------------------------------------------
FIREBASE_URL = "https://dse-p2-545de-default-rtdb.firebaseio.com/dispositivos/esp32_01.json"
LOG_FILE = "auditoria_watchdog.log"

def registrar_log_local(mensagem):
    """Grava o registro de emergencia em um arquivo de log local para auditoria."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    linha_log = f"[{timestamp}] {mensagem}\n"
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(linha_log)

def emitir_alerta_console(tipo, mensagem, detalhes=""):
    """Exibe alertas taticos formatados no terminal do sistema."""
    horario = datetime.now().strftime("%H:%M:%S")
    
    if tipo == "CRITICO":
        print("\n" + "="*60)
        print(f"[ALERTA CRITICO DE SEGURANCA] | Horario: {horario}")
        print(f"Ocorrencia: {mensagem}")
        if detalhes:
            print(f"Telemetria: {detalhes}")
        print("Acao: Evento registrado no log local e enviado para auditoria.")
        print("="*60 + "\n")
        registrar_log_local(f"CRITICO: {mensagem} | {detalhes}")

    elif tipo == "INFO":
        print(f"WATCHDOG | {horario}] {mensagem}")
        registrar_log_local(f"INFO: {mensagem}")

def iniciar_watchdog():
    print("\n------------------------------------------------------------")
    print("[WATCHDOG CORE] Monitoramento Autonomo Ativo")
    print("Conectado ao Firebase Realtime Database em tempo real")
    print(f"Arquivo de log local: {os.path.abspath(LOG_FILE)}")
    print("------------------------------------------------------------\n")
    
    ultimo_estado_presenca = False
    ultimo_estado_alarme = False

    while True:
        try:
            response = requests.get(FIREBASE_URL, timeout=5)
            if response.status_code == 200:
                dados = response.json() or {}
                sensores = dados.get('sensores', {})
                atuadores = dados.get('atuadores', {})
                config = dados.get('configuracao', {})

                presenca_atual = sensores.get('presenca', False)
                alarme_atual = atuadores.get('alarme_armado', False)
                distancia = sensores.get('distancia_cm', 999)
                threshold = config.get('limite_cm', 35)

                # Deteccao de Invasao Instantanea na Portaria
                if presenca_atual and not ultimo_estado_presenca:
                    emitir_alerta_console(
                        "CRITICO",
                        "Invasao detectada na portaria",
                        f"Proximidade do intruso: {distancia} cm (Limite: {threshold} cm)"
                    )

                # Mudanca no Estado do Alarme
                if alarme_atual != ultimo_estado_alarme:
                    status_str = "Sistema Armado (Vigilancia Ativa)" if alarme_atual else "Sistema Desarmado (Modo Standby)"
                    emitir_alerta_console("INFO", f"Estado do alarme alterado para: {status_str}")

                ultimo_estado_presenca = presenca_atual
                ultimo_estado_alarme = alarme_atual

            time.sleep(2)

        except KeyboardInterrupt:
            print("\nMonitoramento de vigilancia encerrado pelo operador.")
            break
        except Exception as e:
            print(f"[ERRO] Comunicacao Firebase: {e}")
            time.sleep(5)

if __name__ == "__main__":
    # 1. Exibe a tela hacker pixelada por 3 segundos
    SplashHackerAlien(duracao_segundos=3).iniciar()
    
    # 2. Inicia o monitoramento continuo do Watchdog
    iniciar_watchdog()