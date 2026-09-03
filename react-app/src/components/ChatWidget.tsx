import { useState } from 'react';
import './ChatWidget.css';

const CHANNELS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    url: 'https://web.whatsapp.com/send?phone=17432011306',
    color: '#49E670',
    icon: (
      <svg width="22" height="22" viewBox="0 0 39 39" fill="none">
        <circle cx="19.44" cy="19.44" r="19.44" fill="#49E670" />
        <path d="M27.5 11.4a11.1 11.1 0 0 0-15.7 15.7l-1.8 5.5 5.7-1.8A11.1 11.1 0 0 0 27.5 11.4z" fill="#fff" />
        <path d="M23.7 21.3c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.2-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6c.1-.2.1-.3.2-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.1 1.1-1.1 2.6s1.1 3 1.3 3.2c.2.2 2.2 3.3 5.3 4.6.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.2-.7-.4z" fill="#49E670" />
      </svg>
    ),
  },
  {
    id: 'telegram',
    label: 'Telegram',
    url: 'https://telegram.me/scminersforall',
    color: '#3E99D8',
    icon: (
      <svg width="22" height="22" viewBox="0 0 39 39" fill="none">
        <circle cx="19.44" cy="19.44" r="19.44" fill="#3E99D8" />
        <path d="M8 19.5l3.5 1.3 1.3 4.2 2-2.5 4.3 3.2L23.5 11 8 19.5z" fill="#fff" />
        <path d="M11.5 20.8l.8 4.2 2-2.5" fill="#ddd" />
      </svg>
    ),
  },
  {
    id: 'phone',
    label: 'Phone',
    url: 'tel:+14245133056',
    color: '#03E78B',
    icon: (
      <svg width="22" height="22" viewBox="0 0 39 39" fill="none">
        <circle cx="19.44" cy="19.44" r="19.44" fill="#03E78B" />
        <path d="M26 24.9c-.3-.3-.8-.5-1.3-.6-.6-.2-1.6-.7-1.8-.8-.2-.1-.4-.1-.6.1l-1 1.1c-.2.2-.4.2-.6.1-1.4-.8-2.8-2-3.8-3.4-.9-1.4-1.5-3-1.5-4.3 0-.2.1-.4.3-.5l1.3-.8c.2-.1.3-.4.2-.6l-.6-1.8c-.2-.5-.5-.9-.9-1.1-.4-.2-.9-.2-1.3 0l-.8.5c-1.4 1-1.9 2.8-1.3 4.5 1.2 3.5 3.6 6.5 6.9 8.5 1.5.9 3.3 1.1 4.9.5l.8-.5c.4-.2.6-.7.5-1.2-.1-.5-.3-1-.4-1.3z" fill="#fff" />
      </svg>
    ),
  },
  {
    id: 'twitter',
    label: 'Twitter / X',
    url: 'https://x.com/enscminermedia',
    color: '#000',
    icon: (
      <svg width="22" height="22" viewBox="0 0 39 39" fill="none">
        <circle cx="19.44" cy="19.44" r="19.44" fill="#000" />
        <path d="M10 11h5l4.5 6.5L24 11h5L21.5 20l8.5 8h-5l-5-7-4.5 7H10l8-9.5L10 11z" fill="#fff" />
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
