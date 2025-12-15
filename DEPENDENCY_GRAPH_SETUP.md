# 📊 Dependency Graph Setup Guide

> **Complete dependency tracking for the NZC-LLM-Bill-Ingestor Salesforce project**

Based on [GitHub's supported package ecosystems](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/dependency-graph-supported-package-ecosystems#supported-package-ecosystems), this project now has comprehensive dependency graph support.

## 🎯 **Supported Ecosystems**

| **Ecosystem** | **Files** | **Dependencies Tracked** | **Auto-Updates** |
|---------------|-----------|-------------------------|------------------|
| **📦 npm** | `package.json`, `package-lock.json` | LWC dev tools, ESLint, Prettier, Jest | ✅ Dependabot |
| **🐍 pip** | `requirements.txt`, `pyproject.toml` | CumulusCI, Robot Framework, Selenium | ✅ Dependabot |  
| **⚡ GitHub Actions** | `.github/workflows/ci.yml` | CI/CD workflow actions | ✅ Dependabot |

---

## 📁 **New Files Added**

### **📦 Node.js/JavaScript Ecosystem**
```
├── package.json              # Main npm package configuration
├── package-lock.json         # Lock file for exact versions
├── .eslintrc.json            # ESLint configuration for LWC
├── .prettierrc               # Code formatting configuration
└── .nvmrc                    # Node.js version specification
```

**Key Dependencies:**
- `@salesforce/sfdx-lwc-jest` - Lightning Web Component testing
- `@salesforce/eslint-config-lwc` - LWC-specific linting rules
- `eslint`, `prettier` - Code quality and formatting
- `@salesforce-ux/design-system` - Salesforce Lightning Design System

### **🐍 Python Ecosystem**
```
├── requirements.txt          # pip dependencies for production
└── pyproject.toml           # Modern Python packaging (PEP 621)
```

**Key Dependencies:**
- `cumulusci>=3.79.0` - Salesforce CI/CD automation
- `robotframework>=6.0` - Test automation framework
- `selenium>=4.11.0` - Web browser automation
- `black`, `isort`, `flake8` - Code formatting and linting

### **⚡ GitHub Actions Ecosystem**
```
├── .github/
│   ├── workflows/ci.yml      # Main CI/CD workflow
│   └── dependabot.yml        # Automated dependency updates
```

**Workflow Features:**
- Multi-version Node.js testing (18.x, 20.x)
- Multi-version Python testing (3.9, 3.10, 3.11) 
- Security scanning with Trivy
- Salesforce metadata validation
- Dependency review for pull requests

---

## 🔧 **How GitHub Dependency Graph Works**

### **🔍 Static Analysis (Automatic)**
GitHub automatically scans these files and builds the dependency graph:

| **File Type** | **Transitive Dependencies** | **Security Alerts** |
|---------------|---------------------------|---------------------|
| `package-lock.json` | ✅ **Full tree** | ✅ **All levels** |
| `requirements.txt` | ⚠️ **Direct only** | ⚠️ **Direct only** |
| `.github/workflows/*.yml` | ✅ **Referenced actions** | ✅ **Action versions** |

### **📈 Enhanced with pyproject.toml**
The `pyproject.toml` provides additional Python dependency metadata:
- Development dependencies separation
- Python version requirements  
- Project metadata for better tracking

---

## 🤖 **Dependabot Configuration**

Dependabot is configured to automatically:

### **📦 npm Updates (Weekly)**
- Updates JavaScript dependencies every Monday at 9 AM UTC
- Maximum 10 open PRs for npm dependencies
- Assigns PRs to repository maintainers

### **🐍 pip Updates (Weekly)**
- Updates Python dependencies every Monday at 9 AM UTC  
- Maximum 5 open PRs for Python dependencies
- Includes both requirements.txt and pyproject.toml

### **⚡ GitHub Actions Updates (Weekly)**
- Updates action versions every Monday at 9 AM UTC
- Maximum 5 open PRs for workflow dependencies
- Keeps CI/CD pipeline secure and up-to-date

---

## 🚀 **Getting Started**

### **🔧 Local Development Setup**

1. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   # OR using the modern approach:
   pip install -e .
   ```

3. **Run quality checks:**
   ```bash
   npm run lint          # ESLint for JavaScript
   npm run test:unit     # LWC unit tests
   npm run prettier      # Format code
   ```

### **📊 Viewing Dependency Graph**

1. Go to your GitHub repository
2. Click the **"Insights"** tab
3. Select **"Dependency graph"** from the sidebar
4. View dependencies by ecosystem:
   - **npm dependencies** (JavaScript/LWC)
   - **pip dependencies** (Python/Robot Framework)  
   - **Actions dependencies** (CI/CD workflows)

### **🔔 Security Alerts**

GitHub will automatically:
- ✅ **Scan dependencies** for known vulnerabilities
- ✅ **Create security alerts** for vulnerable packages
- ✅ **Suggest Dependabot PRs** to fix vulnerabilities
- ✅ **Block vulnerable PRs** with dependency review action

---

## 📋 **Maintenance Tasks**

### **Weekly (Automated)**
- ✅ Dependabot creates PRs for outdated dependencies
- ✅ CI pipeline tests all dependency updates
- ✅ Security scans run on every PR

### **Monthly (Manual)**
- 📝 Review and merge Dependabot PRs
- 📝 Update major version dependencies manually
- 📝 Review dependency graph for unused packages

### **Quarterly (Manual)**  
- 📝 Audit Python dependencies with `pip-audit`
- 📝 Review npm dependencies with `npm audit`
- 📝 Update Node.js version in `.nvmrc`

---

## 🐛 **Troubleshooting**

### **Dependency Graph Not Showing?**
1. Ensure files are in the repository root
2. Check that `package-lock.json` is committed  
3. Verify GitHub Actions workflows are in `.github/workflows/`
4. Wait up to 24 hours for initial scanning

### **Dependabot Not Creating PRs?**
1. Check `.github/dependabot.yml` syntax
2. Verify repository has Issues and PRs enabled
3. Ensure maintainers have proper permissions
4. Check Dependabot logs in Insights > Dependency graph

### **Security Alerts Missing?**
1. Enable Dependabot security updates in repository settings
2. Ensure dependency graph is enabled  
3. Check that vulnerable dependencies are in lock files
4. Review GitHub Security & Analysis settings

---

## 🔗 **Additional Resources**

- **📚 [GitHub Dependency Graph Documentation](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/dependency-graph-supported-package-ecosystems)**
- **🤖 [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)**
- **🏷️ [Semantic Versioning Guide](https://semver.org/)**
- **🔒 [GitHub Security Advisories](https://docs.github.com/en/code-security/security-advisories)**

---

**✅ Your NZC-LLM-Bill-Ingestor project now has comprehensive dependency tracking enabled!**

The dependency graph will help you:
- 👀 **Visualize** your project's dependencies  
- 🔒 **Stay secure** with automated vulnerability alerts
- 📈 **Stay current** with automated dependency updates
- 📊 **Track** dependency changes over time











