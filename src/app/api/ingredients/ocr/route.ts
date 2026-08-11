export async function POST() {
  return Response.json({
    success: false,
    error: 'OCR / photo recognition is intentionally disabled in AlcheMix 1.0. Use text search, local database, or manual ingredient-table input instead.',
  }, { status: 501 });
}
