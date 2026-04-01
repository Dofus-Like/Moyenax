# Dofus-Like Project Makefile
# ---------------------------

.PHONY: help setup dev dev-api dev-web build lint test db-migrate db-seed db-studio docker-up docker-down clean-ports clean-agent kill-all

help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Development:"
	@echo "  setup         Install dependencies, start docker, and setup DB"
	@echo "  dev           Start API and Web in parallel"
	@echo "  dev-api       Start only the API"
	@echo "  dev-web       Start only the Web frontend"
	@echo ""
	@echo "Building & Quality:"
	@echo "  build         Build all projects"
	@echo "  lint          Run linting on all projects"
	@echo "  test          Run tests for all projects"
	@echo ""
	@echo "Database (Prisma):"
	@echo "  db-migrate    Run database migrations"
	@echo "  db-seed       Seed the database with initial data"
	@echo "  db-studio     Open Prisma Studio"
	@echo ""
	@echo "Docker:"
	@echo "  docker-up     Start infrastructure (Postgres, Redis)"
	@echo "  docker-down   Stop infrastructure"
	@echo ""
	@echo "Cleanup:"
	@echo "  clean-ports   Kill processes running on ports 3000, 3001, 5173"
	@echo "  clean-agent   Kill node processes (Vite, Nest, Nx)"
	@echo "  kill-all      Run both clean-ports and clean-agent"

# --- Commands ---

setup:
	npm run setup

dev:
	npm run dev

dev-api:
	npm run dev:api

dev-web:
	npm run dev:web

build:
	npm run build

lint:
	npm run lint

test:
	npm run test

db-migrate:
	npm run db:migrate

db-seed:
	npm run db:seed

db-studio:
	npm run db:studio

docker-up:
	npm run docker:dev

docker-down:
	docker-compose down

# Cleanup commands for Windows (PowerShell)
# Note: These use powershell directly to ensure they work on the user's OS.

clean-ports:
	@echo "Cleaning ports 3000, 3001, 5173..."
	@powershell -Command "3000, 3001, 5173 | ForEach-Object { \
		$$proc = Get-NetTCPConnection -LocalPort $$_ -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; \
		if ($$proc) { \
			Write-Host \"Killing process on port $$_ (PID: $$proc)\"; \
			Stop-Process -Id $$proc -Force -ErrorAction SilentlyContinue; \
		} \
	}"

clean-agent:
	@echo "Cleaning node/vite/nx processes..."
	@powershell -Command "Get-Process | Where-Object { $$_.Name -match 'node|vite|nx' } | ForEach-Object { \
		try { \
			Stop-Process -Id $$_.Id -Force -ErrorAction SilentlyContinue; \
		} catch {} \
	}"

kill-all: clean-ports clean-agent
	@echo "All project processes cleaned."
