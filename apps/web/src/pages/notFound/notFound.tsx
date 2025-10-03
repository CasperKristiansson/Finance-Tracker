import React from "react";

export const NotFound: React.FC = () => {
  return (
    <div className="mx-auto flex size-full max-w-3xl flex-col">
      <header className="z-50 mb-auto flex w-full justify-center py-4">
        <h2 className="mt-1 text-4xl font-bold text-white sm:mt-3 sm:text-6xl">
          <span className="bg-linear-to-tr from-blue-600 to-purple-400 bg-clip-text text-transparent">
            Finance Tracker
          </span>
        </h2>
      </header>
      <main id="content">
        <div className="flex min-h-[calc(100vh-200px)] flex-col justify-center px-4 py-10 text-center sm:px-6 lg:px-8">
          <h1 className="block text-7xl font-bold text-gray-800 sm:text-9xl">
            404
          </h1>
          <p className="mt-3 text-gray-600">Oops, something went wrong.</p>
          <p className="text-gray-600">
            Sorry, we couldn&apos;t find your page.
          </p>
          <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
            <a
              className="inline-flex w-full items-center justify-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:bg-blue-700 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
              href="/"
            >
              <svg
                className="size-4 shrink-0"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              Back to home
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};
