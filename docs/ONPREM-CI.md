On‑Prem CI with n8n Runners (no GitHub Actions)
================================================

This repo ships a portable CI entrypoint you can run on your own n8n workers to validate specs (Spec Gate) and optionally publish the Wiki.

Components
- `scripts/ci-spec-gate.sh`: runs `npm ci`, executes Spec Gate (optionally by tags), and publishes the Wiki if enabled.
- `Dockerfile.ci`: minimal Node LTS + git/ssh/basics to run the CI script in an isolated container.

Usage (host)
1) Ensure the repo is present on your worker (bind mount `/srv/openapi-mcp-server` below).
2) Build the CI image: `docker build -f Dockerfile.ci -t openapi-mcp-ci .`
3) Run Spec Gate by tags (Domains, DNS, VPS), 3 runs each:
   ```
   docker run --rm \
     -e TAGS=Domains,DNS,VPS \
     -e RUNS=3 \
     -v /srv/openapi-mcp-server:/work \
     -w /work \
     openapi-mcp-ci \
     bash scripts/ci-spec-gate.sh
   ```
4) Publish Wiki (optional): add `-e PUBLISH_WIKI=1` and git author envs:
   ```
   -e PUBLISH_WIKI=1 -e GIT_AUTHOR_NAME=bot -e GIT_AUTHOR_EMAIL=bot@example.com
   ```

Usage (n8n worker)
- Node: “Execute Command”
  - Command:
    ```bash
    docker run --rm \
      -e TAGS=Domains,DNS,VPS \
      -e RUNS=3 \
      -e PUBLISH_WIKI=1 \
      -e GIT_AUTHOR_NAME="github-actions[bot]" \
      -e GIT_AUTHOR_EMAIL="41898282+github-actions[bot]@users.noreply.github.com" \
      -v /srv/openapi-mcp-server:/work \
      -w /work \
      openapi-mcp-ci \
      bash scripts/ci-spec-gate.sh
    ```

Advanced
- Limit optional fields in fuzz: `-e SPEC_GATE_OPT_PROB=0.25` (default 0.25)
- Focus specific operations: add flags to the script after the image name, e.g.:
  ```
  bash scripts/ci-spec-gate.sh --include-ops domains_getDomainListV1
  ```
  (The script passes all trailing args to the gate command.)

Badges (self‑hosted)
- Create an n8n webhook that returns Shields JSON:
  ```json
  { "schemaVersion": 1, "label": "spec gate", "message": "passing", "color": "brightgreen" }
  ```
- Add to README:
  ```
  ![Spec Gate](https://img.shields.io/endpoint?url=https://your-n8n/webhook/spec-gate-badge)
  ```

