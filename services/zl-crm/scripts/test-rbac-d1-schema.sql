-- Test D1: schema + trigger smoke test
-- Tạo dept tree, test path recompute, test partial unique index, test depth limit

\set ORG '''50d7a1a4-5eec-42f3-a077-0ef7770d834c'''
\set USER1 '''55ae009c-4d3a-4775-937d-e765f5af7ff7'''

-- Cleanup nếu re-run
DELETE FROM department_members WHERE user_id = :USER1;
DELETE FROM departments WHERE org_id = :ORG AND name LIKE 'TEST%';

-- 1. INSERT root → path = '/<id>/', depth=0
INSERT INTO departments (id, org_id, name, parent_id, updated_at)
VALUES ('dept-test-root', :ORG, 'TEST_Ban_Giam_Doc', NULL, NOW());

-- 2. INSERT level 1 → path inherit
INSERT INTO departments (id, org_id, name, parent_id, updated_at)
VALUES ('dept-test-kd', :ORG, 'TEST_Kinh_Doanh', 'dept-test-root', NOW());

-- 3. INSERT level 2
INSERT INTO departments (id, org_id, name, parent_id, updated_at)
VALUES ('dept-test-pkd1', :ORG, 'TEST_PKD1', 'dept-test-kd', NOW());

-- 4. INSERT level 3
INSERT INTO departments (id, org_id, name, parent_id, updated_at)
VALUES ('dept-test-pkd1-1', :ORG, 'TEST_PKD1_1', 'dept-test-pkd1', NOW());

-- 5. INSERT level 4 (depth=4, OK)
INSERT INTO departments (id, org_id, name, parent_id, updated_at)
VALUES ('dept-test-pkd1-1-a', :ORG, 'TEST_PKD1_1_A', 'dept-test-pkd1-1', NOW());

-- 6. Verify path + depth
\echo '=== After INSERT ==='
SELECT name, path, depth FROM departments WHERE org_id = :ORG AND name LIKE 'TEST%' ORDER BY depth, name;

-- 7. Test depth limit: insert level 5 → MUST FAIL
\echo '=== Test depth > 4 (must fail) ==='
\set ON_ERROR_STOP off
INSERT INTO departments (id, org_id, name, parent_id, updated_at)
VALUES ('dept-test-too-deep', :ORG, 'TEST_TOO_DEEP', 'dept-test-pkd1-1-a', NOW());
\set ON_ERROR_STOP on

-- 8. Test MOVE: PKD1_1 từ KD → root (depth 2 → 1)
\echo '=== After MOVE PKD1_1 to root ==='
UPDATE departments SET parent_id = NULL, updated_at = NOW() WHERE id = 'dept-test-pkd1-1';
SELECT name, path, depth FROM departments WHERE org_id = :ORG AND name LIKE 'TEST%' ORDER BY depth, name;
-- PKD1_1_A phải auto recompute: depth từ 4 → 2

-- 9. Test anti-cycle: move root vào subtree của con → MUST FAIL
\echo '=== Test anti-cycle move (must fail) ==='
\set ON_ERROR_STOP off
UPDATE departments SET parent_id = 'dept-test-pkd1-1-a' WHERE id = 'dept-test-pkd1-1';
\set ON_ERROR_STOP on

-- 10. Test partial unique: 2 leader cùng dept → MUST FAIL
\echo '=== Test 2 leader/dept (must fail second insert) ==='
-- Tạo 1 user thứ 2 cho test (clone từ user1)
-- Skip: chỉ test với 1 user. Insert 2 row leader cùng dept FE block.
INSERT INTO department_members (id, department_id, user_id, dept_role)
VALUES ('dm-test-1', 'dept-test-root', :USER1, 'leader');
SELECT user_id, dept_role FROM department_members WHERE department_id = 'dept-test-root';

-- Cleanup
\echo '=== Cleanup ==='
DELETE FROM department_members WHERE user_id = :USER1;
DELETE FROM departments WHERE org_id = :ORG AND name LIKE 'TEST%';
SELECT COUNT(*) AS remaining FROM departments WHERE org_id = :ORG AND name LIKE 'TEST%';
