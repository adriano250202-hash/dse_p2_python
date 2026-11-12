import os
import time
import datetime
import requests
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import matplotlib.pyplot as plt

# -------------------------------------------------------------
# CONFIGURACAO DE CONEXAO FIREBASE
# -------------------------------------------------------------
FIREBASE_URL = "https://dse-p2-f3944-default-rtdb.firebaseio.com/area51_dse_p2/dispositivos/esp32_01.json"

def obter_dados_firebase():
    """Consome a arvore completa do dispositivo no Realtime Database."""
    print("[PYTHON CORE] Conectando ao Firebase Realtime Database...")
    try:
        response = requests.get(f"{FIREBASE_URL}.json")
        if response.status_code == 200:
            return response.json()
        else:
            print(f"[ERRO] Acesso ao Firebase. Codigo: {response.status_code}")
            return None
    except Exception as e:
        print(f"[ERRO] Conexao: {e}")
        return None

def gerar_grafico_historico(historico_data):
    """Gera um grafico estatico de disparos com tema Cyberpunk para o PDF."""
    caminho_imagem = "grafico_temp.png"
    
    if not historico_data:
        plt.figure(figsize=(6, 2.3), facecolor='#030705')
        ax = plt.axes()
        ax.set_facecolor('#06140c')
        plt.text(0.5, 0.5, 'Sem dados suficientes no historico', horizontalalignment='center', verticalalignment='center', color='#00ff66', fontsize=9)
        plt.axis('off')
        plt.tight_layout()
        plt.savefig(caminho_imagem, dpi=150, facecolor=plt.gcf().get_facecolor())
        plt.close()
        return caminho_imagem

    eventos = [log.get('evento', 'INFO') for log in historico_data.values()]
    categorias = ['DISPARADO', 'ARMADO', 'DESARMADO']
    valores = [
        sum(1 for e in eventos if e == 'DISPARADO'),
        sum(1 for e in eventos if e == 'ARMADO'),
        sum(1 for e in eventos if e == 'DESARMADO')
    ]
    cores = ['#ff003c', '#00ff66', '#00e1ff']

    plt.figure(figsize=(6, 2.3), facecolor='#030705')
    ax = plt.axes()
    ax.set_facecolor('#06140c')
    
    plt.bar(categorias, valores, color=cores, width=0.45)
    plt.title('DISTRIBUICAO DE EVENTOS AUDITADOS', color='#00ff66', fontsize=10, fontweight='bold', pad=10)
    plt.tick_params(colors='#e0ffe8', labelsize=8)
    
    for spine in ax.spines.values():
        spine.set_color('#00ff66')
        spine.set_linewidth(0.8)

    plt.tight_layout()
    plt.savefig(caminho_imagem, dpi=150, facecolor=plt.gcf().get_facecolor())
    plt.close()
    return caminho_imagem

def compilar_pdf_executivo():
    dados = obter_dados_firebase()
    if not dados:
        print("[AVISO] Operacao abortada por falta de dados.")
        return

    config = dados.get('configuracao', {})
    historico = dados.get('historico', {})
    sensores = dados.get('sensores', {})
    atuadores = dados.get('atuadores', {})

    nome_pdf = f"Relatorio_Area51_Sentinel_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    doc = SimpleDocTemplate(nome_pdf, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []

    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontName='Courier-Bold',
        fontSize=16,
        textColor=colors.HexColor('#00ff66'),
        spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'SubTitleStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        textColor=colors.HexColor('#00e1ff'),
        spaceAfter=15
    )
    section_style = ParagraphStyle(
        'SectionStyle',
        parent=styles['Heading2'],
        fontName='Courier-Bold',
        fontSize=11,
        textColor=colors.HexColor('#00e1ff'),
        spaceBefore=12,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        'BodyStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        textColor=colors.HexColor('#e0ffe8')
    )
    header_table_style = ParagraphStyle(
        'HeaderTableStyle',
        parent=styles['Normal'],
        fontName='Courier-Bold',
        fontSize=8,
        textColor=colors.HexColor('#00ff66')
    )

    # 1. Cabecalho
    story.append(Paragraph("AREA 51 // SENTINEL MONITORING SYSTEM", title_style))
    story.append(Paragraph(f"RELATORIO DE AUDITORIA DE SEGURANCA E TELEMETRIA | EMISSAO: {datetime.datetime.now().strftime('%d/%m/%Y %H:%M:%S')}", subtitle_style))
    story.append(Spacer(1, 5))

    # 2. Dados Taticos
    sensibilidade = config.get('limite_cm', 35)
    distancia = sensores.get('distancia_cm', 'N/A')
    presenca = "DETECTADA" if sensores.get('presenca', False) else "AUSENTE"
    status_alarme = "ARMADO" if atuadores.get('alarme_armado', False) else "DESARMADO"

    tabela_estado_dados = [
        [Paragraph("PARAMETRO TATICO", header_table_style), Paragraph("VALOR REGISTRADO", header_table_style), Paragraph("STATUS DO SISTEMA", header_table_style)],
        [Paragraph("Estado do Alarme", body_style), Paragraph(str(status_alarme), body_style), Paragraph("OPERACIONAL", body_style)],
        [Paragraph("Sensibilidade Threshold", body_style), Paragraph(f"{sensibilidade} cm", body_style), Paragraph("CONFIGURADO VIA WEB", body_style)],
        [Paragraph("Ultima Distancia Medida", body_style), Paragraph(f"{distancia} cm", body_style), Paragraph("TELEMETRIA 1:1", body_style)],
        [Paragraph("Deteccao Portaria (PIR)", body_style), Paragraph(str(presenca), body_style), Paragraph("VARREDURA ATIVA", body_style)]
    ]

    tabela_estado = Table(tabela_estado_dados, colWidths=[180, 180, 180])
    tabela_estado.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0a2314')),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#06140c')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#00ff66')),
    ]))
    story.append(tabela_estado)
    story.append(Spacer(1, 10))

    # 3. Grafico Estatico
    story.append(Paragraph("DISTRIBUICAO DE DISPAROS E OPERACOES", section_style))
    img_path = gerar_grafico_historico(historico)
    story.append(Image(img_path, width=380, height=145))
    story.append(Spacer(1, 10))

    # 4. Tabela de Historico
    story.append(Paragraph("REGISTROS RECENTES DE AUDITORIA (HISTORICO)", section_style))
    
    tabela_logs_dados = [[
        Paragraph("DATA / HORA", header_table_style),
        Paragraph("OCORRENCIA", header_table_style),
        Paragraph("EVENTO", header_table_style),
        Paragraph("ACAO EXECUTADA", header_table_style)
    ]]

    if historico:
        logs_ordenados = sorted(historico.values(), key=lambda x: x.get('timestamp', 0), reverse=True)[:5]
        for log in logs_ordenados:
            tabela_logs_dados.append([
                Paragraph(str(log.get('data_hora', 'N/A')), body_style),
                Paragraph(str(log.get('ocorrencia', 'Deteccao')), body_style),
                Paragraph(str(log.get('evento', 'INFO')), body_style),
                Paragraph(str(log.get('acao', 'N/A')), body_style)
            ])
    else:
        tabela_logs_dados.append([Paragraph("Nenhum registro no historico.", body_style), "-", "-", "-"])

    tabela_logs = Table(tabela_logs_dados, colWidths=[110, 150, 90, 190])
    tabela_logs.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#063028')),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#06140c')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#00e1ff')),
    ]))
    story.append(tabela_logs)

    # Compilacao
    doc.build(story)
    
    if os.path.exists(img_path):
        os.remove(img_path)

    print(f"Relatorio PDF gerado com sucesso: {nome_pdf}")

if __name__ == "__main__":
    compilar_pdf_executivo()