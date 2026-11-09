import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { resolveDateRange } from '../features/search/dateRange';
import SavedSearchItem from '../components/favorites/SavedSearchItem';
import SavedSearchForm from '../components/favorites/SavedSearchForm';
import type { SavedSearchFilters } from '../types/api';

it('resolves rolling dates at reopen across month and year boundaries', () => {
  expect(
    resolveDateRange({ date_range: 'past_7_days' }, new Date('2026-01-03T12:00:00Z'))
  ).toMatchObject({ date_from: '2025-12-28', date_to: '2026-01-03' });
  expect(
    resolveDateRange({ date_range: 'past_30_days' }, new Date('2026-03-01T12:00:00Z'))
  ).toMatchObject({ date_from: '2026-01-31', date_to: '2026-03-01' });
  const fixed = { date_from: '2025-01-01', date_to: '2025-02-01' };
  expect(resolveDateRange(fixed)).toEqual(fixed);
  render(
    <MemoryRouter>
      <SavedSearchItem
        saved={{ id: 'saved', query: 'housing', filters: { date_range: 'past_7_days' } }}
        onDelete={() => {}}
      />
    </MemoryRouter>
  );
  const url = new URL(
    screen.getByRole('link', { name: 'Reopen search' }).getAttribute('href')!,
    'https://example.test'
  );
  expect(url.searchParams.has('date_range')).toBe(false);
  expect(url.searchParams.get('date_to')).toBe(new Date().toISOString().slice(0, 10));
});
it('switches between rolling and custom dates, and rejects a reversed range', () => {
  function Form() {
    const [filters, setFilters] = useState<SavedSearchFilters>({});
    return (
      <SavedSearchForm
        query="housing"
        filters={filters}
        onFiltersChange={setFilters}
        onQueryChange={() => {}}
        saving={false}
        onSave={() => {}}
      />
    );
  }
  render(<Form />);
  fireEvent.change(screen.getByLabelText('Saved search date range'), {
    target: { value: 'past_7_days' },
  });
  expect(screen.getByLabelText('From date')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Saved search date range'), {
    target: { value: 'custom' },
  });
  expect(screen.getByLabelText('Saved search date range')).toHaveValue('custom');
  fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-05-31' } });
  fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-05-01' } });
  expect(screen.getByRole('button', { name: 'Save search' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('From date must be before');
});
