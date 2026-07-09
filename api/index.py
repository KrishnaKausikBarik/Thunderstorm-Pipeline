import sys
import os

# Add the 'backend' folder to the Python path so it can import its internal modules
backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.append(backend_dir)

# Import the FastAPI app from the backend directory
from main import app
