#!/bin/bash
# Setup script for Brevo Dashboard
# Run once from the project directory: bash setup.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Setting up in: $PROJECT_DIR"

# Check Python 3
if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 not found. Install it via https://www.python.org or 'brew install python'"
  exit 1
fi

PYTHON_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "Python version: $PYTHON_VER"

# Create virtual environment
VENV="$PROJECT_DIR/.venv"
if [ ! -d "$VENV" ]; then
  echo "Creating virtual environment..."
  python3 -m venv "$VENV"
else
  echo "Virtual environment already exists."
fi

# Activate and install
source "$VENV/bin/activate"
pip install --upgrade pip --quiet

echo "Installing dependencies..."
pip install \
  "pandas>=2.0" \
  "openpyxl>=3.1" \
  "dash>=2.16" \
  "dash-bootstrap-components>=1.6" \
  "dash-ag-grid>=2.4" \
  "plotly>=5.0"

echo ""
echo "✅ Setup complete!"
echo ""
echo "To run the dashboard:"
echo "  1. Make sure input.xlsx is in the same folder as main.py"
echo "  2. Run:  bash run.sh"
echo "     or manually:"
echo "     source .venv/bin/activate && python main.py"