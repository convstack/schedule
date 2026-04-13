import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: IndexPage,
});

function IndexPage() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="space-y-2 text-center">
				<h1 className="text-2xl font-bold">Schedule</h1>
				<p className="text-sm">Schedule service is running.</p>
			</div>
		</div>
	);
}
