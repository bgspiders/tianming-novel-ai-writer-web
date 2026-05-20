# syntax=docker/dockerfile:1.7

# ============================================================
# 天命 Web Dockerfile
# 单镜像同时承载 ASP.NET Core 后端 + Vue 前端静态文件。
#
# 阶段 8 接入 Playwright 爬虫后，把最终运行阶段的基础镜像换为
# mcr.microsoft.com/playwright/dotnet:v1.49.0-noble 即可（含 Chromium + glibc）。
# ============================================================

# ---------- Stage 1: 构建前端 ----------
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

# ---------- Stage 2: 构建后端 ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend-build
WORKDIR /src

# 先只复制 csproj/sln/Directory.Build.props 触发 dotnet restore 缓存层
COPY backend/TM.Web.sln backend/Directory.Build.props ./
COPY backend/src/TM.Web.Api/TM.Web.Api.csproj                     src/TM.Web.Api/
COPY backend/src/TM.Web.Application/TM.Web.Application.csproj     src/TM.Web.Application/
COPY backend/src/TM.Web.Domain/TM.Web.Domain.csproj               src/TM.Web.Domain/
COPY backend/src/TM.Web.Infrastructure/TM.Web.Infrastructure.csproj src/TM.Web.Infrastructure/
COPY backend/src/TM.Web.LegacyBridge/TM.Web.LegacyBridge.csproj   src/TM.Web.LegacyBridge/
COPY backend/tests/TM.Web.Tests/TM.Web.Tests.csproj               tests/TM.Web.Tests/
RUN dotnet restore src/TM.Web.Api/TM.Web.Api.csproj

# 再复制其余源码
COPY backend/ .
RUN dotnet publish src/TM.Web.Api/TM.Web.Api.csproj \
    -c Release \
    -o /publish \
    --no-restore \
    /p:UseAppHost=false

# ---------- Stage 3: 运行时 ----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl tzdata \
    && rm -rf /var/lib/apt/lists/*

# 复制后端产物
COPY --from=backend-build /publish .

# 复制前端 dist 到 wwwroot
COPY --from=frontend-build /src/dist ./wwwroot

# 数据卷：Storage 目录持久化所有用户数据
VOLUME ["/app/Storage"]

ENV ASPNETCORE_URLS=http://0.0.0.0:38721 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_USE_POLLING_FILE_WATCHER=true

EXPOSE 38721

ENTRYPOINT ["dotnet", "TM.Web.Api.dll"]
