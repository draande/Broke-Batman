import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  ScanLine,
  ChartNoAxesCombined,
  Layers,
  Crosshair,
} from "lucide-react";
import { Mark } from "@/components/ui";
export default function Landing() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <Link href="/" className="brand">
          <Mark />
          <span>
            BROKE BATMAN<small>JOB SEARCH COMMAND CENTER</small>
          </span>
        </Link>
        <Link href="/login" className="button secondary">
          Enter the Batcave <ArrowUpRight size={16} />
        </Link>
      </nav>
      <section className="hero">
        <div className="eyebrow">
          <span className="signal" /> YOUR NEXT CHAPTER STARTS HERE
        </div>
        <h1>
          Saving Gotham.
          <br />
          <span>Seeking employment.</span>
        </h1>
        <p className="hero-tag">Gotham isn&apos;t paying the bills.</p>
        <p>
          A job application command center for people whose biggest villain is
          the hiring market.
        </p>
        <div className="hero-buttons">
          <Link className="button" href="/register">
            Enter the Batcave <ArrowRight size={18} />
          </Link>
          <Link href="/login?demo=1" className="button secondary">
            View Demo <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="hero-foot">
          <ShieldCheck size={16} /> Private by design. Built for the long game.
        </div>
      </section>
      <section className="preview">
        <div className="preview-top">
          <span>
            <Mark size={22} /> BATCOMPUTER
          </span>
          <span className="eyebrow">
            SYSTEM ONLINE <i className="signal" />
          </span>
        </div>
        <div className="preview-content">
          <div>
            <div className="eyebrow">MISSION CONTROL</div>
            <h2>Good evening, Bruce.</h2>
            <p>The next opportunity is out there.</p>
            <div className="preview-metrics">
              <div>
                <small>ACTIVE CASES</small>
                <strong>24</strong>
              </div>
              <div>
                <small>INTERVIEWS</small>
                <strong>8</strong>
              </div>
              <div>
                <small>OFFERS</small>
                <strong className="gold">2</strong>
              </div>
            </div>
          </div>
          <div className="radar-art">
            <Crosshair size={128} strokeWidth={0.6} />
            <span className="radar-dot one" />
            <span className="radar-dot two" />
          </div>
        </div>
        <div className="preview-pipeline">
          {["Saved", "Applied", "Interviewing", "Offer"].map((s, i) => (
            <div key={s}>
              <span>0{i + 1}</span>
              <strong>{s}</strong>
              <div style={{ width: `${90 - i * 18}%` }} />
            </div>
          ))}
        </div>
      </section>
      <section className="feature-grid">
        {[
          {
            Icon: Layers,
            title: "Track Every Case",
            text: "Every role, note, contact, and next step. One clear picture of your search.",
          },
          {
            Icon: ScanLine,
            title: "Analyze Job Postings",
            text: "Turn a link or job description into a case. Review the details before saving.",
          },
          {
            Icon: Crosshair,
            title: "Master the Hiring Pipeline",
            text: "Move cases from saved to signed. Keep interviews and follow-ups on your radar.",
          },
          {
            Icon: ChartNoAxesCombined,
            title: "Batcomputer Intelligence",
            text: "Know what gets responses. Find the patterns behind your next opportunity.",
          },
        ].map(({ Icon, title, text }) => (
          <article className="panel" key={title}>
            <Icon className="gold" size={25} />
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </section>
      <footer className="landing-footer">
        <span>BROKE BATMAN © {new Date().getFullYear()}</span>
        <span>
          An independent, original vigilante-inspired project. No affiliation
          with DC.
        </span>
      </footer>
    </main>
  );
}
