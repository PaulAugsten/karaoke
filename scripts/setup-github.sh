#!/usr/bin/env bash
# One-time (and idempotent) GitHub setup for this repo: merge settings, security
# features, and a ruleset protecting main whose required checks match the job ids
# in .github/workflows/*.yml. Run by hand after the first push:
#
#   ./scripts/setup-github.sh
#
# Requires the GitHub CLI (gh) authenticated with admin access to the repo.
# Re-run whenever a workflow job is renamed/added/removed to keep checks in sync.
# Note: rulesets on *private* repos are only enforced on paid plans (Pro/Team).
set -euo pipefail

REPO="${REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
REQUIRED_REVIEWS="${REQUIRED_REVIEWS:-0}"

echo "==> Merge settings (squash only, PR title becomes the commit on main)"
gh api --method PATCH "repos/${REPO}" \
    -F allow_squash_merge=true \
    -F allow_merge_commit=false \
    -F allow_rebase_merge=false \
    -f squash_merge_commit_title=PR_TITLE \
    -f squash_merge_commit_message=PR_BODY \
    -F allow_auto_merge=true \
    -F allow_update_branch=true \
    -F delete_branch_on_merge=true \
    >/dev/null

echo "==> Security features"
# Dependabot *alerts* stay on: Renovate reads them to open security updates. Dependabot's
# own security-fix PRs are turned off so they don't duplicate Renovate's.
gh api --method PUT "repos/${REPO}/vulnerability-alerts" >/dev/null
gh api --method DELETE "repos/${REPO}/automated-security-fixes" >/dev/null
gh api --method PUT "repos/${REPO}/private-vulnerability-reporting" >/dev/null
# Push protection blocks pushes that contain a detected secret (free on public repos).
gh api --method PATCH "repos/${REPO}" --input - >/dev/null <<'JSON'
{
    "security_and_analysis": {
        "secret_scanning": { "status": "enabled" },
        "secret_scanning_push_protection": { "status": "enabled" }
    }
}
JSON

echo "==> Actions permissions"
# Every action in .github/ is pinned to a full commit SHA (Renovate keeps them current),
# so GitHub can refuse any workflow change that sneaks in a mutable tag.
gh api --method PUT "repos/${REPO}/actions/permissions" \
    -F enabled=true \
    -f allowed_actions=all \
    -F sha_pinning_required=true \
    >/dev/null
# Workflows get a read-only GITHUB_TOKEN unless they ask for more, and can't approve PRs.
gh api --method PUT "repos/${REPO}/actions/permissions/workflow" \
    -f default_workflow_permissions=read \
    -F can_approve_pull_request_reviews=false

# semantic-release pushes the version bump + CHANGELOG commit straight to main,
# authenticated with this deploy key, which is the ruleset's only bypass actor.
if ! gh secret list --repo "${REPO}" | grep -q '^RELEASE_DEPLOY_KEY\b'; then
    echo "==> Release deploy key"
    keydir="$(mktemp -d)"
    trap 'rm -rf "${keydir}"' EXIT
    ssh-keygen -t ed25519 -N '' -C "semantic-release@${REPO}" -f "${keydir}/key" >/dev/null
    gh repo deploy-key add "${keydir}/key.pub" --repo "${REPO}" --allow-write --title semantic-release
    gh secret set RELEASE_DEPLOY_KEY --repo "${REPO}" <"${keydir}/key"
fi

echo "==> production environment (gates the deploy job in ci.yml)"
owner_id="$(gh api "users/${REPO%%/*}" --jq .id)"
gh api --method PUT "repos/${REPO}/environments/production" --input - >/dev/null <<JSON
{
    "reviewers": [{ "type": "User", "id": ${owner_id} }],
    "deployment_branch_policy": { "protected_branches": true, "custom_branch_policies": false }
}
JSON

for secret in CI_AUTOMATION_TOKEN RELEASE_TOKEN; do
    if ! gh secret list --repo "${REPO}" | grep -q "^${secret}\b"; then
        echo "    NOTE: secret ${secret} is not set yet - see README.md > Repository setup"
    fi
done

# Job ids as they appear in the workflow files (these become the check-run
# "context" names GitHub matches against):
#   ci.yml                -> pre-commit, lint, typecheck, knip, unit, build
#   pr-title.yml          -> conventional
#   gitleaks.yml          -> scan
#   codeql.yml            -> analyze
#   dependency-review.yml -> review
#   e2e.yml (fires off Vercel's deployment_status, so these land on the same
#            commit SHA slightly after the PR-triggered checks do) -> e2e, lighthouse
# required_deployments additionally waits for Vercel's Preview deploy to succeed.
ruleset="$(
    cat <<JSON
{
    "name": "main",
    "target": "branch",
    "enforcement": "active",
    "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
    "bypass_actors": [{ "actor_id": null, "actor_type": "DeployKey", "bypass_mode": "always" }],
    "rules": [
        { "type": "deletion" },
        { "type": "non_fast_forward" },
        { "type": "required_linear_history" },
        {
            "type": "pull_request",
            "parameters": {
                "required_approving_review_count": ${REQUIRED_REVIEWS},
                "dismiss_stale_reviews_on_push": true,
                "require_code_owner_review": false,
                "require_last_push_approval": false,
                "required_review_thread_resolution": true,
                "allowed_merge_methods": ["squash"]
            }
        },
        {
            "type": "required_status_checks",
            "parameters": {
                "strict_required_status_checks_policy": true,
                "required_status_checks": [
                    { "context": "pre-commit" },
                    { "context": "lint" },
                    { "context": "typecheck" },
                    { "context": "knip" },
                    { "context": "unit" },
                    { "context": "build" },
                    { "context": "e2e" },
                    { "context": "lighthouse" },
                    { "context": "conventional" },
                    { "context": "scan" },
                    { "context": "analyze" },
                    { "context": "review" }
                ]
            }
        },
        {
            "type": "required_deployments",
            "parameters": { "required_deployment_environments": ["Preview"] }
        }
    ]
}
JSON
)"

existing_id="$(gh api "repos/${REPO}/rulesets" --jq '.[] | select(.name == "main") | .id')"
if [[ -n "${existing_id}" ]]; then
    echo "==> Updating ruleset 'main' (#${existing_id})"
    gh api --method PUT "repos/${REPO}/rulesets/${existing_id}" --input - <<<"${ruleset}" >/dev/null
else
    echo "==> Creating ruleset 'main'"
    gh api --method POST "repos/${REPO}/rulesets" --input - <<<"${ruleset}" >/dev/null
fi

echo "Done."
