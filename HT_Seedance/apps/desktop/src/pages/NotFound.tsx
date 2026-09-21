import React from 'react'; import { Link } from 'react-router-dom'; import { SearchX } from 'lucide-react';
export const NotFoundPage: React.FC = () => <div className="not-found"><SearchX size={38} /><strong>404</strong><h1>Page not found</h1><p>The requested desktop route does not exist.</p><Link className="button primary" to="/dashboard">Return to dashboard</Link></div>;
