FROM python:3.11-slim

WORKDIR /app/apps/ai-core

COPY apps/ai-core/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/ai-core .
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
