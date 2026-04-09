import type { RequestHandler } from "@sveltejs/kit";

const DID_DOCUMENT = {
  "@context": ["https://www.w3.org/ns/did/v1"],
  id: "did:web:grain.social",
  service: [
    {
      id: "#mention_search",
      type: "MentionSearchService",
      serviceEndpoint: "https://grain.social",
    },
  ],
};

export const GET: RequestHandler = async () => {
  return new Response(JSON.stringify(DID_DOCUMENT, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
