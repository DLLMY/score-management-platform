import os
import sys
import logging

"""
WSGI Entry Point for Production Deployment ==========================================
==========================================
It uses Waitress (Windows-friendly) or can be used with Gunicorn (Linux/Docker).

Usage:
    # Development (still using Flask dev server)
    python app.py

    # Production with Waitress
    pip install waitress
    waitress-serve --host=0.0.0.0 --port=5000 wsgi:application

    # Production with Gunicorn (Linux/Docker)
    pip install gunicorn
    gunicorn --bind 0.0.0.0:5000 --workers=4 --threads=2 wsgi:application

Environment Variables:
    FLASK_ENV=production      # Set to production
    FLASK_DEBUG=false         # Disable debug mode
    PORT=5000                 # Port to listen on
"""

# Ensure the backend directory is in the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Configure logging for production
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s", handlers=[logging.StreamHandler()]
)

logger = logging.getLogger(__name__)

# Set production environment variables before importing the app
os.environ.setdefault("FLASK_ENV", "production")
os.environ.setdefault("FLASK_DEBUG", "false")

try:
    from app import create_app

    application = create_app()

    logger.info("Flask application loaded successfully")
    logger.info(f"Environment: {application.config.get('FLASK_ENV', 'unknown')}")
    logger.info(f"Debug mode: {application.config.get('FLASK_DEBUG', 'false')}")

except Exception as e:
    logger.error(f"Failed to load Flask application: {str(e)}", exc_info=True)
    raise

if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", "5000"))
    host = os.getenv("FLASK_HOST", "127.0.0.1")

    logger.info(f"Starting production server on {host}:{port}")

    try:
        from waitress import serve

        serve(application, host=host, port=port, threads=4)
    except ImportError:
        logger.warning("Waitress not installed, falling back to Flask dev server")
        application.run(host=host, port=port, debug=False)
