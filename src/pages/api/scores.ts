// src/pages/api/scores.ts
import type { APIRoute } from 'astro';
import { db } from '../../libs/db.ts';

export const prerender = false; // 👈 OBLIGATORIO PARA PERMITIR POST

export const POST: APIRoute = async ({ request }) => {
  try {
    const { userId, score, levelReached } = await request.json();

    if (!userId || score === undefined) {
      return new Response(JSON.stringify({ error: 'Faltan datos requeridos' }), { status: 400 });
    }

    await db.execute({
      sql: 'INSERT INTO scores (user_id, score, level_reached) VALUES (?, ?, ?)',
      args: [userId, score, levelReached || 1]
    });

    return new Response(JSON.stringify({ success: true }), { status: 201 });
  } catch (error) {
    console.error('Error en /api/scores:', error);
    return new Response(JSON.stringify({ error: 'Error guardando puntaje' }), { status: 500 });
  }
};