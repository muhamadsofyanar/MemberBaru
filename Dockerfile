FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir gunicorn==23.0.0
COPY app.py /app/app.py
RUN useradd -u 10001 -m app && mkdir /data && chown app:app /data
USER app
ENV DATA_DIR=/data
EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "1", "--threads", "4", "--timeout", "120", "app:application"]
