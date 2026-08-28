export default async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  return new Response(JSON.stringify({
    ok: true,
    path: url.pathname,
    region: "Tokyo",
    time: new Date().toISOString()
  }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
};
