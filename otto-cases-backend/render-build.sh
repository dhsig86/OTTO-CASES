#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "Atualizando pacotes e instalando Pandoc..."
apt-get update
apt-get install -y pandoc

echo "Instalando dependências Python..."
pip install -r requirements.txt
