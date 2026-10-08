import React from 'react';

import { TaskManagerCard } from '../../components/TaskManagerCard';

export default function TaskManagerPage(): React.JSX.Element {
  return (
    <main className="min-h-screen bg-[#F7FAFC] px-4 py-8 text-[#0F172A] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl">
        <header className="mb-8 text-center sm:mb-10">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Personal Task Manager</h1>
          <p className="mt-2 text-sm text-[#475569]">Local-only. Nothing leaves this browser.</p>
        </header>
        <TaskManagerCard />
      </div>
    </main>
  );
}
