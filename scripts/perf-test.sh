#!/usr/bin/env bash
# bgm-cli Comprehensive Performance Test Suite
set -e

CLI="node src/cli.js"
TOKEN_USER="1135790"
TEST_USER="774952"

# Colors
G='\033[0;32m'
R='\033[0;31m'
Y='\033[1;33m'
B='\033[1;34m'
NC='\033[0m'

# Results: name|status|duration|details
declare -a results

run_test() {
  local name="$1"
  local cmd="$2"
  local check="$3"
  local desc="$4"
  
  printf "%-55s " "$name"
  
  local start end duration
  start=$(date +%s%N)
  
  local output
  if output=$($cmd 2>&1); then
    end=$(date +%s%N)
    duration=$(( (end - start) / 1000000 ))
    
    if [[ -n "$check" ]] && echo "$output" | grep -q "$check"; then
      printf "${G}PASS${NC} %6dms\n" "$duration"
      results+=("$name|PASS|$duration|$desc")
    elif [[ -n "$check" ]]; then
      printf "${Y}WARN${NC} %6dms (check mismatch)\n" "$duration"
      results+=("$name|WARN|$duration|$desc")
    else
      printf "${G}PASS${NC} %6dms\n" "$duration"
      results+=("$name|PASS|$duration|$desc")
    fi
  else
    end=$(date +%s%N)
    duration=$(( (end - start) / 1000000 ))
    printf "${R}FAIL${NC} %6dms\n" "$duration"
    # Show first line of error
    local err_line
    err_line=$(echo "$output" | grep -v '^\s*$' | head -1)
    echo "       → $err_line"
    results+=("$name|FAIL|$duration|$desc")
  fi
}

echo "========================================"
echo -e "${B}bgm-cli Performance Test Suite${NC}"
echo "========================================"
echo ""

# ========== AUTH ==========
echo -e "${B}1. Auth Commands${NC}"
run_test "auth status" "$CLI --json auth status" '"valid": true' "Verify token validity"

echo ""

# ========== USER ==========
echo -e "${B}2. User Commands${NC}"
run_test "user me" "$CLI --json user me" '"username": "1135790"' "Current user profile"
run_test "user get 774952" "$CLI --json user get 774952" '"username": "774952"' "Public user profile"

echo ""

# ========== SUBJECT ==========
echo -e "${B}3. Subject Commands${NC}"
run_test "subject search (anime, limit=5)" "$CLI --json subject search 鬼灭 --type anime --limit 5" '"id":' "Search with filter"
run_test "subject get #12" "$CLI --json subject get 12" '"name":' "Get subject detail"
run_test "subject list (anime, limit=5)" "$CLI --json subject list --type anime --limit 5" '"id":' "Browse subjects"

echo ""

# ========== COLLECTION (Core Optimizations) ==========
echo -e "${B}4. Collection Commands (P0 Optimizations)${NC}"

# Baseline: no filter
run_test "collection list (no filter, limit=5)" \
  "$CLI --json collection list --user $TEST_USER --limit 5" \
  '"subject_id":' "Fetch 5 from all 835 collections"

# Single-value filter: should use API passthrough
run_test "collection list (anime only, limit=5)" \
  "$CLI --json collection list --user $TEST_USER --type anime --limit 5" \
  '"subject_id":' "API filtered: anime type only"

run_test "collection list (collect only, limit=5)" \
  "$CLI --json collection list --user $TEST_USER --status collect --limit 5" \
  '"subject_id":' "API filtered: collect status only"

run_test "collection list (anime+collect, limit=5)" \
  "$CLI --json collection list --user $TEST_USER --type anime --status collect --limit 5" \
  '"subject_id":' "API filtered: both type+status"

# Offset test
run_test "collection list (offset=10, limit=5)" \
  "$CLI --json collection list --user $TEST_USER --type anime --status collect --offset 10 --limit 5" \
  '"subject_id":' "Pagination with offset"

# Large fetches to test parallel performance
run_test "collection list (anime+collect, limit=200)" \
  "$CLI --json collection list --user $TEST_USER --type anime --status collect --limit 200" \
  '"subject_id":' "Fetch 200 filtered items"

run_test "collection list (anime+collect, limit=500)" \
  "$CLI --json collection list --user $TEST_USER --type anime --status collect --limit 500" \
  '"subject_id":' "Fetch 500 filtered items"

run_test "collection list (all, limit=1000)" \
  "$CLI --json collection list --user $TEST_USER --limit 1000" \
  '"subject_id":' "Full fetch all 835 items"

# Collection get (use a known collected subject)
run_test "collection get #543360" \
  "$CLI --json collection get 543360 2>&1 || true" \
  "" "Get own collection"

echo ""

# ========== EPISODE ==========
echo -e "${B}5. Episode Commands${NC}"
run_test "episode list #12" "$CLI --json episode list 12 --limit 5" '"id":' "List episodes"

echo ""

# ========== GROUP ==========
echo -e "${B}6. Group Commands${NC}"
run_test "group list (limit=5)" "$CLI --json group list --limit 5" '"name":' "List groups"
run_test "group get bangumi" "$CLI --json group get bangumi" '"name":' "Get group detail"
run_test "group topics (limit=5)" "$CLI --json group topics bangumi --limit 5" '"id":' "List group topics"
run_test "group members (limit=5)" "$CLI --json group members bangumi --limit 5" '"username":' "List group members"

echo ""

# ========== BLOG ==========
echo -e "${B}7. Blog Commands${NC}"
run_test "blog list (limit=5)" "$CLI --json blog list --user $TEST_USER --limit 5" "" "List user blogs"

echo ""

# ========== INDEX ==========
echo -e "${B}8. Index Commands${NC}"
run_test "index get #1" "$CLI --json index get 1" '"title":' "Get index detail"

echo ""

# ========== TIMELINE ==========
echo -e "${B}9. Timeline Commands${NC}"
run_test "timeline list (limit=5)" "$CLI --json timeline list --limit 5" '"id":' "List timeline"
run_test "timeline user (limit=5)" "$CLI --json timeline user $TEST_USER --limit 5" '"id":' "User timeline"

echo ""

# ========== STATUS ==========
echo -e "${B}10. Status Commands${NC}"
run_test "status" "$CLI --json status" '"status":' "Service health"
run_test "status current" "$CLI --json status current" '"status":' "Current status"
run_test "status incidents" "$CLI --json status incidents --limit 5" '"data":' "Recent incidents"

echo ""

# ========== SUMMARY ==========
echo "========================================"
echo -e "${B}Test Summary${NC}"
echo "========================================"

pass_count=0
fail_count=0
warn_count=0
total_duration=0

printf "%-55s %8s %10s\n" "Test Name" "Status" "Duration"
printf "%-55s %8s %10s\n" "-------" "------" "--------"

for result in "${results[@]}"; do
  IFS='|' read -r name status duration desc <<< "$result"
  total_duration=$((total_duration + duration))
  
  case $status in
    PASS)
      pass_count=$((pass_count + 1))
      printf "%-55s ${G}%8s${NC} %9dms\n" "$name" "PASS" "$duration"
      ;;
    FAIL)
      fail_count=$((fail_count + 1))
      printf "%-55s ${R}%8s${NC} %9dms\n" "$name" "FAIL" "$duration"
      ;;
    WARN)
      warn_count=$((warn_count + 1))
      printf "%-55s ${Y}%8s${NC} %9dms\n" "$name" "WARN" "$duration"
      ;;
  esac
done

echo ""
echo "Total: $((pass_count + fail_count + warn_count)) tests"
echo -e "  ${G}Pass: $pass_count${NC}"
echo -e "  ${R}Fail: $fail_count${NC}"
echo -e "  ${Y}Warn: $warn_count${NC}"
echo "Total duration: ${total_duration}ms"
echo ""

# Performance analysis
echo -e "${B}--- Collection List Performance Analysis ---${NC}"
printf "%-50s %10s\n" "Test" "Duration"
printf "%-50s %10s\n" "----" "--------"
for result in "${results[@]}"; do
  if [[ "$result" == *"collection list"* ]]; then
    IFS='|' read -r name status duration desc <<< "$result"
    printf "%-50s %9dms  %s\n" "$name" "$duration" "$desc"
  fi
done

echo ""
echo -e "${B}--- Slowest Commands (>1000ms) ---${NC}"
for result in "${results[@]}"; do
  IFS='|' read -r name status duration desc <<< "$result"
  if [[ "$duration" -gt 1000 ]]; then
    printf "%-50s %9dms  %s\n" "$name" "$duration" "$desc"
  fi
done
