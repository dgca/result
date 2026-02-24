import { describe, expect, it } from "vitest";
import { result } from "./index";

describe("result", () => {
  describe("sync", () => {
    it("returns data on success", () => {
      const { data, error } = result(() => 42);

      expect(data).toBe(42);
      expect(error).toBeNull();
    });

    it("returns error when an Error is thrown", () => {
      const { data, error } = result((): string => {
        throw new Error("sync error");
      });

      expect(data).toBeNull();
      expect(error).toBeInstanceOf(Error);
      expect(error!.message).toBe("sync error");
    });

    it("wraps non-Error throws in an Error", () => {
      const { data, error } = result((): string => {
        throw "string error";
      });

      expect(data).toBeNull();
      expect(error).toBeInstanceOf(Error);
      expect(error!.message).toBe("string error");
    });
  });

  describe("async", () => {
    it("returns data on success", async () => {
      const { data, error } = await result(async () => 42);

      expect(data).toBe(42);
      expect(error).toBeNull();
    });

    it("returns error when an Error is thrown", async () => {
      const { data, error } = await result(async (): Promise<string> => {
        throw new Error("async error");
      });

      expect(data).toBeNull();
      expect(error).toBeInstanceOf(Error);
      expect(error!.message).toBe("async error");
    });

    it("wraps non-Error rejections in an Error", async () => {
      const { data, error } = await result(async (): Promise<string> => {
        throw "string rejection";
      });

      expect(data).toBeNull();
      expect(error).toBeInstanceOf(Error);
      expect(error!.message).toBe("string rejection");
    });
  });

  describe("type narrowing", () => {
    it("narrows data type after checking error", () => {
      const res = result(() => "hello");

      if (res.error) {
        // In the error branch, data should be null
        const _check: null = res.data;
        expect(_check).toBeNull();
      } else {
        // In the success branch, data should be string
        const _check: string = res.data;
        expect(_check).toBe("hello");
      }
    });
  });
});
