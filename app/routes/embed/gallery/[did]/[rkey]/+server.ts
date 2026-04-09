import type { RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ params, url }) => {
  const { did, rkey } = params;
  const galleryUrl = `/profile/${did}/gallery/${rkey}`;
  const ogImageUrl = `${url.origin}/og/profile/${did}/gallery/${rkey}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #fff; overflow: hidden; display: flex; align-items: center; justify-content: center; width: 100vw; height: 100vh; }
    a { display: flex; max-width: 100%; max-height: 100%; }
    img { max-width: 100%; max-height: 100vh; object-fit: contain; }
  </style>
</head>
<body>
  <a href="${galleryUrl}" target="_top">
    <img src="${ogImageUrl}" alt="Gallery" />
  </a>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "X-Frame-Options": "ALLOWALL",
      "Content-Security-Policy": "frame-ancestors *",
    },
  });
};
