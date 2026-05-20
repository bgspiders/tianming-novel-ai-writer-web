# syntax=docker/dockerfile:1.7

# ============================================================
# TM Web unified image
# Runtime uses the Playwright .NET image so Chromium and required libraries are available.
# ============================================================

# ---------- Stage 1: build frontend ----------
FROM node:20-alpine AS frontend-build
WORKDIR /src

COPY frontend/package.json frontend/package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then \
        npm ci --no-fund --no-audit --no-progress; \
    else \
        npm install --no-fund --no-audit --no-progress; \
    fi

COPY frontend/. .
RUN npm run build

# ---------- Stage 2: build backend ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend-build
WORKDIR /src

COPY backend/TM.Web.sln backend/Directory.Build.props ./
COPY backend/src/TM.Web.Api/TM.Web.Api.csproj src/TM.Web.Api/
COPY backend/src/TM.Web.Application/TM.Web.Application.csproj src/TM.Web.Application/
COPY backend/src/TM.Web.Domain/TM.Web.Domain.csproj src/TM.Web.Domain/
COPY backend/src/TM.Web.Infrastructure/TM.Web.Infrastructure.csproj src/TM.Web.Infrastructure/
COPY backend/src/TM.Web.LegacyBridge/TM.Web.LegacyBridge.csproj src/TM.Web.LegacyBridge/
COPY backend/tests/TM.Web.Tests/TM.Web.Tests.csproj tests/TM.Web.Tests/
RUN dotnet restore src/TM.Web.Api/TM.Web.Api.csproj

COPY backend/ .
RUN dotnet publish src/TM.Web.Api/TM.Web.Api.csproj \
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
