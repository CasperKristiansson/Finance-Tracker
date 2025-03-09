import React from "react";

export const Accounts: React.FC = () => {
  return (
    <div className="mx-auto flex size-full max-w-3xl flex-col">
      <header className="z-50 mb-auto flex w-full justify-center py-4">
        <h2 className="mt-1 text-4xl font-bold text-white sm:mt-3 sm:text-6xl">
          <span className="bg-linear-to-tr from-blue-600 to-purple-400 bg-clip-text text-transparent">
            Accounts
          </span>
        </h2>
      </header>
    </div>
  );
};
