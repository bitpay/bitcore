#!/bin/sh

# Validate every Lerna-managed package's LavaMoat allow-scripts policy,
# reporting all validation failures before exiting.
#
# If all policies validate, build a fail-closed execution plan and then run
# each physical approved dependency tree at most once. Execution stops on the
# first failure.

set -u

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
LERNA="$ROOT_DIR/node_modules/.bin/lerna"
ALLOW_SCRIPTS="$ROOT_DIR/node_modules/.bin/allow-scripts"
PLAN_ALLOWED_SCRIPTS="$ROOT_DIR/plan-allowed-scripts.js"

PACKAGE_LIST=
RUN_PACKAGE_LIST=
SEEN_SCRIPT_PATHS=
CURRENT_SCRIPT_PATHS=

cleanup() {
  [ -z "$PACKAGE_LIST" ] || rm -f -- "$PACKAGE_LIST"
  [ -z "$RUN_PACKAGE_LIST" ] || rm -f -- "$RUN_PACKAGE_LIST"
  [ -z "$SEEN_SCRIPT_PATHS" ] || rm -f -- "$SEEN_SCRIPT_PATHS"
  [ -z "$CURRENT_SCRIPT_PATHS" ] || rm -f -- "$CURRENT_SCRIPT_PATHS"
}

trap cleanup 0
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

if ! PACKAGE_LIST=$(mktemp); then
  echo "ERROR: Unable to create a temporary package-list file."
  exit 1
fi

if ! RUN_PACKAGE_LIST=$(mktemp); then
  echo "ERROR: Unable to create a temporary execution-plan file."
  exit 1
fi

if ! SEEN_SCRIPT_PATHS=$(mktemp); then
  echo "ERROR: Unable to create a temporary approved-path file."
  exit 1
fi

if ! CURRENT_SCRIPT_PATHS=$(mktemp); then
  echo "ERROR: Unable to create a temporary package-path file."
  exit 1
fi

if [ ! -x "$LERNA" ]; then
  echo "ERROR: Lerna executable not found:"
  echo "  $LERNA"
  echo "Run npm ci --ignore-scripts before running this script."
  exit 1
fi

if [ ! -x "$ALLOW_SCRIPTS" ]; then
  echo "ERROR: allow-scripts executable not found:"
  echo "  $ALLOW_SCRIPTS"
  echo "Run npm ci --ignore-scripts before running this script."
  exit 1
fi

if [ ! -f "$PLAN_ALLOWED_SCRIPTS" ]; then
  echo "ERROR: Approved lifecycle planner not found:"
  echo "  $PLAN_ALLOWED_SCRIPTS"
  exit 1
fi

if ! cd "$ROOT_DIR"; then
  echo "ERROR: Unable to enter the repository root:"
  echo "  $ROOT_DIR"
  exit 1
fi

# Using Lerna to generate the package list preserves the repository's
# configured package scope and therefore excludes packages/insight.
if ! "$LERNA" list --all --parseable > "$PACKAGE_LIST"; then
  echo "ERROR: Unable to obtain the Lerna package list."
  exit 1
fi

echo "Validating LavaMoat lifecycle policies..."
echo

check_failures=0
package_count=0

while IFS= read -r package_dir; do
  [ -n "$package_dir" ] || continue

  package_count=$((package_count + 1))
  if ! package_name=$(
    cd "$package_dir" &&
      node -p 'require("./package.json").name'
  ); then
    echo "ERROR: Unable to determine package name for:"
    echo "  $package_dir"
    exit 1
  fi

  echo "Checking $package_name"

  if (
    cd "$package_dir" &&
      "$ALLOW_SCRIPTS" check
  ); then
    echo "PASS: $package_name"
  else
    check_failures=$((check_failures + 1))

    echo "FAIL: $package_name"
    echo
    echo "Current lifecycle inventory for $package_name:"
    echo "------------------------------------------------------------"

    (
      cd "$package_dir" &&
        "$ALLOW_SCRIPTS" list
    ) || true

    echo "------------------------------------------------------------"
  fi

  echo
done < "$PACKAGE_LIST"

if [ "$package_count" -eq 0 ]; then
  echo "ERROR: Lerna returned no managed packages."
  exit 1
fi

if [ "$check_failures" -ne 0 ]; then
  echo "ERROR: LavaMoat policy validation failed for $check_failures package(s)."
  echo "Approved lifecycle scripts were not executed."
  exit 1
fi

echo "All $package_count package policies passed validation."
echo
echo "Planning approved dependency lifecycle execution..."
echo

plan_failures=0

while IFS= read -r package_dir; do
  [ -n "$package_dir" ] || continue

  if ! package_name=$(
    cd "$package_dir" &&
      node -p 'require("./package.json").name'
  ); then
    echo "ERROR: Unable to determine package name for:"
    echo "  $package_dir"
    exit 1
  fi

  if ! node "$PLAN_ALLOWED_SCRIPTS" "$package_dir" > "$CURRENT_SCRIPT_PATHS"; then
    echo "FAIL: Unable to plan approved lifecycle scripts for $package_name."
    echo
    plan_failures=$((plan_failures + 1))
    continue
  fi

  if ! duplicate_current_paths=$(
    awk 'seen[$0]++ { print }' "$CURRENT_SCRIPT_PATHS"
  ); then
    echo "ERROR: Unable to check $package_name for duplicate approved paths."
    exit 1
  fi

  if [ -n "$duplicate_current_paths" ]; then
    echo "FAIL: $package_name resolves multiple approvals to the same path:"
    echo "$duplicate_current_paths"
    echo "The runner cannot safely invoke allow-scripts without executing that path more than once."
    echo
    plan_failures=$((plan_failures + 1))
    continue
  fi

  path_count=0
  new_path_count=0
  seen_path_count=0

  while IFS= read -r approved_path; do
    [ -n "$approved_path" ] || continue

    path_count=$((path_count + 1))
    if grep -Fqx -- "$approved_path" "$SEEN_SCRIPT_PATHS"; then
      seen_path_count=$((seen_path_count + 1))
    else
      grep_status=$?
      if [ "$grep_status" -ne 1 ]; then
        echo "ERROR: Unable to read the approved lifecycle path plan."
        exit 1
      fi
      new_path_count=$((new_path_count + 1))
    fi
  done < "$CURRENT_SCRIPT_PATHS"

  if [ "$path_count" -eq 0 ]; then
    echo "SKIP: $package_name has no approved dependency lifecycle scripts."
    echo
    continue
  fi

  if [ "$new_path_count" -ne 0 ] && [ "$seen_path_count" -ne 0 ]; then
    echo "FAIL: $package_name has a partial overlap with an earlier package's approved paths."
    echo "The runner cannot safely invoke allow-scripts without repeating a lifecycle script."
    echo
    plan_failures=$((plan_failures + 1))
    continue
  fi

  if [ "$seen_path_count" -eq "$path_count" ]; then
    echo "SKIP: $package_name's approved dependency scripts are already planned."
    echo
    continue
  fi

  if ! cat "$CURRENT_SCRIPT_PATHS" >> "$SEEN_SCRIPT_PATHS"; then
    echo "ERROR: Unable to update the approved lifecycle path plan."
    exit 1
  fi

  if ! printf '%s\n' "$package_dir" >> "$RUN_PACKAGE_LIST"; then
    echo "ERROR: Unable to update the package execution plan."
    exit 1
  fi

  echo "PLAN: Run approved dependency lifecycle scripts for $package_name."
  echo
done < "$PACKAGE_LIST"

if [ "$plan_failures" -ne 0 ]; then
  echo "ERROR: Approved lifecycle execution planning failed for $plan_failures package(s)."
  echo "Approved lifecycle scripts were not executed."
  exit 1
fi

echo "Executing approved dependency lifecycle scripts..."
echo

while IFS= read -r package_dir; do
  [ -n "$package_dir" ] || continue

  if ! package_name=$(
    cd "$package_dir" &&
      node -p 'require("./package.json").name'
  ); then
    echo "ERROR: Unable to determine package name for:"
    echo "  $package_dir"
    exit 1
  fi

  echo "Running approved lifecycle scripts for $package_name"

  if (
    cd "$package_dir" &&
      "$ALLOW_SCRIPTS" run
  ); then
    echo "PASS: $package_name"
  else
    run_status=$?

    echo
    echo "ERROR: Approved lifecycle execution failed for $package_name."
    echo "Exit status: $run_status"
    echo
    echo "Current lifecycle inventory:"
    echo "------------------------------------------------------------"

    (
      cd "$package_dir" &&
        "$ALLOW_SCRIPTS" list
    ) || true

    echo "------------------------------------------------------------"
    exit "$run_status"
  fi

  echo
done < "$RUN_PACKAGE_LIST"

echo "Approved dependency lifecycle scripts completed successfully."
