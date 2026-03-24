import React from 'react';
import DropBadge from './DropBadge';

export default function PropertyPopup({ property, onViewDetails, onAddToToday, onMarkDoNotDrop }) {
  const {
    address_street,
    address_city,
    address_zip,
    owner_name,
    campaign_status,
    flyer_drops_completed = 0,
    flyer_drops_total = 4,
    lead_source,
    next_drop_date
  } = property;

  return (
    <div className="min-w-[240px]">
      <h3 className="font-semibold text-slate-900 text-sm">{address_street}</h3>
      <p className="text-xs text-slate-500">{address_city}, TX {address_zip}</p>

      {owner_name && (
        <p className="text-xs text-slate-600 mt-1">Owner: {owner_name}</p>
      )}

      <div className="mt-2 flex items-center gap-2">
        <DropBadge
          current={flyer_drops_completed}
          total={flyer_drops_total}
          status={campaign_status}
        />
      </div>

      <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
        <span className="capitalize">{(lead_source || '').replace(/_/g, ' ')}</span>
        {next_drop_date && (
          <span>Next: {new Date(next_drop_date).toLocaleDateString()}</span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onViewDetails && onViewDetails(property)}
          className="px-2.5 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          View Details
        </button>
        <button
          onClick={() => onAddToToday && onAddToToday(property)}
          className="px-2.5 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          Add to Today
        </button>
        <button
          onClick={() => onMarkDoNotDrop && onMarkDoNotDrop(property)}
          className="px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
        >
          Do Not Drop
        </button>
      </div>
    </div>
  );
}
