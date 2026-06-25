import { createFileRoute } from "@tanstack/react-router";
import { PixelRunner } from "../components/game/PixelRunner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pixel Runner — Endless Space Runner" },
      { name: "description", content: "A retro pixel-art sci-fi endless runner. Jump, slide, and chase the high score." },
      { property: "og:title", content: "Pixel Runner — Endless Space Runner" },
      { property: "og:description", content: "A retro pixel-art sci-fi endless runner. Jump, slide, and chase the high score." },
    ],
  }),
  component: Index,
});

function Index() {
  return <PixelRunner />;
}
