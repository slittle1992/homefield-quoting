import React from 'react';

const statusColors = {
  not_started: 'bg-slate-100 text-slate-700',
  flyer_in_progress: 'bg-orange-100 text-orange-700',
  flyer_complete: 'bg-green-100 text-green-700',
  mailer_in_progress: 'bg-blue-100 text-blue-700',
  mailer_complete: 'bg-blue-100 text-blue-700',
  converted: 'bg-emerald-100 text-emerald-700',
  do_not_drop: 'bg-red-100 text-red-700'
};

export default function DropBadge({ current, total, status = 'not_started' }) {
  const colorClass = statusColors[status] || statusColors.not_started;
  const progress = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
      <span>Drop {current}/{total}</span>
      <div className="w-8 h-1.5 bg-black/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-current rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
