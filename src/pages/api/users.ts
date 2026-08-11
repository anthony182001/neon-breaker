// src/pages/api/users.ts
import type { APIRoute } from 'astro';
import { db } from '../../libs/db';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email, name } = await request.json();

    if (!email || !name) {
      return new Response(JSON.stringify({ error: 'Email y nombre son requeridos' }), { status: 400 });
    }

    // 1. Buscar si el usuario ya existe
    const existing = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email]
    });

    if (existing.rows.length > 0) {
      const u = existing.rows[0];
      return new Response(
        JSON.stringify({ id: u.id, name: u.name, email: u.email }), 
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Si no existe, crearlo
    const inserted = await db.execute({
      sql: 'INSERT INTO users (email, name) VALUES (?, ?) RETURNING *',
      args: [email, name]
    });

    const newUser = inserted.rows[0];
    return new Response(
      JSON.stringify({ id: newUser.id, name: newUser.name, email: newUser.email }), 
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error en /api/users:', error);
    return new Response(JSON.stringify({ error: 'Error al procesar el usuario' }), { status: 500 });
  }
};