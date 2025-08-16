import { Button } from "@bigmoves/bff/components";

export function NotFoundPage() {
  return (
    <div class="h-full flex items-center justify-center">
      <div class="bg-white p-8 max-w-md w-full text-center">
        <div class="mb-6">
          <h1 class="text-6xl font-bold">404</h1>
          <div class="w-16 h-1 mx-auto my-4"></div>
          <h2 class="text-2xl font-semibold text-gray-800">
            Page Not Found
          </h2>
        </div>

        <p class="text-gray-600 mb-8">
          The page you are looking for might have been removed, had its name
          changed, or is temporarily unavailable.
        </p>

        <Button variant="primary" asChild>
          <a
            href="/"
            class="w-full sm:w-fit"
          >
            Return Home
          </a>
        </Button>
      </div>
    </div>
  );
}
