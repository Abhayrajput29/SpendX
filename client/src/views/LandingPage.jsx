import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  Check,
  Moon,
  PiggyBank,
  Receipt,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';

const features = [
  {
    icon: Receipt,
    number: '01',
    title: 'Know where it goes',
    description: 'Record expenses in seconds and see your spending clearly, all in one calm, organized place.',
  },
  {
    icon: PiggyBank,
    number: '02',
    title: 'Budgets that make sense',
    description: 'Set practical category limits, keep an eye on progress, and adjust as life changes.',
  },
  {
    icon: Target,
    number: '03',
    title: 'Make room for your goals',
    description: 'Turn the things you care about into savings targets you can track month by month.',
  },
  {
    icon: Sparkles,
    number: '04',
    title: 'Insights with a point',
    description: 'AI-powered summaries help surface patterns and offer clear, useful next steps.',
  },
];

const steps = [
  { number: '01', title: 'Track the everyday', text: 'Add purchases as they happen or review your transactions when it suits you.' },
  { number: '02', title: 'Shape your plan', text: 'Create budgets and savings goals around the priorities that matter to you.' },
  { number: '03', title: 'Move forward', text: 'Use simple reports and helpful insights to make your next money decision.' },
];

export default function LandingPage({ darkMode, onToggleDark }) {
  return (
    <div className="landing-page">
      <header className="landing-nav landing-shell">
        <Link to="/" className="landing-nav-brand" aria-label="SpendX home">
          <span className="landing-nav-mark"><BrandMark className="landing-brand-svg" /></span>
          <span>Spend<span className="landing-brand-x">X</span></span>
        </Link>

        <nav className="landing-nav-links" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
        </nav>

        <div className="landing-nav-actions">
          {onToggleDark && (
            <button
              type="button"
              className="landing-theme-toggle"
              onClick={onToggleDark}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          )}
          <Link to="/login" className="landing-signin">Sign in</Link>
          <Link to="/register" className="landing-button landing-button-small">
            Sign up <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main>
        <section className="landing-hero landing-shell" aria-labelledby="landing-title">
          <div className="landing-hero-glow" aria-hidden="true" />
          <p className="landing-eyebrow"><span className="landing-eyebrow-dot" /> A clearer way to manage your money</p>

          <div className="landing-hero-brand" aria-label="SpendX">
            <span className="landing-hero-mark"><BrandMark className="landing-brand-svg" /></span>
            <span className="landing-hero-wordmark">Spend<span className="landing-brand-x">X</span></span>
          </div>

          <h1 id="landing-title">Feel good about <span>every rupee.</span></h1>
          <p className="landing-hero-copy">
            SpendX brings your expenses, budgets, and savings goals together—so you can spend with more clarity and plan what comes next.
          </p>

          <div className="landing-hero-actions">
            <Link to="/dashboard" className="landing-button landing-button-primary">
              Get started <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link to="/register" className="landing-button landing-button-secondary">
              Create your free account
            </Link>
          </div>

          <div className="landing-proof-row" aria-label="SpendX highlights">
            <span><Check size={15} aria-hidden="true" /> Your finances, in one view</span>
            <span><Check size={15} aria-hidden="true" /> Built for everyday decisions</span>
            <span><Check size={15} aria-hidden="true" /> Start with a guest preview</span>
          </div>

          <a href="#features" className="landing-scroll-link">
            Explore SpendX <ArrowDown size={15} aria-hidden="true" />
          </a>
        </section>

        <section className="landing-features landing-shell" id="features" aria-labelledby="features-title">
          <div className="landing-section-heading">
            <p className="landing-eyebrow">Everything in its place</p>
            <h2 id="features-title">A little more clarity.<br /><span>A lot more control.</span></h2>
            <p>Simple tools for the real-life money decisions you make every day.</p>
          </div>

          <div className="landing-feature-grid">
            {features.map(({ icon: Icon, number, title, description }) => (
              <article className="landing-feature-card" key={number}>
                <div className="landing-feature-card-top">
                  <span className="landing-feature-icon"><Icon size={21} strokeWidth={1.8} aria-hidden="true" /></span>
                  <span className="landing-feature-number">{number}</span>
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
                <span className="landing-feature-rule" aria-hidden="true" />
              </article>
            ))}
          </div>
        </section>

        <section className="landing-how landing-shell" id="how-it-works" aria-labelledby="how-title">
          <div className="landing-how-intro">
            <p className="landing-eyebrow">Simple by design</p>
            <h2 id="how-title">Small steps.<br /><span>Steadier progress.</span></h2>
            <p>Start with what you know. SpendX helps make the bigger picture easier to see.</p>
            <Link to="/dashboard" className="landing-inline-link">Explore the dashboard <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
          <div className="landing-steps">
            {steps.map((step) => (
              <div className="landing-step" key={step.number}>
                <span className="landing-step-number">{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
                <TrendingUp className="landing-step-icon" size={19} aria-hidden="true" />
              </div>
            ))}
          </div>
        </section>

        <section className="landing-cta landing-shell" aria-labelledby="landing-cta-title">
          <div className="landing-cta-inner">
            <span className="landing-cta-sparkle"><Sparkles size={20} aria-hidden="true" /></span>
            <p className="landing-cta-eyebrow">Your next step starts here</p>
            <h2 id="landing-cta-title">Make your money<br />feel more manageable.</h2>
            <p>Build a clearer picture of your finances, one small step at a time.</p>
            <div className="landing-cta-actions">
              <Link to="/register" className="landing-button landing-button-primary">
                Sign up for SpendX <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link to="/dashboard" className="landing-cta-guest">Take a look around first</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer landing-shell">
        <Link to="/" className="landing-nav-brand" aria-label="SpendX home">
          <span className="landing-nav-mark"><BrandMark className="landing-brand-svg" /></span>
          <span>Spend<span className="landing-brand-x">X</span></span>
        </Link>
        <p>More clarity for the money you manage every day.</p>
        <nav className="landing-footer-links" aria-label="Footer navigation">
          <a href="#features">Features</a>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/login">Sign in</Link>
          <Link to="/register">Sign up</Link>
        </nav>
        <span className="landing-copyright">© {new Date().getFullYear()} SpendX</span>
      </footer>
    </div>
  );
}
