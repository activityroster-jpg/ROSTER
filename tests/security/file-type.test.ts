import { describe, it, expect } from "vitest";
import { sniffDocumentType } from "@/lib/security/file-type";

const bytes = (head: number[] | string, pad = 16) => {
  const arr = typeof head === "string" ? [...head].map((c) => c.charCodeAt(0)) : head;
  return new Uint8Array([...arr, ...new Array(Math.max(0, pad - arr.length)).fill(0)]);
};

describe("sniffDocumentType", () => {
  it("recognises PDF, PNG, JPEG and WebP by magic bytes", () => {
    expect(sniffDocumentType(bytes("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffDocumentType(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffDocumentType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffDocumentType(bytes("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });
  it("rejects HTML, scripts, SVG and anything too short — whatever the client claimed", () => {
    expect(sniffDocumentType(bytes("<!doctype html><script>"))).toBeNull();
    expect(sniffDocumentType(bytes("<svg xmlns="))).toBeNull();
    expect(sniffDocumentType(bytes("%PDF", 4))).toBeNull();
    expect(sniffDocumentType(new Uint8Array(0))).toBeNull();
  });
});
