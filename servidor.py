"""
servidor.py
===========
Servidor local para o Portal de Leilões.
- Serve arquivos estáticos (igual ao python -m http.server)
- POST /atualizar → roda atualizar.py e recarrega os dados
- GET  /status    → retorna progresso da atualização em andamento

Uso:  python servidor.py
      (substitui: python -m http.server 8765)
"""

import http.server
import socketserver
import subprocess
import sys
import os
import json
import threading
from urllib.parse import urlparse

PORTA = 8765
PASTA = os.path.dirname(os.path.abspath(__file__))

# Estado da atualização em andamento
_update_lock = threading.Lock()
_update_status = {"rodando": False, "log": [], "erro": None}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PASTA, **kwargs)

    def log_message(self, format, *args):
        pass  # suprime logs do servidor no terminal

    def do_POST(self):
        if urlparse(self.path).path == "/atualizar":
            self._handle_atualizar()
        else:
            self.send_error(404)

    def do_GET(self):
        if urlparse(self.path).path == "/status":
            self._handle_status()
        else:
            super().do_GET()

    def _handle_atualizar(self):
        with _update_lock:
            if _update_status["rodando"]:
                self._json({"ok": False, "msg": "Atualização já em andamento."})
                return
            _update_status["rodando"] = True
            _update_status["log"] = []
            _update_status["erro"] = None

        def rodar():
            script = os.path.join(PASTA, "atualizar.py")
            try:
                proc = subprocess.Popen(
                    [sys.executable, script],
                    cwd=PASTA,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                )
                for linha in proc.stdout:
                    with _update_lock:
                        _update_status["log"].append(linha.rstrip())
                proc.wait()
                with _update_lock:
                    _update_status["rodando"] = False
                    if proc.returncode != 0:
                        _update_status["erro"] = f"Exit code {proc.returncode}"
            except Exception as e:
                with _update_lock:
                    _update_status["rodando"] = False
                    _update_status["erro"] = str(e)

        threading.Thread(target=rodar, daemon=True).start()
        self._json({"ok": True, "msg": "Atualização iniciada."})

    def _handle_status(self):
        with _update_lock:
            self._json(dict(_update_status))

    def _json(self, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    with socketserver.TCPServer(("", PORTA), Handler) as httpd:
        httpd.allow_reuse_address = True
        print(f"Portal de Leilões rodando em http://localhost:{PORTA}")
        print("Pressione Ctrl+C para parar.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor parado.")
