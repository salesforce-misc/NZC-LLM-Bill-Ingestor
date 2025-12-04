#!/bin/bash

# Dependency Report Generator for NZC-LLM-Bill-Ingestor
# Generates comprehensive dependency reports for npm and Salesforce metadata

echo "========================================="
echo "  NZC-LLM-Bill-Ingestor Dependency Report"
echo "========================================="
echo ""
echo "Generated: $(date)"
echo ""

# Change to project root
cd "$(dirname "$0")/.." || exit

echo "📦 NPM DEPENDENCIES"
echo "----------------------------------------"
if [ -f "package.json" ]; then
    echo ""
    echo "Direct Dependencies:"
    npm list --depth=0 2>/dev/null || echo "Run 'npm install' first to see dependency tree"
    echo ""
    echo "Outdated Packages:"
    npm outdated 2>/dev/null || echo "No outdated packages or run 'npm install' first"
    echo ""
    echo "Package Summary:"
    echo "  - Total packages in package.json: $(grep -c '\"' package.json || echo 0)"
    # Bug 1 Fix: Count dependencies correctly - only match "dependencies" not "devDependencies"
    # Use node to parse JSON and count accurately
    if command -v node >/dev/null 2>&1; then
        dev_deps_count=$(node -e "const pkg = require('./package.json'); console.log(Object.keys(pkg.devDependencies || {}).length);" 2>/dev/null || echo 0)
        prod_deps_count=$(node -e "const pkg = require('./package.json'); console.log(Object.keys(pkg.dependencies || {}).length);" 2>/dev/null || echo 0)
    else
        # Fallback: Use sed to extract sections and count lines with package entries
        # Extract devDependencies section (from "devDependencies" to closing brace)
        dev_deps_count=$(sed -n '/"devDependencies"/,/^[[:space:]]*}/p' package.json | grep -c '^[[:space:]]*"[^"]*":' || echo 0)
        # Extract dependencies section (from "dependencies" to closing brace, but not "devDependencies")
        # Use pattern that matches line starting with "dependencies" key
        prod_deps_count=$(sed -n '/^[[:space:]]*"dependencies"[[:space:]]*:/,/^[[:space:]]*}/p' package.json | grep -c '^[[:space:]]*"[^"]*":' || echo 0)
    fi
    echo "  - Dev dependencies: ${dev_deps_count}"
    echo "  - Production dependencies: ${prod_deps_count}"
else
    echo "❌ package.json not found"
fi

echo ""
echo "📋 SALESFORCE METADATA DEPENDENCIES"
echo "----------------------------------------"
if [ -f "package.xml" ]; then
    # Bug 2 Fix: Count <types> opening tags instead of trying to match multiline blocks
    # The original pattern '<types>.*</types>' fails because XML spans multiple lines
    # This correctly counts the number of <types> elements regardless of formatting
    types_count=$(grep -c '<types>' package.xml || echo 0)
    echo "Metadata types defined in package.xml:"
    echo "  - Types: ${types_count}"
    echo ""
    echo "Apex Classes:"
    find force-app -name "*.cls" -type f 2>/dev/null | wc -l | xargs echo "  - Total:"
    echo ""
    echo "Lightning Web Components:"
    find force-app -path "*/lwc/*" -type d 2>/dev/null | wc -l | xargs echo "  - Total:"
    echo ""
    echo "Flows:"
    find force-app -name "*.flow-meta.xml" -type f 2>/dev/null | wc -l | xargs echo "  - Total:"
else
    echo "❌ package.xml not found"
fi

echo ""
echo "📊 DEPENDENCY SUMMARY"
echo "----------------------------------------"
echo "Project Type: Salesforce DX (SFDX)"
echo "Node.js Version: $(cat .nvmrc 2>/dev/null || echo 'Not specified')"
echo "License: $(grep -o '"license": "[^"]*"' package.json 2>/dev/null | cut -d'"' -f4 || echo 'Not specified')"
echo ""

echo "✅ Report complete!"
echo ""
echo "💡 Additional Commands:"
echo "  - npm audit          # Security vulnerabilities"
echo "  - npm list --all     # Full dependency tree"
echo "  - npm outdated       # Check for updates"
echo "  - View GitHub Dependency Graph: https://github.com/salesforce-misc/NZC-LLM-Bill-Ingestor/network/dependencies"
