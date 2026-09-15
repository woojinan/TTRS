FROM node:22-bookworm-slim AS node
FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends libstdc++6 && rm -rf /var/lib/apt/lists/*
COPY --from=node /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --uid 10001 --create-home ttrs && mkdir /data && chown ttrs:ttrs /data
COPY app ./app
COPY frontend ./frontend
COPY tests ./tests
USER ttrs
EXPOSE 1558
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:1558/health',timeout=2)"
CMD ["python","-m","uvicorn","app.main:app","--host","0.0.0.0","--port","1558","--ws-max-size","4096"]
