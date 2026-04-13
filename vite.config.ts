import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineServiceConfig } from "@convstack/service-sdk/vite";
import { defineConfig } from "vite";

export default defineConfig(
	defineServiceConfig({
		slug: "schedule",
		port: 5050,
		plugins: [
			tailwindcss(),
			tanstackStart({ srcDirectory: "src" }),
			viteReact(),
		],
	}),
);
