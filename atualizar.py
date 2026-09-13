"""
atualizar.py
============
Script mestre: roda scraper_caixa e scraper_mega em sequencia
e salva tudo no data.js do portal.

Como usar:
  python atualizar.py

Este e o unico script que voce precisa rodar manualmente
(ou que roda automaticamente todo dia as 8h).
"""

import subprocess
import sys
import os
from datetime import datetime

PASTA = os.path.dirname(os.path.abspath(__file__))

def rodar(script: str) -> bool:
    """Roda um script Python e retorna True se teve sucesso."""
    caminho = os.path.join(PASTA, script)
    print(f"\n{'='*60}")
    print(f"  Rodando: {script}")
    print(f"{'='*60}")
    result = subprocess.run([sys.executable, caminho], cwd=PASTA)
    return result.returncode == 0

def main():
    inicio = datetime.now()
    print(f"Portal de Leiloes SP - Atualizacao completa")
    print(f"Iniciado em: {inicio.strftime('%d/%m/%Y %H:%M')}")

    ok_caixa  = rodar("scraper_caixa.py")
    ok_mega   = rodar("scraper_mega.py")
    ok_frazao = rodar("scraper_frazao.py")
    ok_zuk    = rodar("scraper_zuk.py")
    ok_sodre    = rodar("scraper_sodre.py")
    ok_eleiloes = rodar("scraper_eleiloes.py")
    ok_plataforma = rodar("scraper_plataforma_propria.py")  # Vegas + De Santi
    ok_lj         = rodar("scraper_leiloesjudiciais.py")

    fim = datetime.now()
    duracao = round((fim - inicio).total_seconds())

    print(f"\n{'='*60}")
    print(f"  Resumo final")
    print(f"{'='*60}")
    print(f"  Caixa:         {'OK' if ok_caixa    else 'ERRO'}")
    print(f"  Mega Leiloes:  {'OK' if ok_mega     else 'ERRO'}")
    print(f"  Frazao:        {'OK' if ok_frazao   else 'ERRO'}")
    print(f"  Zuk:           {'OK' if ok_zuk      else 'ERRO'}")
    print(f"  Sodre Santoro: {'OK' if ok_sodre    else 'ERRO'}")
    print(f"  E-Leiloes:     {'OK' if ok_eleiloes else 'ERRO'}")
    print(f"  Vegas+DeSanti: {'OK' if ok_plataforma else 'ERRO'}")
    print(f"  LeiloesJud.:   {'OK' if ok_lj        else 'ERRO'}")
    print(f"  Duracao:      {duracao}s")
    print(f"  Concluido:    {fim.strftime('%H:%M')}")
    print(f"{'='*60}")
    # Grava timestamp da última atualização
    meta_js = os.path.join(PASTA, "meta.js")
    with open(meta_js, "w", encoding="utf-8") as f:
        f.write(f'const DATA_UPDATED = "{fim.isoformat()}";\n')

    print()
    print(">>> Abra (ou recarregue) o index.html no navegador.")

if __name__ == "__main__":
    main()
