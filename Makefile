# Local dev only — Vercel/Render build and deploy on git push, see docs/deployment.md.
.DEFAULT_GOAL := help

.PHONY: help setup dev dev-shopping-agent dev-merchant-agent db-up db-down migrate \
	seed-merchant test lint

help: ## Show this list
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

setup: ## One-time: install deps, start Postgres, migrate, create agent venvs — fill in .env after
	npm install
	[ -f .env ] || cp .env.example .env
	docker compose up -d postgres
	npx prisma migrate dev
	for agent in shopping-agent merchant-agent; do \
		[ -f $$agent/.env ] || cp $$agent/.env.example $$agent/.env; \
		[ -d $$agent/.venv ] || python3 -m venv $$agent/.venv; \
		$$agent/.venv/bin/pip install -q -r $$agent/requirements-dev.txt; \
	done
	@echo "Now fill in .env, shopping-agent/.env and merchant-agent/.env (Shopify + Anthropic credentials), then: make dev"

dev: ## Run the Next.js storefront (theme generator + next dev)
	npm run dev

dev-shopping-agent: ## Run the shopping agent sidecar (Docker + Redis)
	cd shopping-agent && docker compose up --build

dev-merchant-agent: ## Run the merchant agent sidecar (Docker + Redis)
	cd merchant-agent && docker compose up --build

db-up: ## Start the merchant-portal Postgres (Docker)
	docker compose up -d postgres

db-down: ## Stop the merchant-portal Postgres
	docker compose down

migrate: ## Apply Prisma migrations to the local Postgres
	npx prisma migrate dev

seed-merchant: ## Create a merchant login account: make seed-merchant EMAIL=... PASSWORD=... NAME="..."
	node scripts/create-merchant-account.mjs "$(EMAIL)" "$(PASSWORD)" "$(NAME)"

test: ## Run each agent's pytest suite (the Next.js app has no test runner)
	cd shopping-agent && .venv/bin/python -m pytest -q
	cd merchant-agent && .venv/bin/python -m pytest -q

lint: ## eslint on the Next.js app + ruff on both agents
	npm run lint
	cd shopping-agent && .venv/bin/python -m ruff check .
	cd merchant-agent && .venv/bin/python -m ruff check .
