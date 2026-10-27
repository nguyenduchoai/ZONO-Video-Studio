#!/bin/bash
# Phase 7 overnight test runner
# Triggers each scenario via API, captures response + DB state, logs to report

set -e

TOKEN="<JWT_TOKEN>"
BASE="http://localhost:3080/api/v1"
MODE="${1:-stub}"  # stub or real

# Resolve IDs
CONTACT_ID=$(docker exec zalo-crm-db psql -U crmuser -d zalocrm -t -c "SELECT id FROM contacts WHERE source='phase7-test-overnight' LIMIT 1" | xargs)
MEGA_TRIGGER=$(docker exec zalo-crm-db psql -U crmuser -d zalocrm -t -c "SELECT id FROM automation_triggers WHERE name='TEST — Mega flow 7 scenarios' LIMIT 1" | xargs)
KB_TRIGGER=$(docker exec zalo-crm-db psql -U crmuser -d zalocrm -t -c "SELECT id FROM automation_triggers WHERE name='TEST — Chỉ kết bạn' LIMIT 1" | xargs)
TEXT_TRIGGER=$(docker exec zalo-crm-db psql -U crmuser -d zalocrm -t -c "SELECT id FROM automation_triggers WHERE name='TEST — Chỉ gửi text' LIMIT 1" | xargs)

echo "=== TEST RUNNER === MODE=$MODE ==="
echo "ContactID:    $CONTACT_ID"
echo "Mega Trigger: $MEGA_TRIGGER"
echo "KB Trigger:   $KB_TRIGGER"
echo "Text Trigger: $TEXT_TRIGGER"
echo ""

# Snapshot pre-state
PRE_TASKS=$(docker exec zalo-crm-db psql -U crmuser -d zalocrm -t -c "SELECT COUNT(*) FROM automation_tasks" | xargs)
PRE_CAMPAIGNS=$(docker exec zalo-crm-db psql -U crmuser -d zalocrm -t -c "SELECT COUNT(*) FROM automation_campaigns" | xargs)
echo "Pre-state: tasks=$PRE_TASKS campaigns=$PRE_CAMPAIGNS"
echo ""

# ── Scenario 1: Mega flow (7-step sequence: kết bạn → text → HTML → ảnh → video → file → link)
echo "[1/3] Trigger MEGA FLOW (sequence 7 steps) for Phạm Chí Thành..."
RESPONSE=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"contactId\":\"$CONTACT_ID\"}" \
  "$BASE/automation/triggers/$MEGA_TRIGGER/run")
echo "Response: $RESPONSE"
echo ""

# ── Scenario 2: Chỉ kết bạn (block)
sleep 2
echo "[2/3] Trigger KẾT BẠN (single block)..."
RESPONSE=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"contactId\":\"$CONTACT_ID\"}" \
  "$BASE/automation/triggers/$KB_TRIGGER/run")
echo "Response: $RESPONSE"
echo ""

# ── Scenario 3: Chỉ gửi text (block)
sleep 2
echo "[3/3] Trigger SEND TEXT (single block)..."
RESPONSE=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"contactId\":\"$CONTACT_ID\"}" \
  "$BASE/automation/triggers/$TEXT_TRIGGER/run")
echo "Response: $RESPONSE"
echo ""

# Wait for worker to pick up (10s poll cycle)
echo "Waiting 25s for worker to process all queued tasks..."
sleep 25

# Snapshot post-state
echo "=== POST-STATE ==="
docker exec zalo-crm-db psql -U crmuser -d zalocrm -c "
SELECT
  t.state, t.skip_reason, t.error_message,
  b.action_type, b.name,
  t.executed_at::time as exec_time
FROM automation_tasks t
LEFT JOIN blocks b ON b.id = t.current_block_id
WHERE t.created_at > NOW() - INTERVAL '5 minutes'
ORDER BY t.created_at DESC
LIMIT 20"

echo ""
echo "=== CAMPAIGN STATE ==="
docker exec zalo-crm-db psql -U crmuser -d zalocrm -c "
SELECT c.id, c.execution_kind, c.state, c.activated_at::time as activated,
       COUNT(t.id) as total_tasks,
       COUNT(t.id) FILTER (WHERE t.state='done') as done,
       COUNT(t.id) FILTER (WHERE t.state='skipped') as skipped,
       COUNT(t.id) FILTER (WHERE t.state='failed') as failed
FROM automation_campaigns c
LEFT JOIN automation_tasks t ON t.campaign_id = c.id
WHERE c.activated_at > NOW() - INTERVAL '5 minutes'
GROUP BY c.id, c.execution_kind, c.state, c.activated_at"

echo ""
echo "=== ENGINE LOG (last 40 lines, filtered) ==="
docker logs zalo-crm-app --tail 200 2>&1 | grep -E "task-worker|materializer|automation|STUB|request-friend|send-message|update-status" | tail -40

echo ""
echo "=== TEST RUNNER COMPLETE ==="
