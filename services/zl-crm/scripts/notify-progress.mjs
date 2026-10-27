// Notify helper — gửi tin từ Thành Hs Holding (01aca680) → Thành Phạm (9156046202321533352)
// Dùng autonomous test loop cho Phase Phân Quyền + Phase Riêng Tư.
// Usage: docker exec zalo-crm-app node /app/notify-progress.mjs "Message text"
import jwt from 'jsonwebtoken';

const CONV_ID = '4a0c3291-904d-46b7-80eb-7b52b7ebd48d';
const USER_ID = '55ae009c-4d3a-4775-937d-e765f5af7ff7';
const ORG_ID = '50d7a1a4-5eec-42f3-a077-0ef7770d834c';

const secret = process.env.JWT_SECRET || 'devsecret-changeme-min-32-chars-long-please';
const token = jwt.sign(
  { userId: USER_ID, orgId: ORG_ID, role: 'owner' },
  secret,
  { expiresIn: '5m' }
);

const message = process.argv[2] || '(no message)';

const res = await fetch(`http://localhost:3000/api/v1/conversations/${CONV_ID}/messages`, {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: message })
});
const body = await res.text();
console.log('Notify status:', res.status);
if (res.status !== 200 && res.status !== 201) {
  console.log('Body:', body);
  process.exit(1);
}
console.log('✅ Sent');
