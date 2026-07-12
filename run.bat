@echo off
echo ========================================================
echo Myca - P2P Distributed AI Inference (Windows Portable)
echo ========================================================
echo.
echo Setting up Python environment...
python -m venv venv
call venv\Scripts\activate.bat
echo Installing dependencies...
pip install -r requirements.txt >nul 2>&1
echo Starting Myca...
python main.py
pause
