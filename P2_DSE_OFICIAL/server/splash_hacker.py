import tkinter as tk
import random
import time

class SplashHackerAlien:
    def __init__(self, duracao_segundos=4):
        self.root = tk.Tk()
        self.duracao = duracao_segundos
        
        # Configuração da Janela (Sem bordas / Fullscreen ou Centralizada)
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", True)
        
        largura = 700
        altura = 400
        largura_tela = self.root.winfo_screenwidth()
        altura_tela = self.root.winfo_screenheight()
        pos_x = (largura_tela // 2) - (largura // 2)
        pos_y = (altura_tela // 2) - (altura // 2)
        
        self.root.geometry(f"{largura}x{altura}+{pos_x}+{pos_y}")
        self.root.configure(bg="#030705")

        # Canvas para renderização gráfica pixelada
        self.canvas = tk.Canvas(self.root, bg="#030705", highlightthickness=0)
        self.canvas.pack(fill="both", expand=True)

        # Arte Pixelada (Matriz de Grade 16x16 - Ícone Alien/Sentinel)
        self.alien_pixels = [
            "....████████....",
            "..████████████..",
            ".████.████.████.",
            "████████████████",
            "████..████..████",
            "████████████████",
            "..██..████..██..",
            ".██....██....██.",
            "..██........██.."
        ]
        
        self.caracteres_hacker = ["0", "1", "A", "5", "1", "X", "Y", "#", "$", "%", "&", "*", "Ø", "Ξ", "Ψ"]
        self.colunas_chuva = [random.randint(0, 40) for _ in range(35)]
        
        self.desenhar_arte_pixel()
        self.root.after(100, self.animar_efeito_matrix)
        self.root.after(int(self.duracao * 1000), self.encerrar)

    def desenhar_arte_pixel(self):
        """Desenha a estrutura do ícone pixelado verde néon."""
        tamanho_pixel = 10
        offset_x = 270
        offset_y = 60

        for l_idx, linha in enumerate(self.alien_pixels):
            for c_idx, char in enumerate(linha):
                if char == "█":
                    x1 = offset_x + (c_idx * tamanho_pixel)
                    y1 = offset_y + (l_idx * tamanho_pixel)
                    x2 = x1 + tamanho_pixel
                    y2 = y1 + tamanho_pixel
                    self.canvas.create_rectangle(x1, y1, x2, y2, fill="#00ff66", outline="#06140c")

        # Textos estilizados de Inicialização
        self.canvas.create_text(
            350, 200, 
            text="AREA 51 // SENTINEL CORE", 
            fill="#00ff66", 
            font=("Courier", 16, "bold")
        )
        
        self.label_status = self.canvas.create_text(
            350, 230, 
            text="[ INICIALIZANDO PROTOCOLOS DE SEGURANÇA... ]", 
            fill="#00e1ff", 
            font=("Courier", 10)
        )

    def animar_efeito_matrix(self):
        """Anima códigos binários/alienígenas nas laterais da tela."""
        self.canvas.delete("chuva")
        
        for i in range(15):
            x = 20 + (i * 15)
            y = (self.colunas_chuva[i] * 12) % 360
            char = random.choice(self.caracteres_hacker)
            self.canvas.create_text(x, y, text=char, fill="#00ff66", font=("Courier", 9), tags="chuva")
            
            # Lado direito
            x_dir = 460 + (i * 15)
            y_dir = (self.colunas_chuva[i+15] * 12) % 360
            char_dir = random.choice(self.caracteres_hacker)
            self.canvas.create_text(x_dir, y_dir, text=char_dir, fill="#00ff66", font=("Courier", 9), tags="chuva")

            self.colunas_chuva[i] += 1
            self.colunas_chuva[i+15] += 1

        self.root.after(80, self.animar_efeito_matrix)

    def encerrar(self):
        self.root.destroy()

    def iniciar(self):
        self.root.mainloop()

if __name__ == "__main__":
    print("[JARVIS] Carregando Splash Screen Alienigena...")
    splash = SplashHackerAlien(duracao_segundos=4)
    splash.iniciar()
    print("[JARVIS] Sistema Liberado. Continuando inicializacao...")