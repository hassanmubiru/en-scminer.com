import { useState } from 'react';
import './ChatWidget.css';

const CHANNELS = [
  {
    id: 'zangi',
    label: 'Zangi: 2293029443',
    url: 'https://zangi.com',
    color: '#6C3FCF',
    icon: (
      <svg width="22" height="22" viewBox="0 0 39 39" fill="none">
        <circle cx="19.44" cy="19.44" r="19.44" fill="#6C3FCF" />
        <path d="M10 14h19v11H10z" stroke="#fff" strokeWidth="1.5" fill="none" rx="2" />
        <path d="M10 14l9.5 7 9.5-7" stroke="#fff" strokeWidth="1.5" fill="none" />
      </svg>
    ),
  },
  {
    id: 'email',
    label: 'Email Us',
    url: 'mailto:scminerantminer@gmail.com',
    color: '#E05C3A',
    icon: (
      <svg width="22" height="22" viewBox="0 0 39 39" fill="none">
        <circle cx="19.44" cy="19.44" r="19.44" fill="#E05C3A" />
        <rect x="9" y="13" width="21" height="13" rx="2" stroke="#fff" strokeWidth="1.5" fill="none" />
        <path d="M9 13l10.5 8L30 13" stroke="#fff" strokeWidth="1.5" fill="none" />
      </svg>
    ),
  },
  {
    id: 'contact',
    label: 'Contact Us',
    url: '/contact-us',
    color: '#A886CD',
    icon: (
      <svg width="22" height="22" viewBox="0 0 39 39" fill="none">
        <circle cx="19.44" cy="19.44" r="19.44" fill="#A886CD" />
        <path d="M12 14h15v11H12z" stroke="#fff" strokeWidth="1.5" fill="none" rx="2" />
        <path d="M12 14l7.5 7 7.5-7" stroke="#fff" strokeWidth="1.5" fill="none" />
      </svg>
    ),
  },
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className={`chat-widget${open ? ' chat-open' : ''}`} aria-label="Contact options">
      {/* Channel buttons — shown when open */}
      <div className="chat-channels" role="menu">
        {CHANNELS.map((c) => (
          <a
            key={c.id}
            href={c.url}
            className="chat-channel"
            target={c.url.startsWith('http') ? '_blank' : undefined}
            rel={c.url.startsWith('http') ? 'noopener noreferrer' : undefined}
            aria-label={c.label}
            role="menuitem"
            tabIndex={open ? 0 : -1}
            onClick={c.id === 'contact' ? () => setOpen(false) : undefined}
          >
            <span className="chat-channel-icon">{c.icon}</span>
            <span className="chat-channel-label">{c.label}</span>
          </a>
        ))}
      </div>

      {/* Toggle button */}
      <button
        className="chat-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Close contact options' : 'Open contact options'}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        <span className="chat-toggle-label">Contact us</span>
      </button>
    </div>
  );
}
