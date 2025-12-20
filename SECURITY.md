# Security Policy

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly by contacting the maintainers directly. Do not open a public issue.

---

## Local Development Setup

### Required Environment Variables

Copy the example file and fill in your values:

```bash
cp secrets.env.example secrets.env
```

Required keys:
- `DATABASE_URL` – PostgreSQL connection string
- `SESSION_SECRET` – Random string for session encryption
- `OPENAI_API_KEY` – OpenAI API key
- `TAVILY_API_KEY` – Tavily search API key (optional)

> **Warning:** Never commit `secrets.env` to version control. It is already in `.gitignore`.

---

## Key Rotation Checklist

If secrets may have been exposed (e.g., accidental commit, public repository), rotate immediately:

### 1. DATABASE_URL
- [ ] Create new database credentials in your PostgreSQL provider
- [ ] Update `secrets.env` locally
- [ ] Update production environment variables
- [ ] Revoke old credentials

### 2. SESSION_SECRET
- [ ] Generate new random string: `openssl rand -base64 32`
- [ ] Update `secrets.env` locally
- [ ] Update production environment variables
- [ ] Note: All existing user sessions will be invalidated

### 3. OPENAI_API_KEY
- [ ] Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
- [ ] Create new API key
- [ ] Update `secrets.env` locally
- [ ] Update production environment variables
- [ ] Delete old API key

### 4. TAVILY_API_KEY
- [ ] Go to [Tavily Dashboard](https://app.tavily.com/)
- [ ] Create new API key
- [ ] Update `secrets.env` locally
- [ ] Update production environment variables
- [ ] Delete old API key

---

## Secret Scanning

This repository uses [Gitleaks](https://github.com/gitleaks/gitleaks) to scan for secrets in CI.

- **CI scans HEAD only** – Historical commits are not scanned to avoid blocking due to past issues
- **Local scanning:** Install gitleaks and run `gitleaks detect --source=.`

---

## Optional: Git History Cleanup

> **Important:** Only perform history cleanup if you understand the implications. This is a destructive operation that rewrites history and requires all collaborators to re-clone.

If secrets were committed historically and the repository was public, consider cleaning the history:

### Using git-filter-repo (Recommended)

```bash
# Install git-filter-repo
pip install git-filter-repo

# Remove specific file from all history
git filter-repo --path secrets.env --invert-paths

# Force push (requires --force, breaks all clones)
git push origin --force --all
```

### Using BFG Repo-Cleaner

```bash
# Download BFG
# https://rtyley.github.io/bfg-repo-cleaner/

# Remove file from history
java -jar bfg.jar --delete-files secrets.env

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push origin --force --all
```

> **After cleanup:**
> 1. Rotate ALL secrets immediately (see checklist above)
> 2. Notify all collaborators to re-clone
> 3. If repo was public, assume secrets are compromised regardless

---

## CI/CD Security

- CI runs without secrets – tests use mocks/stubs
- Production secrets are stored in environment variables (not in code)
- Secret scanning runs on every PR and push to main
