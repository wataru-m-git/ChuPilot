#!/bin/bash

# Docker and Docker Compose Verification Script

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  Mouse Colony App - Docker Setup Verification            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check Docker installation
echo "📦 Checking Docker installation..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo "  ✓ Docker installed: $DOCKER_VERSION"
else
    echo "  ✗ Docker not found. Please install Docker Desktop."
    exit 1
fi

# Check Docker Compose
echo ""
echo "📦 Checking Docker Compose..."
if command -v docker-compose &> /dev/null; then
    DC_VERSION=$(docker-compose --version)
    echo "  ✓ Docker Compose installed: $DC_VERSION"
elif docker compose version &> /dev/null; then
    DC_VERSION=$(docker compose version)
    echo "  ✓ Docker Compose (V2) installed: $DC_VERSION"
else
    echo "  ✗ Docker Compose not found. Please install Docker Desktop."
    exit 1
fi

# Check Docker daemon
echo ""
echo "🔧 Checking Docker daemon..."
if docker ps &> /dev/null; then
    echo "  ✓ Docker daemon is running"
else
    echo "  ✗ Docker daemon is not running. Please start Docker."
    exit 1
fi

# Check required files
echo ""
echo "📋 Checking required files..."
REQUIRED_FILES=(
    "Dockerfile"
    "docker-compose.yml"
    ".dockerignore"
    "package.json"
    ".env.local"
    "README.md"
)

ALL_PRESENT=true
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ $file (missing)"
        ALL_PRESENT=false
    fi
done

# Check required directories
echo ""
echo "📁 Checking required directories..."
REQUIRED_DIRS=(
    "src"
    "prisma"
    "data"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "  ✓ $dir"
    else
        echo "  ✗ $dir (missing)"
        ALL_PRESENT=false
    fi
done

# Final result
echo ""
echo "═══════════════════════════════════════════════════════════"
if [ "$ALL_PRESENT" = true ]; then
    echo "✓ All checks passed!"
    echo ""
    echo "You can now run:"
    echo "  docker compose up"
    echo ""
    echo "Then access the app at:"
    echo "  http://localhost:3333"
else
    echo "✗ Some checks failed. Please verify the setup."
    exit 1
fi
echo "═══════════════════════════════════════════════════════════"
