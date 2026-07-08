import { Role } from '@mold-tracker/shared';

export default function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="rounded-xl bg-white p-8 shadow-md">
        <h1 className="text-2xl font-bold text-slate-800">Mold Tracker</h1>
        <p className="mt-2 text-slate-600">
          Scaffold siap. Role: {Object.values(Role).join(', ')}
        </p>
      </div>
    </main>
  );
}
