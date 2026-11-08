import { db } from "./firebase-config.js";
import { ref, onValue, update, set, push, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

console.log("[JARVIS SYSTEM] Sentinel Monitor // Sincronização Dinâmica Ativada.");

// -------------------------------------------------------------
// 1. ELEMENTOS DOM
// -------------------------------------------------------------
const displayStatus = document.getElementById('display-status');
const alertBanner = document.getElementById('alert-banner');
const alertBannerText = document.getElementById('alert-banner-text');
const radarBlip = document.getElementById('radar-blip');
const historyLogs = document.getElementById('history-logs');
const rangeSensitivity = document.getElementById('range-sensitivity');
const sensitivityVal = document.getElementById('sensitivity-val');
const btnClearHistory = document.getElementById('btn-clear-history');
const btnToggleMode = document.getElementById('btn-toggle-mode');
const modeLabel = document.getElementById('mode-label');

const kpiAvgDist = document.getElementById('kpi-avg-dist');
const kpiMinDist = document.getElementById('kpi-min-dist');
const kpiMinuteAlerts = document.getElementById('kpi-minute-alerts');
const kpiTimer = document.getElementById('kpi-timer');
const reportOutput = document.getElementById('report-output');

// Referências Firebase
const atuadoresRef = ref(db, 'dispositivos/esp32_01/atuadores');
const sensoresRef = ref(db, 'dispositivos/esp32_01/sensores');
const historicoRef = ref(db, 'dispositivos/esp32_01/historico');
const configRef = ref(db, 'dispositivos/esp32_01/configuracao');
const relatoriosRef = ref(db, 'dispositivos/esp32_01/relatorios');

// Variáveis de Estado Globais
let modoApresentacao = false;
let limiteSensibilidadeAtual = 35;
let sistemaArmado = false;
let presencaDetectada = false;
let distanciaAtual = 150;
let travaCliqueBotao = false;

let leiturasDistancia = [];
let contagemSeguro = 0;
let contagemInvasao = 0;
let disparosNoUltimoMinuto = 0;
let tempoRestanteRelatorio = 60;

// -------------------------------------------------------------
// 2. GERENCIADOR DE ABAS
// -------------------------------------------------------------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    const tabId = btn.getAttribute('data-tab');
    document.getElementById(tabId)?.classList.add('active');
  });
});

// -------------------------------------------------------------
// 3. GRÁFICOS (CHART.JS)
// -------------------------------------------------------------
const ctxLine = document.getElementById('distanceChart')?.getContext('2d');
let distanceChart = null;

if (ctxLine) {
  distanceChart = new Chart(ctxLine, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Distância Medida (cm)',
          data: [],
          borderColor: '#00ff66',
          backgroundColor: 'rgba(0, 255, 102, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3
        },
        {
          label: 'Limite Sensibilidade (cm)',
          data: [],
          borderColor: '#ff003c',
          borderDash: [5, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, max: 200, grid: { color: 'rgba(255, 255, 255, 0.08)' }, ticks: { color: '#00ff66' } },
        x: { grid: { color: 'rgba(255, 255, 255, 0.08)' }, ticks: { color: '#4a7c59' } }
      },
      plugins: { legend: { labels: { color: '#e0ffe8' } } }
    }
  });
}

const ctxPie = document.getElementById('stateRatioChart')?.getContext('2d');
let stateRatioChart = null;

if (ctxPie) {
  stateRatioChart = new Chart(ctxPie, {
    type: 'doughnut',
    data: {
      labels: ['Tempo Seguro', 'Tempo em Alerta'],
      datasets: [{
        data: [1, 0],
        backgroundColor: ['#00ff66', '#ff003c'],
        borderColor: '#030705',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#e0ffe8' } } }
    }
  });
}

function atualizarLinhaThresholdGrafico() {
  if (!distanceChart) return;
  const totalPontos = distanceChart.data.labels.length;
  distanceChart.data.datasets[1].data = new Array(totalPontos).fill(limiteSensibilidadeAtual);
  distanceChart.update();
}

function atualizarGraficosEMetricas(distancia) {
  const agora = new Date().toLocaleTimeString();
  
  leiturasDistancia.push(distancia);
  if (leiturasDistancia.length > 20) leiturasDistancia.shift();

  if (distanceChart) {
    if (distanceChart.data.labels.length >= 20) {
      distanceChart.data.labels.shift();
      distanceChart.data.datasets[0].data.shift();
      distanceChart.data.datasets[1].data.shift();
    }
    distanceChart.data.labels.push(agora);
    distanceChart.data.datasets[0].data.push(distancia);
    distanceChart.data.datasets[1].data.push(limiteSensibilidadeAtual);

    if (distancia <= limiteSensibilidadeAtual) {
      distanceChart.data.datasets[0].borderColor = '#ff003c';
      distanceChart.data.datasets[0].backgroundColor = 'rgba(255, 0, 60, 0.2)';
    } else {
      distanceChart.data.datasets[0].borderColor = '#00ff66';
      distanceChart.data.datasets[0].backgroundColor = 'rgba(0, 255, 102, 0.1)';
    }
    distanceChart.update();
  }

  if (distancia <= limiteSensibilidadeAtual) contagemInvasao++;
  else contagemSeguro++;

  if (stateRatioChart) {
    stateRatioChart.data.datasets[0].data = [contagemSeguro, contagemInvasao];
    stateRatioChart.update();
  }

  const soma = leiturasDistancia.reduce((a, b) => a + b, 0);
  const media = (soma / leiturasDistancia.length).toFixed(1);
  const minima = Math.min(...leiturasDistancia).toFixed(1);

  if (kpiAvgDist) kpiAvgDist.innerText = `${media} cm`;
  if (kpiMinDist) kpiMinDist.innerText = `${minima} cm`;
  if (kpiMinuteAlerts) kpiMinuteAlerts.innerText = disparosNoUltimoMinuto;
}

// -------------------------------------------------------------
// 4. ATUALIZAÇÃO VISUAL UNIFICADA
// -------------------------------------------------------------
function recalcularEstadoGlobalVisual() {
  const violacaoDistancia = sistemaArmado && (distanciaAtual > 0 && distanciaAtual <= limiteSensibilidadeAtual);
  const emAlerta = sistemaArmado && (presencaDetectada || violacaoDistancia);

  if (!sistemaArmado) {
    if (displayStatus) { 
      displayStatus.innerText = "SISTEMA DESARMADO // STANDBY"; 
      displayStatus.className = "value state-warning"; 
    }
    if (alertBanner) { 
      alertBanner.className = "alert-banner banner-safe"; 
      if (alertBannerText) alertBannerText.innerText = "SISTEMA DESARMADO // VIGILÂNCIA PAUSADA"; 
    }
    if (radarBlip) radarBlip.style.opacity = '0';
  } else {
    if (emAlerta) {
      if (displayStatus) { 
        displayStatus.innerText = violacaoDistancia ? "INTRUSO RASTREADO (ULTRASSÔNICO)!" : "MOVIMENTO NA PORTARIA!"; 
        displayStatus.className = "value state-alert"; 
      }
      if (alertBanner) { 
        alertBanner.className = "alert-banner banner-alert"; 
        if (alertBannerText) alertBannerText.innerText = "⚠️ PERÍMETRO VIOLADO // ALARME SONORO E VISUAL ATIVO"; 
      }
      if (radarBlip) { 
        radarBlip.style.opacity = '1'; 
        radarBlip.style.top = '35%'; 
        radarBlip.style.left = '55%'; 
      }
    } else {
      if (displayStatus) { 
        displayStatus.innerText = "PERÍMETRO SEGURO (ARMADO)"; 
        displayStatus.className = "value state-safe"; 
      }
      if (alertBanner) { 
        alertBanner.className = "alert-banner banner-safe"; 
        if (alertBannerText) alertBannerText.innerText = "MONITORANDO // SISTEMA ARMADO & PERÍMETRO PROTEGIDO"; 
      }
      if (radarBlip) radarBlip.style.opacity = '0';
    }
  }
}

// -------------------------------------------------------------
// 5. LISTENERS EM TEMPO REAL (FIREBASE)
// -------------------------------------------------------------
onValue(atuadoresRef, (snapshot) => {
  const atuadores = snapshot.val() || {};
  sistemaArmado = atuadores.alarme_armado ?? false;
  recalcularEstadoGlobalVisual();
});

onValue(configRef, (snapshot) => {
  const config = snapshot.val();
  if (config && typeof config.limite_cm === 'number') {
    limiteSensibilidadeAtual = Number(config.limite_cm);
    
    if (rangeSensitivity && document.activeElement !== rangeSensitivity) {
      rangeSensitivity.value = limiteSensibilidadeAtual;
    }
    if (sensitivityVal) sensitivityVal.innerText = `${limiteSensibilidadeAtual} cm`;
    
    atualizarLinhaThresholdGrafico();
    recalcularEstadoGlobalVisual();
  }
});

onValue(sensoresRef, (snapshot) => {
  const sensores = snapshot.val() || {};
  distanciaAtual = sensores.distancia_cm !== undefined ? Number(sensores.distancia_cm) : 150;
  presencaDetectada = sensores.presenca || false;

  recalcularEstadoGlobalVisual();
  atualizarGraficosEMetricas(distanciaAtual);
});

onValue(historicoRef, (snapshot) => {
  const logsData = snapshot.val();
  if (!historyLogs) return;

  if (!logsData) {
    historyLogs.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #888;">Nenhum registro no banco de dados.</td></tr>`;
    return;
  }

  const logsArray = Object.keys(logsData).map(key => ({
    key: key,
    ...logsData[key]
  })).sort((a, b) => b.timestamp - a.timestamp);

  historyLogs.innerHTML = logsArray.slice(0, 10).map(log => `
    <tr>
      <td>${log.data_hora || "N/A"}</td>
      <td>${log.ocorrencia || "Detecção"}</td>
      <td style="color: ${log.evento === 'DISPARADO' ? '#ff003c' : '#00ff66'}">${log.evento || "INFO"}</td>
      <td>${log.acao || "N/A"}</td>
      <td>
        <button class="btn-delete-row" data-key="${log.key}">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll('.btn-delete-row').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const key = e.currentTarget.getAttribute('data-key');
      remove(ref(db, `dispositivos/esp32_01/historico/${key}`));
    };
  });
});

// -------------------------------------------------------------
// 6. RELATÓRIO DE 1 MINUTO E PERSISTÊNCIA NO FIREBASE
// -------------------------------------------------------------
setInterval(() => {
  tempoRestanteRelatorio--;
  if (kpiTimer) kpiTimer.innerText = `${tempoRestanteRelatorio}s`;

  if (tempoRestanteRelatorio <= 0) {
    gerarERegistrarRelatorioMinutado();
    tempoRestanteRelatorio = 60;
  }
}, 1000);

function gerarERegistrarRelatorioMinutado() {
  const agora = new Date();
  const horarioFormatado = agora.toLocaleTimeString();
  const totalLeituras = leiturasDistancia.length || 1;
  const soma = leiturasDistancia.reduce((a, b) => a + b, 0);
  const media = Number((soma / totalLeituras).toFixed(1));
  const menorDist = leiturasDistancia.length > 0 ? Number(Math.min(...leiturasDistancia).toFixed(1)) : 150;

  const statusTexto = disparosNoUltimoMinuto > 0 
    ? `CRÍTICO (${disparosNoUltimoMinuto} INCIDENTE(S))` 
    : "ESTÁVEL / SEM ANOMALIAS";

  const novoRelatorio = {
    timestamp: Date.now(),
    data_hora: horarioFormatado,
    media_distancia_cm: media,
    menor_distancia_cm: menorDist,
    total_disparos_minuto: disparosNoUltimoMinuto,
    limite_sensibilidade_cm: limiteSensibilidadeAtual,
    status_perimetro: statusTexto
  };

  push(relatoriosRef, novoRelatorio);

  if (reportOutput) {
    reportOutput.innerHTML = `
      📌 <strong>RELATÓRIO EMITIDO ÀS ${horarioFormatado} (SALVO NO FIREBASE)</strong><br>
      • Status do Perímetro: <strong>${statusTexto}</strong><br>
      • Média de Proximidade: <strong>${media} cm</strong> (Sensibilidade: <strong>${limiteSensibilidadeAtual} cm</strong>)<br>
      • Maior Proximidade Registrada: <strong>${menorDist} cm</strong><br>
      • Total de Disparos no Período (60s): <strong>${disparosNoUltimoMinuto}</strong>
    `;
  }

  disparosNoUltimoMinuto = 0;
  if (kpiMinuteAlerts) kpiMinuteAlerts.innerText = 0;
}

// -------------------------------------------------------------
// 7. FUNÇÕES E BOTÕES DA INTERFACE
// -------------------------------------------------------------
function executarAcaoComLog(ocorrencia, evento, acao, dadosAtuadores) {
  if (travaCliqueBotao) return;
  travaCliqueBotao = true;

  const agora = new Date();
  const novoLog = {
    timestamp: Date.now(),
    data_hora: agora.toLocaleTimeString(),
    ocorrencia: ocorrencia,
    evento: evento,
    acao: acao
  };

  if (evento === "DISPARADO") disparosNoUltimoMinuto++;

  push(historicoRef, novoLog);
  update(ref(db, 'dispositivos/esp32_01'), dadosAtuadores);

  setTimeout(() => { travaCliqueBotao = false; }, 800);
}

btnToggleMode?.addEventListener('click', () => {
  modoApresentacao = !modoApresentacao;
  if (modoApresentacao) {
    btnToggleMode.className = "btn-mode mode-demo";
    btnToggleMode.innerHTML = `<i class="fa-solid fa-toggle-off"></i> VOLTAR PARA REAL (ESP32)`;
    if (modeLabel) modeLabel.innerHTML = `MODO: <strong style="color: #ff003c;">APRESENTAÇÃO (SIMULADOR)</strong>`;
  } else {
    btnToggleMode.className = "btn-mode mode-real";
    btnToggleMode.innerHTML = `<i class="fa-solid fa-toggle-on"></i> ALTERAR PARA APRESENTAÇÃO`;
    if (modeLabel) modeLabel.innerHTML = `MODO: <strong style="color: #00ff66;">REAL (ESP32)</strong>`;
  }
});

// EVENTOS DOS BOTÕES (ARMAR / DESARMAR / SIMULAR)
document.getElementById('btn-arm')?.addEventListener('click', () => {
  distanciaAtual = 150;
  presencaDetectada = false;

  executarAcaoComLog("Alarme Armado", "ARMADO", "Sistema Ativado", {
    "atuadores/alarme_armado": true,
    "atuadores/buzzer": false,
    "atuadores/led_rgb": "verde",
    "sensores/distancia_cm": 150,
    "sensores/presenca": false
  });
});

document.getElementById('btn-disarm')?.addEventListener('click', () => {
  distanciaAtual = 150;
  presencaDetectada = false;

  executarAcaoComLog("Alarme Desarmado", "DESARMADO", "Sistema Desativado", {
    "atuadores/alarme_armado": false,
    "atuadores/buzzer": false,
    "atuadores/led_rgb": "verde",
    "sensores/distancia_cm": 150,
    "sensores/presenca": false
  });
});

document.getElementById('btn-simulate')?.addEventListener('click', () => {
  const distSimulada = Math.max(2, limiteSensibilidadeAtual - 5);

  executarAcaoComLog("Simulação de Invasão (Portaria)", "DISPARADO", "Varredura Servo + LED Piscando + Buzzer", {
    "atuadores/alarme_armado": true,
    "atuadores/buzzer": true,
    "atuadores/led_rgb": "vermelho_piscando",
    "sensores/distancia_cm": distSimulada,
    "sensores/presenca": true,
    "sensores/ultima_atualizacao": Date.now()
  });
});

// SLIDER DE SENSIBILIDADE EM TEMPO REAL
if (rangeSensitivity) {
  rangeSensitivity.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    limiteSensibilidadeAtual = val;
    if (sensitivityVal) sensitivityVal.innerText = `${val} cm`;
    
    atualizarLinhaThresholdGrafico();
    set(configRef, { limite_cm: val });
  });
}

// CORREÇÃO DO BOTÃO DE LIMPAR HISTÓRICO
if (btnClearHistory) {
  btnClearHistory.addEventListener('click', () => {
    if (confirm("Deseja apagar todo o histórico de invasões no Firebase?")) {
      remove(historicoRef).then(() => {
        if (historyLogs) {
          historyLogs.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #888;">Nenhum registro no banco de dados.</td></tr>`;
        }
      }).catch(err => {
        console.error("Erro ao apagar histórico:", err);
      });
    }
  });
}

// -------------------------------------------------------------
// 8. EMISSÃO DE PDF DINÂMICO CONECTADO AO FIREBASE
// -------------------------------------------------------------
document.getElementById('btn-download-pdf')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-download-pdf');
  const textoOriginal = btn.innerHTML;

  try {
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> CONECTANDO AO FIREBASE...`;
    btn.disabled = true;

    const FIREBASE_URL = "https://dse-p2-545de-default-rtdb.firebaseio.com/dispositivos/esp32_01.json";
    const response = await fetch(FIREBASE_URL);
    if (!response.ok) throw new Error("Falha ao comunicar com o Firebase Realtime Database");
    
    const dbData = await response.json() || {};
    
    btn.innerHTML = `<i class="fa-solid fa-cog fa-spin"></i> PROCESSANDO ESTATÍSTICAS...`;

    const configuracao = dbData.configuracao || {};
    const sensores = dbData.sensores || {};
    const atuadores = dbData.atuadores || {};
    const historicoObj = dbData.historico || {};

    const historicoArray = Object.values(historicoObj);
    const totalLogs = historicoArray.length;

    let disparosAlarme = 0;
    let vezesArmado = 0;
    let vezesDesarmado = 0;

    historicoArray.forEach(log => {
      const ev = (log.evento || '').toUpperCase();
      const acao = (log.acao || '').toUpperCase();
      const oc = (log.ocorrencia || '').toUpperCase();

      if (ev === 'DISPARADO' || acao.includes('DISPARO') || oc.includes('INVASÃO')) {
        disparosAlarme++;
      } else if (ev === 'ARMADO' || acao.includes('ARMADO')) {
        vezesArmado++;
      } else if (ev === 'DESARMADO' || acao.includes('DESARMADO')) {
        vezesDesarmado++;
      }
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    const COLOR_BG = [3, 7, 5];
    const COLOR_CARD = [6, 20, 12];
    const COLOR_GREEN = [0, 255, 102];
    const COLOR_CYAN = [0, 225, 255];
    const COLOR_WHITE = [224, 255, 232];
    const COLOR_BORDER = [0, 255, 102];

    doc.setFillColor(...COLOR_BG);
    doc.rect(0, 0, 210, 297, 'F');

    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.5);
    doc.rect(8, 8, 194, 281);

    doc.setFont("courier", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...COLOR_GREEN);
    doc.text("AREA 51 // SENTINEL MONITORING SYSTEM", 14, 20);

    doc.setFontSize(8);
    doc.setTextColor(...COLOR_CYAN);
    const dataHoraStr = new Date().toLocaleString('pt-BR');
    const hashRelatorio = Math.random().toString(36).substring(2, 10).toUpperCase();
    doc.text(`RELATÓRIO DE AUDITORIA DE SEGURANÇA | HASH: #${hashRelatorio} | EMISSÃO: ${dataHoraStr}`, 14, 26);
    doc.setDrawColor(...COLOR_GREEN);
    doc.line(14, 29, 196, 29);

    doc.setFontSize(10);
    doc.setTextColor(...COLOR_CYAN);
    doc.text("RESUMO ANALÍTICO DE EVENTOS E AUDITORIA DE INVASÕES", 14, 36);

    doc.autoTable({
      startY: 40,
      head: [['TOTAL DE LOGS', 'DISPAROS CRÍTICOS', 'CICLOS ARMADO', 'CICLOS DESARMADO']],
      body: [
        [`${totalLogs} evento(s)`, `${disparosAlarme} ocorrência(s)`, `${vezesArmado} vez(es)`, `${vezesDesarmado} vez(es)`]
      ],
      theme: 'grid',
      styles: {
        font: 'courier',
        fontSize: 9,
        fillColor: COLOR_CARD,
        textColor: COLOR_WHITE,
        lineColor: [0, 225, 255],
        lineWidth: 0.2,
        halign: 'center'
      },
      headStyles: {
        fillColor: [6, 30, 40],
        textColor: COLOR_CYAN,
        fontStyle: 'bold',
        halign: 'center'
      },
      margin: { left: 14, right: 14 }
    });

    const startYParam = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_CYAN);
    doc.text("ESTADO EM TEMPO REAL DOS SENSORES E ATUADORES", 14, startYParam);

    const stAlarme = atuadores.alarme_armado ? "ARMADO" : "DESARMADO";
    const stPresenca = sensores.presenca ? "VIOLAÇÃO / PRESENÇA" : "NORMAL / SEM PRESENÇA";
    const stDistancia = sensores.distancia_cm ? `${sensores.distancia_cm} cm` : "N/A";
    const stSensibilidade = configuracao.limite_cm ? `${configuracao.limite_cm} cm` : "35 cm";

    doc.autoTable({
      startY: startYParam + 4,
      head: [['COMPONENTE / PARÂMETRO', 'VALOR EM NUVEM', 'STATUS TÁTICO']],
      body: [
        ['Estado do Alarme (Buzzer/LED)', stAlarme, atuadores.alarme_armado ? 'VIGILÂNCIA ATIVA' : 'SISTEMA STANDBY'],
        ['Sensibilidade Threshold (PIR/Dist)', stSensibilidade, 'CONFIGURADO VIA WEB'],
        ['Telemetria Ultrassônica', stDistancia, 'LEITURA DIRETA ESP32'],
        ['Sensor de Presença Perimetral', stPresenca, sensores.presenca ? 'ALERTA DETECTADO' : 'VARREDURA LIMPA'],
        ['Total de Invasões Confirmadas', `${disparosAlarme} registro(s)`, disparosAlarme > 0 ? 'ANOMALIAS AUDITADAS' : 'PERÍMETRO INTACTO']
      ],
      theme: 'grid',
      styles: {
        font: 'courier',
        fontSize: 8.5,
        fillColor: COLOR_CARD,
        textColor: COLOR_WHITE,
        lineColor: COLOR_BORDER,
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: [10, 35, 20],
        textColor: COLOR_GREEN,
        fontStyle: 'bold'
      },
      margin: { left: 14, right: 14 }
    });

    const finalYLogs = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_CYAN);
    doc.text("HISTÓRICO RECENTE DE REGISTROS DO FIREBASE (ÚLTIMOS EVENTOS)", 14, finalYLogs);

    const logsFormatted = [];
    if (historicoArray.length > 0) {
      historicoArray.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      historicoArray.slice(0, 8).forEach(item => {
        logsFormatted.push([
          item.data_hora || new Date(item.timestamp || Date.now()).toLocaleString('pt-BR'),
          item.ocorrencia || item.evento || 'REGISTRO DE TELEMETRIA',
          item.acao || (item.evento === 'DISPARADO' ? 'ALARME SONORO ATIVADO' : 'SISTEMA NORMAL')
        ]);
      });
    } else {
      logsFormatted.push([dataHoraStr, 'BANCO DE DADOS INICIALIZADO', 'SEM INVASÕES REGISTRADAS']);
    }

    doc.autoTable({
      startY: finalYLogs + 4,
      head: [['DATA / HORA', 'OCORRÊNCIA / EVENTO', 'AÇÃO / REGISTRO TÁTICO']],
      body: logsFormatted,
      theme: 'grid',
      styles: {
        font: 'courier',
        fontSize: 8,
        fillColor: COLOR_CARD,
        textColor: COLOR_WHITE,
        lineColor: [0, 225, 255],
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: [6, 30, 40],
        textColor: COLOR_CYAN,
        fontStyle: 'bold'
      },
      margin: { left: 14, right: 14 }
    });

    doc.setFontSize(7);
    doc.setTextColor(...COLOR_GREEN);
    doc.text(`DOCUMENTO AUTENTICADO DE FORMA AUTOMÁTICA | HASH DE VERIFICAÇÃO: AREA51-${hashRelatorio}`, 14, 284);

    doc.save(`Relatorio_Area51_Sentinel_${Date.now()}.pdf`);

    btn.innerHTML = `<i class="fa-solid fa-check"></i> RELATÓRIO DINÂMICO EMITIDO!`;
  } catch (err) {
    console.error("Falha ao compilar PDF via Firebase:", err);
    alert("⚠️ Erro ao consultar o Firebase Realtime Database. Verifique a conexão com a internet.");
  } finally {
    setTimeout(() => {
      btn.innerHTML = textoOriginal;
      btn.disabled = false;
    }, 3000);
  }
});

// =============================================================
// AUTO-CLOSE SPLASH SCREEN HACKER (3 SEGUNDOS)
// =============================================================
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const splash = document.getElementById('hacker-splash');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => splash.remove(), 500);
    }
  }, 3000);
});