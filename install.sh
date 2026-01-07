#!/bin/bash

# Wogi Flow - Remote Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/Wogi-Git/wogi-flow/main/install.sh | bash

set -e

REPO_URL="https://github.com/Wogi-Git/wogi-flow"
INSTALL_DIR="${WOGI_INSTALL_DIR:-.}"
BRANCH="${WOGI_BRANCH:-main}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║               🚀 Wogi Flow Installer 🚀                       ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if already installed
if [ -f "$INSTALL_DIR/.wogi-version" ]; then
    echo -e "${YELLOW}⚠ Wogi Flow is already installed in this directory.${NC}"
    echo ""
    read -p "Do you want to update instead? (y/n): " update_choice
    if [[ "$update_choice" =~ ^[Yy]$ ]]; then
        echo "Running update..."
        "$INSTALL_DIR/scripts/flow" update
        exit 0
    fi
    
    read -p "Reinstall from scratch? This will NOT delete project data. (y/n): " reinstall
    if [[ ! "$reinstall" =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
fi

# Create temp directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo -e "${CYAN}Downloading Wogi Flow...${NC}"

# Download
if curl -sL "${REPO_URL}/archive/refs/heads/${BRANCH}.tar.gz" -o "$TEMP_DIR/wogi-flow.tar.gz"; then
    echo -e "${GREEN}✓${NC} Downloaded"
else
    echo -e "${RED}✗ Failed to download. Check your internet connection.${NC}"
    exit 1
fi

# Extract
tar -xzf "$TEMP_DIR/wogi-flow.tar.gz" -C "$TEMP_DIR"
EXTRACTED_DIR=$(find "$TEMP_DIR" -maxdepth 1 -type d -name "wogi-flow*" | head -1)

if [ -z "$EXTRACTED_DIR" ]; then
    echo -e "${RED}✗ Failed to extract${NC}"
    exit 1
fi

echo -e "${CYAN}Installing...${NC}"

# Copy framework files (don't overwrite project data)
FRAMEWORK_FILES=(
    "CLAUDE.md"
    "README.md"
    "scripts"
    "agents"
    "templates"
    ".claude/commands"
    "skills"
    ".wogi-version"
)

for path in "${FRAMEWORK_FILES[@]}"; do
    src="$EXTRACTED_DIR/$path"
    dest="$INSTALL_DIR/$path"
    
    if [ -e "$src" ]; then
        mkdir -p "$(dirname "$dest")"
        cp -r "$src" "$dest"
        echo -e "${GREEN}✓${NC} Installed: $path"
    fi
done

# Create workflow directories if they don't exist
mkdir -p "$INSTALL_DIR/.workflow/state/components"
mkdir -p "$INSTALL_DIR/.workflow/changes"
mkdir -p "$INSTALL_DIR/.workflow/bugs"
mkdir -p "$INSTALL_DIR/.workflow/corrections"
mkdir -p "$INSTALL_DIR/.workflow/archive"
mkdir -p "$INSTALL_DIR/.workflow/tests/flows"
mkdir -p "$INSTALL_DIR/.workflow/specs/capabilities"
mkdir -p "$INSTALL_DIR/.claude/rules"
mkdir -p "$INSTALL_DIR/skills"

# Copy default state files only if they don't exist
DEFAULT_STATE_FILES=(
    ".workflow/config.json"
    ".workflow/state/ready.json"
    ".workflow/state/request-log.md"
    ".workflow/state/app-map.md"
    ".workflow/state/decisions.md"
    ".workflow/state/progress.md"
    ".workflow/state/feedback-patterns.md"
)

for path in "${DEFAULT_STATE_FILES[@]}"; do
    src="$EXTRACTED_DIR/$path"
    dest="$INSTALL_DIR/$path"
    
    if [ ! -f "$dest" ] && [ -f "$src" ]; then
        cp "$src" "$dest"
        echo -e "${GREEN}✓${NC} Created: $path"
    fi
done

# Make scripts executable
chmod +x "$INSTALL_DIR/scripts/"*

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ✅ Wogi Flow installed successfully!                ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo ""
echo "  1. Run the interactive setup:"
echo -e "     ${CYAN}./scripts/flow install${NC}"
echo ""
echo "  2. Or start using immediately:"
echo -e "     ${CYAN}./scripts/flow health${NC}"
echo ""
echo -e "${BOLD}To update later:${NC}"
echo -e "     ${CYAN}./scripts/flow update${NC}"
echo ""
echo -e "${YELLOW}Tip:${NC} Add scripts to your PATH or create an alias:"
echo "     alias flow='./scripts/flow'"
echo ""
