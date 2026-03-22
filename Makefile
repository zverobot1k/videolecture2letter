.PHONY: up rebuild down logs ps pull-model backend-logs worker-logs ollama-logs frontend-logs

up:
	docker compose up -d --build

rebuild:
	docker compose build --no-cache
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f frontend backend worker redis ollama

ps:
	docker compose ps

pull-model:
	docker compose exec ollama ollama pull gemma3

backend-logs:
	docker compose logs -f backend

worker-logs:
	docker compose logs -f worker

ollama-logs:
	docker compose logs -f ollama

frontend-logs:
	docker compose logs -f frontend
