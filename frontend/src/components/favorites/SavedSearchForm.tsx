import { useState } from 'react';
import type { SavedSearchFilters } from '../../types/api';

type SavedSearchFormProps = {
  query: string;
  filters: SavedSearchFilters;
  saving: boolean;
  onQueryChange: (value: string) => void;
  onFiltersChange: (updater: (current: SavedSearchFilters) => SavedSearchFilters) => void;
  onSave: () => void;
};

export default function SavedSearchForm({
  query,
  filters,
  saving,
  onQueryChange,
  onFiltersChange,
  onSave,
}: SavedSearchFormProps) {
  const [custom, setCustom] = useState(false);
  const invalidRange = Boolean(
    filters.date_from && filters.date_to && filters.date_from > filters.date_to
  );
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface-muted p-4">
      <div className="text-xs uppercase tracking-[0.24em] text-subtle">Save current search</div>
      <label className="block text-sm text-muted">
        Query
        <input
          name="query"
          autoComplete="off"
          className="form-control mt-1"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Enter a search term"
        />
      </label>
      <label className="block text-sm text-muted">
        Date range
        <select
          aria-label="Saved search date range"
          className="form-control mt-1"
          value={
            filters.date_range ??
            (custom || filters.date_from || filters.date_to ? 'custom' : 'all')
          }
          onChange={(event) => {
            setCustom(event.target.value === 'custom');
            onFiltersChange((current) => ({
              ...current,
              date_range:
                event.target.value === 'past_7_days' || event.target.value === 'past_30_days'
                  ? event.target.value
                  : undefined,
              date_from: undefined,
              date_to: undefined,
            }));
          }}
        >
          <option value="all">All dates</option>
          <option value="past_7_days">Past 7 days</option>
          <option value="past_30_days">Past 30 days</option>
          <option value="custom">Custom range</option>
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-muted">
          From date
          <input
            name="date_from"
            className="form-control mt-1"
            type="date"
            disabled={Boolean(filters.date_range)}
            value={filters.date_from ?? ''}
            onChange={(event) =>
              onFiltersChange((current) => ({
                ...current,
                date_from: event.target.value || undefined,
              }))
            }
          />
        </label>
        <label className="block text-sm text-muted">
          To date
          <input
            name="date_to"
            className="form-control mt-1"
            type="date"
            disabled={Boolean(filters.date_range)}
            value={filters.date_to ?? ''}
            onChange={(event) =>
              onFiltersChange((current) => ({
                ...current,
                date_to: event.target.value || undefined,
              }))
            }
          />
        </label>
      </div>
      {invalidRange && (
        <p role="alert" className="text-sm text-danger">
          From date must be before or equal to To date.
        </p>
      )}
      <button
        type="button"
        className="btn w-full"
        onClick={onSave}
        disabled={saving || !query.trim() || invalidRange}
      >
        {saving ? 'Saving…' : 'Save search'}
      </button>
    </div>
  );
}
