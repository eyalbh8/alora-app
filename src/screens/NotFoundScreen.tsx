import { Link } from 'react-router-dom'

export function NotFoundScreen() {
  return (
    <div className="placeholder-page">
      <div>
        <p className="eyebrow">404 — page not found</p>
        <h1>This page is not here.</h1>
        <p>The route you requested does not exist in Alora. Return to the dashboard or open another screen.</p>
        <div className="placeholder-page__actions">
          <Link to="/" className="button button--primary">
            <span>Back to dashboard</span>
            <span aria-hidden="true">→</span>
          </Link>
          <Link to="/prompts" className="internal-link">
            Prompts
            <span aria-hidden="true">→</span>
          </Link>
          <Link to="/mentions" className="internal-link">
            Mentions
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
