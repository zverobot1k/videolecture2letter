# 📦 Инструкция по развёртыванию проекта (Admin / DevOps)

## 1. Предварительные условия

На сервере/локальной машине должны быть установлены:

- Python 3.14+
- Node.js 22.12+
- Docker 29.2.1+
- Docker Compose (plugin v2)
- Git

Проверка установок:

```bash
git --version
docker --version
docker compose version
python3 --version
node --version
```

Docker должен быть запущен:

```bash
docker info
```

---

## 2. Получение проекта

⚠️ Предполагается, что доступ к репозиторию уже есть (SSH или HTTPS).

Клонирование репозитория:

```bash
git clone <URL_РЕПОЗИТОРИЯ>
cd <ИМЯ_ПАПКИ>
```

При необходимости переключиться на нужную ветку:

```bash
git checkout main
```

---

## 3. Переменные окружения

Если используется файл `.env`, создайте его:

```bash
cp .env.example .env
```

Далее заполните необходимые значения в `.env`.

---

## 4. Архитектура сервисов

Проект разворачивается через Docker Compose и включает следующие сервисы:

| Сервис   | Порт  | Назначение |
|----------|------|-----------|
| Frontend | 5173 | Пользовательский интерфейс |
| Backend  | 8000 | API сервер |
| Redis    | 6379 | Кэш / брокер |
| Ollama   | 11434 | LLM сервис |

---

## 5. Запуск проекта

В корневой директории проекта выполните:

```bash
docker compose up --build
```

Для запуска в фоновом режиме:

```bash
docker compose up --build -d
```

---

## 6. Проверка состояния

Проверка запущенных контейнеров:

```bash
docker compose ps
```

Просмотр логов:

```bash
docker compose logs -f
```

Логи конкретного сервиса:

```bash
docker compose logs -f <service_name>
```

---

## 7. Проверка доступности сервисов

После успешного запуска:

- Frontend:  
  http://localhost:5173

- Backend API:  
  http://localhost:8000

- Ollama:  
  http://localhost:11434

Redis работает внутри Docker-сети и обычно не доступен напрямую извне.

---

## 8. Частые проблемы

### ❗ Docker не запущен

```bash
sudo systemctl start docker
```

---

### ❗ Порт занят

Проверка занятых портов:

```bash
lsof -i :5173
lsof -i :8000
lsof -i :6379
lsof -i :11434
```

Решение:
- остановить конфликтующий процесс
- либо изменить порты в `docker-compose.yml`

---

### ❗ Ошибка доступа к репозиторию

Проверить:
- SSH ключи
- Personal Access Token (если используется HTTPS)
- права доступа к репозиторию

---

### ❗ Контейнер не запускается

Проверить логи:

```bash
docker compose logs <service_name>
```

---

## 9. Остановка проекта

```bash
docker compose down
```

Удаление volumes (полная очистка состояния):

```bash
docker compose down -v
```

---

## 10. Обновление проекта

```bash
git pull
docker compose up --build
```

---

## ⚠️ Примечания

- Убедитесь, что порты не конфликтуют с другими сервисами
- Backend работает на порту **8000**
- Redis использует порт **6379** внутри Docker-сети
- Ollama может требовать значительных ресурсов (CPU/RAM/GPU)

