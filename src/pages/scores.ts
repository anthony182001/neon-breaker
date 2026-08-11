import type { APIRoute } from 'astro';

// Récords iniciales en memoria
let topScores = [
  { name: 'Josué_Dev', score: 1200 },
  { name: 'Astro_Master', score: 850 },
  { name: 'Player_1', score: 500 }
];

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify(topScores), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    if (data.name && typeof data.score === 'number') {
      topScores.push({ name: data.name, score: data.score });
      topScores.sort((a, b) => b.score - a.score);
      topScores = topScores.slice(0, 5); // Mantener el Top 5

      return new Response(JSON.stringify({ success: true, topScores }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'Datos no válidos' }), { status: 400 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error en servidor' }), { status: 500 });
  }
};