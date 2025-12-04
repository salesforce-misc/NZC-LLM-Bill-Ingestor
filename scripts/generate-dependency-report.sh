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
    echo "  - Dev dependencies: $(grep -c 'devDependencies' package.json || echo 0)"
    echo "  - Production dependencies: $(grep -c 'dependencies' package.json || echo 0)"
else
    echo "❌ package.json not found"
fi

echo ""
echo "📋 SALESFORCE METADATA DEPENDENCIES"
echo "----------------------------------------"
if [ -f "package.xml" ]; then
    echo "Metadata types defined in package.xml:"
    grep -o '<types>.*</types>' package.xml | wc -l | xargs echo "  - Types:"
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

