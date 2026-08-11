// src/pages/api/leaderboard.ts
import type { APIRoute } from 'astro';
import { db } from '../../libs/db.ts';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const result = await db.execute(`
      SELECT 
        u.name, 
        MAX(s.score) AS max_score, 
        MAX(s.level_reached) AS max_level
      FROM scores s
      JOIN users u ON s.user_id = u.id
      GROUP BY u.id
      ORDER BY max_score DESC
      LIMIT 10
    `);

    return new Response(JSON.stringify(result.rows), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error al consultar leaderboard:', error);
    return new Response(JSON.stringify({ error: 'Error al obtener leaderboard' }), { status: 500 });
  }
};