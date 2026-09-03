import { strToU8, zipSync } from "fflate";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("../app/lib/utils/image-resize", () => ({
  resizeImage: vi.fn(async (dataUrl: string) => ({
    dataUrl,
    width: 1200,
    height: 800,
  })),
}));

import { parseInstagramExport } from "../app/lib/utils/instagram-import";

class TestFileReader {
  result: string | ArrayBuffer | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  readAsDataURL(): void {
    this.result = "data:image/jpeg;base64,AQID";
    this.onload?.();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseInstagramExport", () => {
  test("reads the timestamp and caption from media in current Instagram exports", async () => {
    vi.stubGlobal("FileReader", TestFileReader);

    const posts = [
      {
        media: [
          {
            uri: "media/posts/example.jpg",
            creation_timestamp: 1_687_546_424,
            title: "A summer photo",
          },
        ],
      },
    ];
    const zip = zipSync({
      "your_instagram_activity/media/posts_1.json": strToU8(JSON.stringify(posts)),
      "media/posts/example.jpg": new Uint8Array([1, 2, 3]),
    });
    const file = {
      arrayBuffer: async () => zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength),
    } as File;

    const [parsed] = await parseInstagramExport(file);

    expect(parsed.createdAt.toISOString()).toBe("2023-06-23T18:53:44.000Z");
    expect(parsed.description).toBe("A summer photo");
  });
});
