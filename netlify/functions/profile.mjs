import { neon } from '@netlify/neon';
import { verifyToken } from './auth.mjs';

const sql = neon();

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS'
};

function getUser(req) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  return verifyToken(authHeader.replace('Bearer ', ''));
}

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers });
  }

  const user = getUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers });
  }

  try {
    // GET - fetch profile
    if (req.method === 'GET') {
      const [profile] = await sql`
        SELECT id, user_id, email, name, role, phone, shipping_address, city, state, zip_code, created_at
        FROM users WHERE id = ${user.id}
      `;
      if (!profile) return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers });
      return new Response(JSON.stringify(profile), { status: 200, headers });
    }

    // PUT - update profile
    if (req.method === 'PUT') {
      const body = await req.json();
      const { name, phone, shipping_address, city, state, zip_code } = body;
      const [updated] = await sql`
        UPDATE users SET
          name = COALESCE(${name || null}, name),
          phone = COALESCE(${phone !== undefined ? phone : null}, phone),
          shipping_address = COALESCE(${shipping_address !== undefined ? shipping_address : null}, shipping_address),
          city = COALESCE(${city !== undefined ? city : null}, city),
          state = COALESCE(${state !== undefined ? state : null}, state),
          zip_code = COALESCE(${zip_code !== undefined ? zip_code : null}, zip_code)
        WHERE id = ${user.id}
        RETURNING id, user_id, email, name, role, phone, shipping_address, city, state, zip_code, created_at
      `;
      if (!updated) return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers });
      return new Response(JSON.stringify({ success: true, user: updated }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  } catch (error) {
    console.error('Profile Error:', error);
    return new Response(JSON.stringify({ error: 'Server error: ' + error.message }), { status: 500, headers });
  }
};

export const config = { path: "/api/profile" };
