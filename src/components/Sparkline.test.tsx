import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Sparkline } from "./Sparkline";

describe("Sparkline", () => {
  test("renders the smooth style by default and drops non-finite points", () => {
    const html = renderToStaticMarkup(<Sparkline values={[1, Number.NaN, 3]} />);

    expect(html).toContain('data-chart-style="smooth"');
    expect(html).toContain("M0.00,30.00 L100.00,2.00");
    expect(html).toContain('aria-hidden="true"');
  });

  test("renders the dither canvas when explicitly selected", () => {
    const html = renderToStaticMarkup(<Sparkline values={[1, 2, 3]} chartStyle="dither" className="h-10" />);

    expect(html).toContain("<canvas");
    expect(html).toContain('data-chart-style="dither"');
    expect(html).toContain('class="block h-10"');
    expect(html).toContain('class="block size-full"');
    expect(html).toContain("image-rendering:pixelated");
  });

  test("keeps dense smooth bar widths positive", () => {
    const html = renderToStaticMarkup(<Sparkline values={Array.from({ length: 240 }, (_, index) => index)} variant="bars" />);
    const widths = [...html.matchAll(/<rect[^>]*width="([^"]+)"/g)].map((match) => Number(match[1]));

    expect(widths).toHaveLength(240);
    expect(widths.every((width) => width > 0)).toBe(true);
  });

  test("renders nothing when a series has too few usable points", () => {
    expect(renderToStaticMarkup(<Sparkline values={[1]} />)).toBe("");
    expect(renderToStaticMarkup(<Sparkline values={[]} variant="bars" />)).toBe("");
  });
});
