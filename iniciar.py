#!/usr/bin/env python3
"""Servidor local de Project Arena. No requiere instalar dependencias."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from functools import partial
import threading
import webbrowser

root = Path(__file__).resolve().parent
handler = partial(SimpleHTTPRequestHandler, directory=str(root))
server = None
for port in range(8080, 8091):
    try:
        server = ThreadingHTTPServer(('127.0.0.1', port), handler)
        break
    except OSError:
        pass
if server is None:
    raise SystemExit('No hay un puerto local disponible entre 8080 y 8090.')
url = f'http://127.0.0.1:{server.server_port}/index.html'
print(f'Project Arena: {url}\nVisor: http://127.0.0.1:{server.server_port}/animation-lab.html\nDeja esta ventana abierta. Ctrl+C para cerrar.', flush=True)
threading.Timer(0.6, lambda: webbrowser.open(url)).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
