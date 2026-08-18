# Multi-stage Dockerfile for Score Management Platform
# =====================================================
# Stage 1: Build frontend
# Stage 2: Build backend with production dependencies
# Stage 3: Run application

# Stage 1: Frontend build
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./

RUN npm ci --only=production

COPY frontend/ ./

RUN npm run build

# Stage 2: Backend dependencies
FROM python:3.11-slim AS backend-builder

WORKDIR /app/backend

COPY backend/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Stage 3: Production runtime
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

# Copy backend dependencies
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin

# Copy backend source
COPY backend/ ./backend/

# Copy frontend build
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Create non-root user for security
RUN useradd -m appuser
RUN chown -R appuser:appuser /app

USER appuser

# Environment variables
ENV FLASK_ENV=production
ENV FLASK_DEBUG=false
ENV PORT=5000
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Run application
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers=4", "--threads=2", "--timeout=120", "backend.wsgi:application"]
