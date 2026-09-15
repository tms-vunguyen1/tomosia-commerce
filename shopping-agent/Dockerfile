FROM python:3.13-slim

# git is needed to resolve the three reference packages pinned by ref in requirements.txt.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY shopping_assistant ./shopping_assistant

# Memory is a JSON file on a volume, so the service runs one worker; a second would race
# it. Moving memory to Redis is what unblocks more (see ../CLAUDE.md).
#
# --timeout-keep-alive: Next.js's fetch pools and reuses HTTP connections; uvicorn's
# 5s default closes an idle one well within a real gap between chat turns, so the next
# reused connection hits a socket the server already dropped.
CMD ["uvicorn", "shopping_assistant.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--timeout-keep-alive", "75"]
