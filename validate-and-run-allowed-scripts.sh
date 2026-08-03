#!/bin/sh

# Validate every Lerna-managed package's LavaMoat allow-scripts policy,
# reporting all validation failures before exiting.
#
# If all policies validate, build a fail-closed execution plan and then run
# each physical approved dependency tree at most once. Execution stops on the
# first failure. Pass --check-only to stop after successful planning without
# running any lifecycle scripts.

set -u

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
LERNA="$ROOT_DIR/node_modules/.bin/lerna"
ALLOW_SCRIPTS="$ROOT_DIR/node_modules/.bin/allow-scripts"
PLAN_ALLOWED_SCRIPTS="$ROOT_DIR/plan-allowed-scripts.js"
LIFECYCLE_COORDINATOR="$ROOT_DIR/lifecycle-plan-coordinator.js"
LIFECYCLE_RUN_WRAPPER="$ROOT_DIR/run-allowed-scripts.js"

PACKAGE_INVENTORY=
PLAN_DIR=
GLOBAL_PLAN=
ACTIVE_CHILD=
CHECK_ONLY=false

case "${1:-}" in
  '')
    ;;
  --check-only)
    CHECK_ONLY=true
    ;;
  *)
    echo "Usage: $0 [--check-only]"
    exit 2
    ;;
esac

if [ "$#" -gt 1 ]; then
  echo "Usage: $0 [--check-only]"
  exit 2
fi

cleanup() {
  [ -z "$PACKAGE_INVENTORY" ] || rm -f -- "$PACKAGE_INVENTORY"
  [ -z "$PLAN_DIR" ] || rm -rf -- "$PLAN_DIR"
  [ -z "$GLOBAL_PLAN" ] || rm -f -- "$GLOBAL_PLAN"
}

handle_signal() {
  signal_name=$1
  signal_status=$2
  if [ -n "$ACTIVE_CHILD" ]; then
    kill -s "$signal_name" "$ACTIVE_CHILD" 2>/dev/null || true
    wait "$ACTIVE_CHILD" 2>/dev/null || true
  fi
  exit "$signal_status"
}

trap cleanup 0
trap 'handle_signal HUP 129' HUP
trap 'handle_signal INT 130' INT
trap 'handle_signal TERM 143' TERM

if ! PACKAGE_INVENTORY=$(mktemp); then
  echo "ERROR: Unable to create a temporary package-inventory file."
  exit 1
fi

if ! GLOBAL_PLAN=$(mktemp); then
  echo "ERROR: Unable to create a temporary global-plan file."
  exit 1
fi

if ! PLAN_DIR=$(mktemp -d); then
  echo "ERROR: Unable to create a temporary lifecycle-plan directory."
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

if [ ! -f "$LIFECYCLE_COORDINATOR" ]; then
  echo "ERROR: Lifecycle plan coordinator not found:"
  echo "  $LIFECYCLE_COORDINATOR"
  exit 1
fi

if [ ! -f "$LIFECYCLE_RUN_WRAPPER" ]; then
  echo "ERROR: Lifecycle execution wrapper not found:"
  echo "  $LIFECYCLE_RUN_WRAPPER"
  exit 1
fi

if ! cd "$ROOT_DIR"; then
  echo "ERROR: Unable to enter the repository root:"
  echo "  $ROOT_DIR"
  exit 1
fi

# This structured inventory establishes only the closed expected artifact set.
# Lerna exec remains responsible for per-package invocation and working dirs.
if ! node "$LIFECYCLE_COORDINATOR" discover \
  "$ROOT_DIR" "$LERNA" > "$PACKAGE_INVENTORY"; then
  echo "ERROR: Unable to establish the managed-package inventory."
  exit 1
fi

echo "Validating LavaMoat lifecycle policies..."
echo

if ! package_count=$(node "$LIFECYCLE_COORDINATOR" count "$PACKAGE_INVENTORY"); then
  echo "ERROR: Unable to count the managed packages."
  exit 1
fi

if [ "$package_count" -eq 0 ]; then
  echo "ERROR: Lerna returned no managed packages."
  exit 1
fi

if ! BITCORE_LIFECYCLE_PLAN_DIR="$PLAN_DIR" \
  "$LERNA" exec --concurrency 1 --no-bail --stream -- \
  node '$LERNA_ROOT_PATH/plan-allowed-scripts.js' .; then
  echo
  echo "ERROR: LavaMoat policy validation or lifecycle planning failed."
  echo "Approved lifecycle scripts were not executed."
  exit 1
fi

if ! node "$LIFECYCLE_COORDINATOR" global-plan \
  "$PACKAGE_INVENTORY" "$PLAN_DIR" > "$GLOBAL_PLAN"; then
  echo
  echo "ERROR: The global lifecycle execution plan is incomplete or invalid."
  echo "Approved lifecycle scripts were not executed."
  exit 1
fi

echo "All $package_count package policies passed validation."
echo
echo "Planning approved dependency lifecycle execution..."
echo

if ! node "$LIFECYCLE_COORDINATOR" report "$GLOBAL_PLAN"; then
  echo "ERROR: Unable to report the global lifecycle execution plan."
  exit 1
fi

if [ "$CHECK_ONLY" = true ]; then
  echo "All package policies and the approved lifecycle execution plan passed validation."
  echo "Approved lifecycle scripts were not executed."
  exit 0
fi

echo "Executing approved dependency lifecycle scripts..."
echo

node "$LIFECYCLE_COORDINATOR" execute \
  "$GLOBAL_PLAN" "$ROOT_DIR" "$LERNA" "$LIFECYCLE_RUN_WRAPPER" &
ACTIVE_CHILD=$!
wait "$ACTIVE_CHILD"
run_status=$?
ACTIVE_CHILD=

if [ "$run_status" -ne 0 ]; then
  echo
  echo "ERROR: Approved lifecycle execution failed."
  echo "Exit status: $run_status"
  exit "$run_status"
fi

echo "Approved dependency lifecycle scripts completed successfully."
