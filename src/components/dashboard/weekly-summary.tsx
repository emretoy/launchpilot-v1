"use client";

export function WeeklySummary({
  pendingTasks,
  unscannedSites,
}: {
  pendingTasks: number;
  unscannedSites: number;
}) {
  if (pendingTasks === 0 && unscannedSites === 0) return null;

  const parts: string[] = [];
  if (pendingTasks > 0) parts.push(`${pendingTasks} görev bekliyor`);
  if (unscannedSites > 0) parts.push(`${unscannedSites} site taranmadı`);

  return (
    <div className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-sm text-blue-800">
      <span className="font-medium">Bu Hafta:</span> {parts.join(" · ")}
    </div>
  );
}
