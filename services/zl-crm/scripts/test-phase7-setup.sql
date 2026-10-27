-- Phase 7 Test Setup — 2026-05-21 Overnight Run
-- Creates: 1 test contact + 7 test blocks + 1 mega-sequence + 3 manual_run triggers
-- All IDs are TEXT (Prisma String @id @default(uuid) maps to text in Postgres)

\set ON_ERROR_STOP on

DO $$
DECLARE
  v_org_id TEXT;
  v_user_id TEXT;
  v_status_tiep_can TEXT;
  v_contact_id TEXT;
  v_seq_id TEXT;
  v_block_kb TEXT;
  v_block_text TEXT;
  v_block_html TEXT;
  v_block_image TEXT;
  v_block_video TEXT;
  v_block_file TEXT;
  v_block_link TEXT;
BEGIN
  SELECT o.id, u.id INTO v_org_id, v_user_id
  FROM organizations o
  JOIN users u ON u.org_id = o.id AND u.role = 'owner'
  LIMIT 1;
  RAISE NOTICE 'Org=% User=%', v_org_id, v_user_id;

  SELECT id INTO v_status_tiep_can FROM statuses WHERE org_id = v_org_id AND name = 'Tiếp cận';

  -- ── 1. Test contact: Phạm Chí Thành 0931536109 ─────────────────────────
  SELECT id INTO v_contact_id FROM contacts
  WHERE org_id = v_org_id AND phone_normalized = '84931536109' LIMIT 1;

  IF v_contact_id IS NULL THEN
    v_contact_id := gen_random_uuid()::text;
    INSERT INTO contacts (id, org_id, full_name, crm_name, phone, phone_normalized, status_id, source, created_at, updated_at)
    VALUES (
      v_contact_id, v_org_id,
      'Phạm Chí Thành — Trợ Lý (TEST)',
      'Test Contact 0931536109',
      '0931536109', '84931536109',
      v_status_tiep_can, 'phase7-test-overnight',
      NOW(), NOW()
    );
  END IF;
  RAISE NOTICE 'Contact=%', v_contact_id;

  -- ── 2. Test blocks for 7 scenarios (delete + reinsert for clean state) ──
  DELETE FROM blocks WHERE name LIKE 'TEST — %' AND org_id = v_org_id;

  v_block_kb := gen_random_uuid()::text;
  INSERT INTO blocks (id, org_id, name, channel, action_type, content, created_by_id, created_at, updated_at)
  VALUES (
    v_block_kb, v_org_id, 'TEST — Kết bạn Zalo (Phase 7)',
    'zalo_user', 'request_friend',
    '{"greetingVariants":["Em chào anh/chị, em từ HS Holding xin được kết bạn ạ","Xin chào anh/chị, em là trợ lý CRM xin kết bạn để chăm sóc tốt hơn"]}'::jsonb,
    v_user_id, NOW(), NOW()
  );

  v_block_text := gen_random_uuid()::text;
  INSERT INTO blocks (id, org_id, name, channel, action_type, content, created_by_id, created_at, updated_at)
  VALUES (
    v_block_text, v_org_id, 'TEST — Gửi tin text (Phase 7)',
    'zalo_user', 'send_message',
    '{"textVariants":["Em chào anh, em là Hoa từ HS Holding ạ. Em xin gửi anh thông tin về dự án mới.","Chào anh, em hỗ trợ dự án XYZ, em xin phép gửi anh ít tài liệu nhé."]}'::jsonb,
    v_user_id, NOW(), NOW()
  );

  v_block_html := gen_random_uuid()::text;
  INSERT INTO blocks (id, org_id, name, channel, action_type, content, created_by_id, created_at, updated_at)
  VALUES (
    v_block_html, v_org_id, 'TEST — Rich text với unicode (Phase 7)',
    'zalo_user', 'send_message',
    '{"textVariants":["📢 𝐓𝐡𝐨̂𝐧𝐠 𝐛𝐚́𝐨 𝐪𝐮𝐚𝐧 𝐭𝐫𝐨̣𝐧𝐠 ✨\n\n🔸 Dự án mới ra mắt\n🔸 Ưu đãi giới hạn 100 suất đầu tiên\n🔸 Link đăng ký: https://hsholding.vn\n\n𝐂𝐚̉𝐦 𝐨̛𝐧 𝐚𝐧𝐡/𝐜𝐡𝐢̣ ❤️"]}'::jsonb,
    v_user_id, NOW(), NOW()
  );

  v_block_image := gen_random_uuid()::text;
  INSERT INTO blocks (id, org_id, name, channel, action_type, content, created_by_id, created_at, updated_at)
  VALUES (
    v_block_image, v_org_id, 'TEST — Gửi ảnh (Phase 7)',
    'zalo_user', 'send_message',
    '{"textVariants":["Đây là hình ảnh dự án anh xem nhé"],"attachments":[{"kind":"image","url":"https://picsum.photos/seed/phase7/800/600","caption":"Hình ảnh project demo"}]}'::jsonb,
    v_user_id, NOW(), NOW()
  );

  v_block_video := gen_random_uuid()::text;
  INSERT INTO blocks (id, org_id, name, channel, action_type, content, created_by_id, created_at, updated_at)
  VALUES (
    v_block_video, v_org_id, 'TEST — Gửi video (Phase 7)',
    'zalo_user', 'send_message',
    '{"textVariants":["Video giới thiệu dự án anh xem thử nhé"],"attachments":[{"kind":"video","url":"https://download.samplelib.com/mp4/sample-5s.mp4","thumbnailUrl":"https://picsum.photos/seed/vidthumb/640/360","caption":"Demo video 5s"}]}'::jsonb,
    v_user_id, NOW(), NOW()
  );

  v_block_file := gen_random_uuid()::text;
  INSERT INTO blocks (id, org_id, name, channel, action_type, content, created_by_id, created_at, updated_at)
  VALUES (
    v_block_file, v_org_id, 'TEST — Gửi file (Phase 7)',
    'zalo_user', 'send_message',
    '{"textVariants":["Em gửi anh file bảng giá nhé"],"attachments":[{"kind":"file","url":"https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf","caption":"Bảng giá tham khảo.pdf"}]}'::jsonb,
    v_user_id, NOW(), NOW()
  );

  v_block_link := gen_random_uuid()::text;
  INSERT INTO blocks (id, org_id, name, channel, action_type, content, created_by_id, created_at, updated_at)
  VALUES (
    v_block_link, v_org_id, 'TEST — Gửi link card (Phase 7)',
    'zalo_user', 'send_message',
    '{"textVariants":["Trang chủ HS Holding"],"attachments":[{"kind":"link","url":"https://hsholding.vn","caption":"HS Holding Vietnam"}]}'::jsonb,
    v_user_id, NOW(), NOW()
  );

  RAISE NOTICE 'Blocks: kb=% text=% html=% image=% video=% file=% link=%',
    v_block_kb, v_block_text, v_block_html, v_block_image, v_block_video, v_block_file, v_block_link;

  -- ── 3. Mega sequence: 7 bước cho test full flow ────────────────────────
  DELETE FROM automation_sequences WHERE name LIKE 'TEST — %' AND org_id = v_org_id;

  v_seq_id := gen_random_uuid()::text;
  INSERT INTO automation_sequences (id, org_id, name, description, channel, steps, runtime_rules, enabled, created_by_id, created_at, updated_at)
  VALUES (
    v_seq_id, v_org_id,
    'TEST — Mega flow 7 scenarios',
    'Phase 7 overnight test: kết bạn → text → HTML → ảnh → video → file → link',
    'zalo_user',
    jsonb_build_array(
      jsonb_build_object('stepId', 's1', 'blockId', v_block_kb,    'delayMinutes', 0),
      jsonb_build_object('stepId', 's2', 'blockId', v_block_text,  'delayMinutes', 0),
      jsonb_build_object('stepId', 's3', 'blockId', v_block_html,  'delayMinutes', 0),
      jsonb_build_object('stepId', 's4', 'blockId', v_block_image, 'delayMinutes', 0),
      jsonb_build_object('stepId', 's5', 'blockId', v_block_video, 'delayMinutes', 0),
      jsonb_build_object('stepId', 's6', 'blockId', v_block_file,  'delayMinutes', 0),
      jsonb_build_object('stepId', 's7', 'blockId', v_block_link,  'delayMinutes', 0)
    ),
    '{"allowedHourRange":[0,23],"randomDelayPerSend":{"min":0,"max":1},"perNickThrottle":false,"crossNickRecencyDays":0,"stopOnAccept":false}'::jsonb,
    true, v_user_id, NOW(), NOW()
  );
  RAISE NOTICE 'Mega sequence=%', v_seq_id;

  -- ── 4. Per-scenario triggers (manual_run) ──────────────────────────────
  DELETE FROM automation_triggers WHERE name LIKE 'TEST — %' AND org_id = v_org_id;

  INSERT INTO automation_triggers (id, org_id, name, category, event_type, binding_kind, sequence_id, enabled, created_by_id, created_at, updated_at)
  VALUES (gen_random_uuid()::text, v_org_id, 'TEST — Mega flow 7 scenarios', 'general', 'manual_run', 'sequence', v_seq_id, true, v_user_id, NOW(), NOW());

  INSERT INTO automation_triggers (id, org_id, name, category, event_type, binding_kind, block_id, enabled, created_by_id, created_at, updated_at)
  VALUES (gen_random_uuid()::text, v_org_id, 'TEST — Chỉ kết bạn', 'general', 'manual_run', 'block', v_block_kb, true, v_user_id, NOW(), NOW());

  INSERT INTO automation_triggers (id, org_id, name, category, event_type, binding_kind, block_id, enabled, created_by_id, created_at, updated_at)
  VALUES (gen_random_uuid()::text, v_org_id, 'TEST — Chỉ gửi text', 'general', 'manual_run', 'block', v_block_text, true, v_user_id, NOW(), NOW());

  RAISE NOTICE 'All TEST triggers created';
END $$;

-- Verify
SELECT 'BLOCKS' as kind, name FROM blocks WHERE name LIKE 'TEST — %' ORDER BY name;
SELECT 'SEQUENCE' as kind, name FROM automation_sequences WHERE name LIKE 'TEST — %';
SELECT 'TRIGGERS' as kind, name FROM automation_triggers WHERE name LIKE 'TEST — %' ORDER BY name;
SELECT 'CONTACT' as kind, full_name, phone_normalized FROM contacts WHERE source = 'phase7-test-overnight';
