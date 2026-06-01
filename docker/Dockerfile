# syntax=docker/dockerfile:1.7

# ============================================================
# TM Web unified image
# Build context: project root (tianming-novel-ai-writer/)
# Runtime uses the Playwright .NET image so Chromium and required libraries are available.
# ============================================================

# ---------- Stage 1: build frontend ----------
FROM node:20-alpine AS frontend-build
WORKDIR /src

COPY web/frontend/package.json web/frontend/package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then \
        npm ci --no-fund --no-audit --no-progress; \
    else \
        npm install --no-fund --no-audit --no-progress; \
    fi

COPY web/frontend/. .
RUN npm run build

# ---------- Stage 2: build backend ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend-build
WORKDIR /src

# Copy project files for restore
COPY web/backend/TM.Web.sln web/backend/Directory.Build.props ./web/backend/
COPY web/backend/src/TM.Web.Api/TM.Web.Api.csproj web/backend/src/TM.Web.Api/
COPY web/backend/src/TM.Web.Application/TM.Web.Application.csproj web/backend/src/TM.Web.Application/
COPY web/backend/src/TM.Web.Domain/TM.Web.Domain.csproj web/backend/src/TM.Web.Domain/
COPY web/backend/src/TM.Web.Infrastructure/TM.Web.Infrastructure.csproj web/backend/src/TM.Web.Infrastructure/
COPY web/backend/src/TM.Web.LegacyBridge/TM.Web.LegacyBridge.csproj web/backend/src/TM.Web.LegacyBridge/
COPY web/backend/tests/TM.Web.Tests/TM.Web.Tests.csproj web/backend/tests/TM.Web.Tests/
RUN dotnet restore web/backend/src/TM.Web.Api/TM.Web.Api.csproj

# Copy full source (including Framework/ and Services/ for LegacyBridge)
COPY Framework/ Framework/
COPY Services/ Services/
COPY web/backend/ web/backend/

RUN dotnet publish web/backend/src/TM.Web.Api/TM.Web.Api.csproj \
    -c Release \
    -o /publish \
    --no-restore \
    /p:UseAppHost=false

# ---------- Stage 3: runtime ----------
FROM mcr.microsoft.com/playwright/dotnet:v1.49.0-noble AS runtime
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl tzdata \
    && rm -rf /var/lib/apt/lists/*

COPY --from=backend-build /publish .
COPY --from=frontend-build /src/dist ./wwwroot

VOLUME ["/app/Storage"]

ENV ASPNETCORE_URLS=http://0.0.0.0:38721 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_USE_POLLING_FILE_WATCHER=true

EXPOSE 38721

ENTRYPOINT ["dotnet", "TM.Web.Api.dll"]
