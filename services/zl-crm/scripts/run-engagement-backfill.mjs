// Node 20 has global fetch; jsonwebtoken is a backend dep
import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET || 'devsecret-changeme-min-32-chars-long-please';
const token = jwt.sign(
  { userId: '55ae009c-4d3a-4775-937d-e765f5af7ff7', orgId: '50d7a1a4-5eec-42f3-a077-0ef7770d834c', role: 'owner' },
  secret,
  { expiresIn: '5m' }
);

const res = await fetch('http://localhost:3000/api/v1/admin/engagement/backfill', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
  body: JSON.stringify({ days: 28 })
});
console.log('Status:', res.status);
console.log('Body:', await res.text());
