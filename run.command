#!/bin/bash
cd "$(dirname "$0")"
echo "========================================================"
echo "Myca - P2P Distributed AI Inference (macOS Portable)"
echo "========================================================"
echo ""
echo "Setting up Python environment..."
python3 -m venv venv
source venv/bin/activate
echo "Installing dependencies..."
pip install -r requirements.txt >/dev/null 2>&1
echo "Starting Myca..."
python3 main.py
