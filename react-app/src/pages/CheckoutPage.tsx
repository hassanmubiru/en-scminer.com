import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuthCtx } from '../context/AuthContext';
import { API_BASE } from '../lib/api';
import './CheckoutPage.css';

interface OrderForm {
  firstName: string; lastName: string; company: string;
  email: string; phone: string;
  country: string; address1: string; address2: string;
  city: string; state: string; postcode: string;
  notes: string; payment: string;
}

const INITIAL: OrderForm = {
  firstName: '', lastName: '', company: '',
  email: '', phone: '',
  country: 'US', address1: '', address2: '',
  city: '', state: '', postcode: '',
  notes: '', payment: 'wire',
};

const PAYMENT_METHODS = [
  { id: 'wire',  label: 'Bank Wire / SWIFT',   desc: 'International bank transfer in USD.' },
  { id: 'btc',   label: 'Bitcoin (BTC)',        desc: 'Pay with Bitcoin to our wallet address.' },
  { id: 'usdt',  label: 'USDT (ERC20/TRC20)',  desc: 'Tether stablecoin on Ethereum or TRON.' },
  { id: 'eth',   label: 'Ethereum (ETH)',       desc: 'Pay with ETH to our wallet address.' },
];

// Map frontend payment ids to backend enum values
const PAYMENT_METHOD_MAP: Record<string, string> = {
  wire:  'BANK_WIRE',
  btc:   'BTC',
  usdt:  'USDT_ERC20',
  eth:   'ETH',
};

// Default shipping method ID (Standard Shipping — free over $10k)
const DEFAULT_SHIPPING_METHOD_ID = '4b92783d-fb56-4794-a73f-f3dadb24159e';

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const { user, loading: authLoading, getToken } = useAuthCtx();
  const navigate = useNavigate();
  const [form, setForm] = useState<OrderForm>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');

  function set(field: keyof OrderForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Must be logged in to place an order
    const token = getToken();
    if (!token || !user) {
      setError('You must be logged in to place an order. Please log in via My Account first.');
      return;
    }

    setLoading(true);

    // Build the address object the backend expects
    const billingAddress = {
      firstName:   form.firstName,
      lastName:    form.lastName,
      company:     form.company || undefined,
      line1:       form.address1,
      line2:       form.address2 || undefined,
      city:        form.city,
      state:       form.state || undefined,
      postcode:    form.postcode,
      countryCode: form.country,
      phone:       form.phone || undefined,
    };

    try {
      const authHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      // Sync cart items to backend cart (authenticated — lands in user's cart)
      for (const { product, qty } of items) {
        const cartRes = await fetch(`${API_BASE}/api/v1/cart/items`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ productId: product.id, quantity: qty }),
        });
        if (!cartRes.ok) {
          const d = await cartRes.json() as Record<string, unknown>;
          const msg = (d['error'] as Record<string, unknown>)?.['message'] as string ?? 'Failed to sync cart';
          setError(msg);
          return;
        }
      }

      // Place order
      const res = await fetch(`${API_BASE}/api/v1/orders`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          billingAddress,
          shippingAddress:  billingAddress,
          shippingMethodId: DEFAULT_SHIPPING_METHOD_ID,
          paymentMethod:    PAYMENT_METHOD_MAP[form.payment] ?? 'BANK_WIRE',
          customerNote:     form.notes || undefined,
        }),
      });

      const data = await res.json() as Record<string, unknown>;

      if (!res.ok) {
        const msg = (data['error'] as Record<string, unknown>)?.['message'] as string
          ?? 'Order failed. Please try again.';
        setError(msg);
        return;
      }

      setOrderNumber(String(data['orderNumber'] ?? ''));
      clear();
      setDone(true);
      setTimeout(() => navigate('/my-account'), 4000);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0 && !done) {
    return (
      <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h2>Your cart is empty</h2>
        <Link to="/shop" className="btn btn-primary" style={{ marginTop: 20, display: 'inline-flex' }}>
          Browse Products
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="order-done">
        <div className="container">
          <div className="done-card">
            <span className="done-icon">✅</span>
            <h2>Order Placed Successfully!</h2>
            {orderNumber && <p className="done-order-num">Order #{orderNumber}</p>}
            <p>Thank you for your order. Our team will contact you within 24 hours with payment details and shipping information.</p>
            <p className="done-redirect">Redirecting to your account…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      {/* Page title */}
      <div className="page-title-banner">
        <div className="container">
          <h1>Checkout</h1>
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span className="breadcrumb-sep">/</span>
            <Link to="/cart">Cart</Link>
            <span className="breadcrumb-sep">/</span>
            <span>Checkout</span>
          </nav>
        </div>
      </div>

      {/* Steps */}
      <div className="checkout-steps">
        <div className="container">
          <ol className="steps-list">
            <li className="step step-inactive"><Link to="/cart">Shopping Cart</Link></li>
            <li className="step step-active"><span>Checkout</span></li>
            <li className="step step-inactive"><span>Order Complete</span></li>
          </ol>
        </div>
      </div>

      <div className="container checkout-layout">
        {/* ── Billing form ───────────────────────────────────────────────── */}
        <form className="billing-form" onSubmit={handleSubmit} id="checkout-form">
          <section className="form-section">
            <h3 className="form-section-title">Billing Details</h3>
            <div className="form-row-double">
              <div className="form-row">
                <label htmlFor="firstName">First Name *</label>
                <input id="firstName" type="text" required value={form.firstName} onChange={set('firstName')} />
              </div>
              <div className="form-row">
                <label htmlFor="lastName">Last Name *</label>
                <input id="lastName" type="text" required value={form.lastName} onChange={set('lastName')} />
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="company">Company Name (optional)</label>
              <input id="company" type="text" value={form.company} onChange={set('company')} />
            </div>
            <div className="form-row">
              <label htmlFor="country">Country *</label>
              <select id="country" required value={form.country} onChange={set('country')}>
                <option value="US">United States</option>
                <option value="CN">China</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="DE">Germany</option>
                <option value="RU">Russia</option>
                <option value="KZ">Kazakhstan</option>
                <option value="AE">UAE</option>
                <option value="AU">Australia</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="address1">Street Address *</label>
              <input id="address1" type="text" required placeholder="House number and street name"
                value={form.address1} onChange={set('address1')} />
            </div>
            <div className="form-row">
              <input type="text" placeholder="Apartment, suite, unit, etc. (optional)"
                value={form.address2} onChange={set('address2')} />
            </div>
            <div className="form-row-double">
              <div className="form-row">
                <label htmlFor="city">City *</label>
                <input id="city" type="text" required value={form.city} onChange={set('city')} />
              </div>
              <div className="form-row">
                <label htmlFor="state">State / Province</label>
                <input id="state" type="text" value={form.state} onChange={set('state')} />
              </div>
            </div>
            <div className="form-row-double">
              <div className="form-row">
                <label htmlFor="postcode">ZIP / Postcode *</label>
                <input id="postcode" type="text" required value={form.postcode} onChange={set('postcode')} />
              </div>
              <div className="form-row">
                <label htmlFor="phone">Phone *</label>
                <input id="phone" type="tel" required value={form.phone} onChange={set('phone')} />
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="email">Email Address *</label>
              <input id="email" type="email" required value={form.email} onChange={set('email')} />
            </div>
            <div className="form-row">
              <label htmlFor="notes">Order Notes (optional)</label>
              <textarea id="notes" placeholder="Any notes about your order or delivery…"
                value={form.notes} onChange={set('notes')} />
            </div>
          </section>
        </form>

        {/* ── Order review + payment ──────────────────────────────────────── */}
        <div className="order-review">
          <section className="form-section">
            <h3 className="form-section-title">Your Order</h3>
            <table className="order-table">
              <thead>
                <tr><th>Product</th><th>Subtotal</th></tr>
              </thead>
              <tbody>
                {items.map(({ product, qty }) => (
                  <tr key={product.id}>
                    <td>{product.name} <span className="order-qty">× {qty}</span></td>
                    <td className="order-sub">
                      ${(product.price * qty).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Subtotal</th>
                  <td>${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <th>Shipping</th>
                  <td>{subtotal >= 10000 ? <span className="free-ship">Free</span> : 'TBD'}</td>
                </tr>
                <tr className="order-total-row">
                  <th>Total</th>
                  <td><span className="price">${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td>
                </tr>
              </tfoot>
            </table>

            {/* Payment methods */}
            <div className="payment-methods">
              <h4 className="payment-methods-title">Payment Method</h4>
              {PAYMENT_METHODS.map((m) => (
                <label key={m.id} className={`payment-option${form.payment === m.id ? ' selected' : ''}`}>
                  <input
                    type="radio"
                    name="payment"
                    value={m.id}
                    checked={form.payment === m.id}
                    onChange={set('payment')}
                  />
                  <div className="payment-option-body">
                    <span className="payment-option-label">{m.label}</span>
                    {form.payment === m.id && (
                      <span className="payment-option-desc">{m.desc}</span>
                    )}
                  </div>
                </label>
              ))}
            </div>

            {error && (
              <div className="notice notice-error">{error}</div>
            )}

            <button
              type="submit"
              form="checkout-form"
              className="btn btn-primary btn-lg btn-full place-order-btn"
              disabled={loading}
            >
              {loading
                ? <><span className="spinner" style={{ borderTopColor: '#fff' }} /> Placing Order…</>
                : 'Place Order'}
            </button>

            <p className="order-note">
              Your payment details will be shared after order confirmation. We accept wire transfer,
              BTC, ETH, and USDT.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
