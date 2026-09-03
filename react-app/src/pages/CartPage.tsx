import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import './CartPage.css';

export default function CartPage() {
  const { items, count, subtotal, remove, setQty, clear } = useCart();
  const navigate = useNavigate();

  return (
    <div className="cart-page">
      {/* Page title */}
      <div className="page-title-banner">
        <div className="container">
          <h1>Shopping Cart</h1>
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span className="breadcrumb-sep">/</span>
            <span>Cart</span>
          </nav>
        </div>
      </div>

      {/* Checkout steps */}
      <div className="checkout-steps">
        <div className="container">
          <ol className="steps-list">
            <li className="step step-active"><span>Shopping Cart</span></li>
            <li className="step step-inactive"><span>Checkout</span></li>
            <li className="step step-inactive"><span>Order Complete</span></li>
          </ol>
        </div>
      </div>

      <div className="container cart-layout">
        {count === 0 ? (
          <div className="cart-empty">
            <span className="cart-empty-icon">🛒</span>
            <h2>Your cart is empty</h2>
            <p>Add some miners to get started!</p>
            <Link to="/shop" className="btn btn-primary btn-lg">Browse Products</Link>
          </div>
        ) : (
          <>
            {/* Cart table */}
            <div className="cart-table-wrap">
              <table className="cart-table">
                <thead>
                  <tr>
                    <th className="col-remove" />
                    <th className="col-thumb" />
                    <th className="col-product">Product</th>
                    <th className="col-price">Price</th>
                    <th className="col-qty">Quantity</th>
                    <th className="col-sub">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ product, qty }) => (
                    <tr key={product.id} className="cart-row">
                      <td className="col-remove">
                        <button
                          className="remove-btn"
                          aria-label={`Remove ${product.name}`}
                          onClick={() => remove(product.id)}
                        >
                          ×
                        </button>
                      </td>
                      <td className="col-thumb">
                        <Link to={`/product/${product.slug}`}>
                          <img src={product.image} alt={product.name} width={70} height={70} />
                        </Link>
                      </td>
                      <td className="col-product" data-label="Product">
                        <Link to={`/product/${product.slug}`} className="cart-product-name">
                          {product.name}
                        </Link>
                        <span className="cart-product-meta">{product.hashrate} · {product.power}</span>
                      </td>
                      <td className="col-price" data-label="Price">
                        <span className="price">${product.price.toLocaleString()}.00</span>
                      </td>
                      <td className="col-qty" data-label="Quantity">
                        <div className="qty-wrap">
                          <button onClick={() => setQty(product.id, qty - 1)}>−</button>
                          <input
                            type="number"
                            value={qty}
                            min={1}
                            onChange={(e) => setQty(product.id, parseInt(e.target.value) || 1)}
                          />
                          <button onClick={() => setQty(product.id, qty + 1)}>+</button>
                        </div>
                      </td>
                      <td className="col-sub" data-label="Subtotal">
                        <span className="price">
                          ${(product.price * qty).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="cart-actions-row">
                <div className="coupon-form">
                  <label htmlFor="coupon">Coupon code:</label>
                  <input id="coupon" type="text" placeholder="Enter coupon code" />
                  <button className="btn btn-dark btn-sm">Apply Coupon</button>
                </div>
                <button className="btn btn-outline-dark btn-sm" onClick={clear}>
                  Clear Cart
                </button>
              </div>
            </div>

            {/* Cart totals */}
            <div className="cart-totals">
              <h2 className="totals-title">Cart Totals</h2>
              <table className="totals-table">
                <tbody>
                  <tr>
                    <th>Subtotal</th>
                    <td>
                      <span className="price">
                        ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <th>Shipping</th>
                    <td>
                      <span className="shipping-note">
                        {subtotal >= 10000
                          ? <span style={{ color: '#2e7d32', fontWeight: 700 }}>Free Shipping</span>
                          : 'Calculated at checkout'}
                      </span>
                    </td>
                  </tr>
                  <tr className="row-total">
                    <th>Total</th>
                    <td>
                      <span className="price total-price">
                        ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <button
                className="btn btn-primary btn-lg btn-full checkout-btn"
                onClick={() => navigate('/checkout')}
              >
                Proceed to Checkout
              </button>
              <Link to="/shop" className="continue-shopping">
                ← Continue Shopping
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
