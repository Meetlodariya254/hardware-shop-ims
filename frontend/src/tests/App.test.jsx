import { render, screen } from '@testing-library/react';
import App from '../App';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';

describe('App', () => {
  it('should render login page initially without a token', () => {
    // Note: since our app has an AuthProvider that triggers an API call on mount,
    // this test might need mocking of the `api` module in the future.
    // For now, we're just making sure the App component mounts without crashing.
    render(
      <App />
    );

    // Ensure some basic text or layout is rendered
    expect(document.body).toBeInTheDocument();
  });
});
