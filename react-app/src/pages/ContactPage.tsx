import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@streetjs/react';
import './ContactPage.css';

interface ContactForm {
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
}
const INIT: ContactForm = { name: '', email: '', phone: '', company: '', message: '' };

const FAQS = [
  {
    q: 'How long will it take to get my order?',
    a: 'Due to the high volume of orders we have received, your order may take 1–2 working days to ship from time of purchase. We use DHL, FedEx, and UPS with full tracking provided on every shipment.',
  },
  {
    q: 'What forms of payment do you accept?',
    a: 'We accept USD (Bank Wire / SWIFT), Bitcoin (BTC), Ethereum (ETH), ETC, and USDT (ERC20 / TRC20).',
  },
  {
    q: 'How can I find out if you\'ve received my order?',
    a: 'After you complete your purchase, a confirmation page will be displayed with your web order number and order information. We\'ll also email a confirmation to you, so be sure to enter your correct email address.',
  },
  {
    q: 'How can I return an item?',
    a: 'If you\'re not satisfied with your order, you may return most items within 90 days of purchase to receive a refund, credit, or replacement.',
  },
  {
    q: 'If a product is out of stock, can I place a back order?',
    a: 'At this time we are not accepting back orders for out-of-stock items, but you can request to be emailed when the item comes back in stock by entering your email on the product page.',
  },
];

export default function ContactPage() {
  const [form, setForm] = useState<ContactForm>(INIT);
  const [sent, setSent]   = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const { mutate, loading } = useMutation(async (data: ContactForm) => {
    await new Promise((r) => setTimeout(r, 900));
    return data;
  });

  function setF(k: keyof ContactForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await mutate(form);
    setSent(true);
    setForm(INIT);
  }

  return (
    <div className="contact-page">

      {/* ── Page title ───────────────────────────────────────────────── */}
      <div className="page-title-banner">
        <div className="container">
          <h1>Contact Us</h1>
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span className="breadcrumb-sep">/</span>
            <span>Contact Us</span>
          </nav>
        </div>
      </div>

      {/* ── Info boxes row ───────────────────────────────────────────── */}
      <section className="contact-info-section">
        <div className="container contact-info-grid">

          <div className="contact-info-box">
            <div className="cib-icon">📍</div>
            <div className="cib-tag">MAIN BASE</div>
            <h3 className="cib-title">VISIT OUR HEAD QUARTER</h3>
            <p className="cib-text">
              #2807, Chang Jiang Center, Longhua Renmin Road,<br />
              Longhua District, Shenzhen,<br />
              Guangdong Province, China
            </p>
          </div>

          <div className="contact-info-box">
            <div className="cib-icon">📞</div>
            <div className="cib-tag">PHONE / WHATSAPP</div>
            <h3 className="cib-title">CALL OR TEXT US</h3>
            <p className="cib-text">
              +1 (424) 513-3056<br />
              <span className="cib-sub">(direct call or text)</span>
            </p>
            <p className="cib-text">
              +1 (743) 201 1306<br />
              <span className="cib-sub">(WhatsApp Only)</span>
            </p>
          </div>

          <div className="contact-info-box">
            <div className="cib-icon">✉️</div>
            <div className="cib-tag">EMAIL</div>
            <h3 className="cib-title">SEND US AN EMAIL</h3>
            <p className="cib-text">
              <a href="mailto:info@en-scminer.com">info@en-scminer.com</a>
            </p>
            <p className="cib-text cib-hours">
              Mon – Sat: 09:00 – 20:00 CST<br />
              <span className="cib-sub">Response within 24 hours</span>
            </p>
          </div>

          <div className="contact-info-box">
            <div className="cib-icon">💳</div>
            <div className="cib-tag">PAYMENT</div>
            <h3 className="cib-title">WE ACCEPT</h3>
            <div className="cib-payment-badges">
              {['USD', 'BTC', 'ETH', 'ETC', 'USDT ERC20', 'USDT TRC20'].map((m) => (
                <span key={m} className="cib-badge">{m}</span>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ── FAQ + Contact form (2-col) ───────────────────────────────── */}
      <section className="contact-main-section">
        <div className="container contact-main-grid">

          {/* Left: FAQ accordion */}
          <div className="contact-faq">
            <div className="contact-section-eyebrow">INFORMATION QUESTIONS</div>
            <h2 className="contact-section-title">FREQUENTLY ASKED QUESTIONS</h2>

            <div className="faq-list">
              {FAQS.map((f, i) => (
                <div
                  key={i}
                  className={`faq-item${openFaq === i ? ' faq-open' : ''}`}
                >
                  <button
                    className="faq-question"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    aria-expanded={openFaq === i}
                  >
                    <span>{f.q}</span>
                    <span className="faq-icon" aria-hidden="true">
                      {openFaq === i ? '−' : '+'}
                    </span>
                  </button>
                  {openFaq === i && (
                    <div className="faq-answer">
                      <p>{f.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Contact form */}
          <div className="contact-form-section">
            <div className="contact-section-eyebrow">INFORMATION ABOUT US</div>
            <h2 className="contact-section-title">CONTACT US FOR ANY QUESTIONS</h2>

            {sent ? (
              <div className="notice notice-success">
                <strong>✓ Message sent!</strong> Our team will get back to you within 24 hours.
              </div>
            ) : (
              <form className="contact-form" onSubmit={onSubmit}>

                <div className="cf-row-double">
                  <div className="form-row">
                    <label htmlFor="cf-name">Your Name <span className="required">*</span></label>
                    <input
                      id="cf-name" type="text" required
                      placeholder="John Smith"
                      value={form.name} onChange={setF('name')}
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor="cf-email">Your Email <span className="required">*</span></label>
                    <input
                      id="cf-email" type="email" required
                      placeholder="you@company.com"
                      value={form.email} onChange={setF('email')}
                    />
                  </div>
                </div>

                <div className="cf-row-double">
                  <div className="form-row">
                    <label htmlFor="cf-phone">Phone Number</label>
                    <input
                      id="cf-phone" type="tel"
                      placeholder="+1 555 000 0000"
                      value={form.phone} onChange={setF('phone')}
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor="cf-company">Company</label>
                    <input
                      id="cf-company" type="text"
                      placeholder="Company name (optional)"
                      value={form.company} onChange={setF('company')}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <label htmlFor="cf-message">Your Message <span className="required">*</span></label>
                  <textarea
                    id="cf-message" required rows={6}
                    placeholder="Tell us about the miners you're interested in, quantities, and any specific requirements…"
                    value={form.message} onChange={setF('message')}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg btn-full cf-submit"
                  disabled={loading}
                >
                  {loading
                    ? <><span className="spinner" style={{ borderTopColor: '#fff' }} /> Sending…</>
                    : 'Send Message'}
                </button>

              </form>
            )}
          </div>

        </div>
      </section>

      {/* ── Google Map ──────────────────────────────────────────────── */}
      <div className="contact-map">
        <iframe
          title="SCminer Office Location"
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3686.8957498024!2d114.04128597607!3d22.680559279502!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3403f2c0b3f9aa2b%3A0xa54c69bf26a19a81!2sLonghua%20District%2C%20Shenzhen%2C%20Guangdong%20Province%2C%20China!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus"
          width="100%"
          height="400"
          style={{ border: 0, display: 'block' }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

    </div>
  );
}
