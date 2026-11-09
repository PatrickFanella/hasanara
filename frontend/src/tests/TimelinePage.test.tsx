import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import TimelinePage from '../routes/TimelinePage';

function Destination() {
  const location = useLocation();
  return (
    <p>
      {location.pathname}
      {location.search}
    </p>
  );
}
it('keeps the old timeline URL working through Explore month browsing', async () => {
  render(
    <MemoryRouter initialEntries={['/timeline']}>
      <Routes>
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/explore" element={<Destination />} />
      </Routes>
    </MemoryRouter>
  );
  expect(await screen.findByText('/explore?kind=month')).toBeInTheDocument();
});
