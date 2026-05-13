import { supabase } from './supabaseClient.js';

// State
let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

// Premium Animated Toast Notification System
window.showStoreToast = function(message, type = 'success', actionHtml = '') {
  let container = document.getElementById('store-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'store-toast-container';
    Object.assign(container.style, {
      position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', gap: '10px',
      zIndex: '9999', pointerEvents: 'none', width: 'max-content', maxWidth: '90vw'
    });
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  let icon = '<i class="fa-solid fa-check-circle" style="color: var(--primary);"></i>';
  if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation" style="color: #d32f2f;"></i>';
  if (type === 'info') icon = '<i class="fa-solid fa-circle-info" style="color: var(--primary);"></i>';

  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 18px;">${icon}</span>
      <span style="font-family: var(--font-body); font-size: 14px; font-weight: 500; color: var(--on-surface);">${message}</span>
    </div>
    ${actionHtml ? `<div style="margin-left: auto; pointer-events: auto;">${actionHtml}</div>` : ''}
  `;

  Object.assign(toast.style, {
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 182, 193, 0.3)',
    boxShadow: '0 8px 32px rgba(255, 182, 193, 0.15)',
    borderRadius: '100px',
    padding: '12px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px',
    pointerEvents: 'auto',
    animation: 'toastSlideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
    opacity: '0', transform: 'translateY(20px)'
  });

  container.appendChild(toast);

  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.innerHTML = `
      @keyframes toastSlideUp { to { opacity: 1; transform: translateY(0); } }
      @keyframes toastSlideDown { to { opacity: 0; transform: translateY(20px); } }
      .cart-bounce i { animation: cartBounce 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); display: inline-block; }
      @keyframes cartBounce { 0% { transform: scale(1); } 50% { transform: scale(1.4); color: var(--primary); } 100% { transform: scale(1); } }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => {
    toast.style.animation = 'toastSlideDown 0.3s ease forwards';
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 300);
  }, 3000);
};

function animateCartIcon() {
  const navCartIcon = document.querySelector('.fa-bag-shopping');
  if (navCartIcon) {
    navCartIcon.classList.remove('cart-bounce');
    void navCartIcon.offsetWidth; 
    navCartIcon.classList.add('cart-bounce');
  }
}

let currentPdpProduct = null;
let currentPdpQty = 1;

// Navigation Logic
function navigate(pageId, productId = null) {
  // Hide all pages
  document.querySelectorAll('.page-view').forEach(page => {
    page.classList.remove('active');
  });
  
  // Show target page
  const targetPage = document.getElementById(`${pageId}-page`);
  if (targetPage) {
    targetPage.classList.add('active');
  } else {
    document.getElementById('home-page').classList.add('active');
    pageId = 'home';
  }

  // Close mobile menu if open
  document.getElementById('nav-links').classList.remove('active');
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  // Specific page logic
  if (pageId === 'checkout') renderCart();
  if (pageId === 'product' && productId) loadProductDetails(productId);
  
  // Update URL history for React Router-like SPA feeling
  if (pageId === 'product' && productId) {
    window.history.pushState({pageId, productId}, '', `/?product=${productId}`);
  } else {
    window.history.pushState({pageId}, '', pageId === 'home' ? '/' : `/?page=${pageId}`);
  }
}
window.navigate = navigate;

window.viewProduct = function(id) {
  navigate('product', id);
};

window.addEventListener('popstate', (e) => {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('product');
  const pageId = urlParams.get('page') || (productId ? 'product' : 'home');
  
  document.querySelectorAll('.page-view').forEach(page => page.classList.remove('active'));
  const targetPage = document.getElementById(`${pageId}-page`);
  if (targetPage) targetPage.classList.add('active');
  else document.getElementById('home-page').classList.add('active');
  
  if (pageId === 'checkout') renderCart();
  if (pageId === 'product' && productId) loadProductDetails(productId);
});

// Render Products
function renderProductCard(product) {
  const badgeHTML = product.badge ? `<span class="badge">${product.badge}</span>` : '';
  
  return `
    <div class="product-card glass-panel" onclick="viewProduct('${product.id}')">
      ${badgeHTML}
      <div class="product-img-wrapper">
        <img src="${product.image}" alt="${product.name}" class="product-img">
        <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart('${product.id}')">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>
      <div class="product-info">
        <h3>${product.name}</h3>
        <p style="font-size: 12px; color: var(--on-surface-variant); margin-bottom: 8px;">${product.category}</p>
        <p class="product-price">₹${product.price.toLocaleString('en-IN')}</p>
      </div>
    </div>
  `;
}

async function initProducts() {
  const trendingContainer = document.getElementById('trending-products');
  const allContainer = document.getElementById('all-products');
  
  if (trendingContainer) trendingContainer.innerHTML = '<p style="text-align:center; width:100%; color: var(--on-surface-variant);">Loading products from Supabase...</p>';
  if (allContainer) allContainer.innerHTML = '<p style="text-align:center; width:100%; color: var(--on-surface-variant);">Loading products from Supabase...</p>';

  try {
    const { data, error } = await supabase
      .from('Products')
      .select('*');
      
    if (error) throw error;
    
    products = data || [];
    
    // Render trending on home (first 4)
    if (trendingContainer) {
      if (products.length > 0) {
        trendingContainer.innerHTML = products.slice(0, 4).map(renderProductCard).join('');
      } else {
         trendingContainer.innerHTML = '<p style="text-align:center; width:100%;">No products found.</p>';
      }
    }
    
    // Render all on shop
    if (allContainer) {
      if (products.length > 0) {
        allContainer.innerHTML = products.map(renderProductCard).join('');
      } else {
        allContainer.innerHTML = '<p style="text-align:center; width:100%;">No products found.</p>';
      }
    }
  } catch (error) {
    console.error('Error fetching products:', error);
    const errorMsg = error.message || JSON.stringify(error) || 'Unknown error';
    if (trendingContainer) trendingContainer.innerHTML = `<p style="text-align:center; width:100%; color:red;">Failed to load products. Error: ${errorMsg}</p>`;
    if (allContainer) allContainer.innerHTML = `<p style="text-align:center; width:100%; color:red;">Failed to load products. Error: ${errorMsg}</p>`;
  }
}

// Cart Logic
function addToCart(productId) {
  const existingItem = cart.find(item => item.productId == productId);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ productId, quantity: 1 });
  }
  
  saveCart();
  
  animateCartIcon();
  const product = products.find(p => p.id === productId);
  showStoreToast(product ? `${product.name} added successfully` : 'Item added to your cart', 'success', '<button onclick="navigate(\'checkout\')" style="background: none; border: none; color: var(--primary); font-weight: 600; cursor: pointer; text-decoration: underline; font-size: 13px;">View</button>');
  const btn = document.querySelector(`[onclick="event.stopPropagation(); addToCart('${productId}')"]`);
  if (btn) {
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i>';
    btn.style.background = 'var(--primary)';
    btn.style.color = 'white';
    setTimeout(() => {
      btn.innerHTML = originalHtml;
      btn.style.background = '';
      btn.style.color = '';
    }, 1000);
  }
  
  renderCart();
}
window.addToCart = addToCart;

window.updateQuantity = function(productId, delta) {
  const item = cart.find(i => i.productId == productId);
  if (item) {
    item.quantity += delta;
    if (item.quantity <= 0) {
      cart = cart.filter(i => i.productId != productId);
    }
    saveCart();
    renderCart();
  }
}

window.removeItem = function(productId) {
  cart = cart.filter(i => i.productId != productId);
  saveCart();
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cart-items-container');
  const totalEl = document.getElementById('cart-total-amount');
  
  if (!container || !totalEl) return;
  
  if (cart.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--on-surface-variant); padding: 20px 0;">Your basket is empty.</p>';
    totalEl.innerText = '₹0.00';
    return;
  }
  
  let total = 0;
  let html = '';
  
  cart.forEach(item => {
    const product = products.find(p => p.id === item.productId || p.id == item.productId);
    if (!product) return;
    
    const itemTotal = product.price * item.quantity;
    total += itemTotal;
    
    html += `
      <div class="cart-item">
        <img src="${product.image}" alt="${product.name}" class="cart-item-img">
        <div class="cart-item-details">
          <div style="display: flex; justify-content: space-between;">
            <h4>${product.name}</h4>
            <button onclick="removeItem('${item.productId}')" style="background: none; border: none; color: var(--outline); cursor: pointer;"><i class="fa-solid fa-trash-can"></i></button>
          </div>
          <p>Variant: ${product.category}</p>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
            <div style="display: flex; align-items: center; gap: 10px; background: var(--surface-container-low); padding: 4px 8px; border-radius: var(--radius-sm);">
              <button onclick="updateQuantity('${item.productId}', -1)" style="background: none; border: none; cursor: pointer; color: var(--on-surface);"><i class="fa-solid fa-minus" style="font-size: 10px;"></i></button>
              <span style="font-size: 14px; font-weight: 500;">${item.quantity}</span>
              <button onclick="updateQuantity('${item.productId}', 1)" style="background: none; border: none; cursor: pointer; color: var(--on-surface);"><i class="fa-solid fa-plus" style="font-size: 10px;"></i></button>
            </div>
            <span style="font-weight: 600;">₹${itemTotal.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
  totalEl.innerText = `₹${total.toLocaleString('en-IN')}`;
}

function submitCheckout() {
  const name = document.getElementById('checkout-name')?.value.trim();
  const phone = document.getElementById('checkout-phone')?.value.trim();
  const address = document.getElementById('checkout-address')?.value.trim();
  const pincode = document.getElementById('checkout-pincode')?.value.trim();
  const note = document.getElementById('checkout-note')?.value.trim();

  if (!name || !phone || !address || !pincode) {
    showStoreToast('Please fill in all required delivery details.', 'error');
    return;
  }

  if (cart.length === 0) {
    showStoreToast("Your cart is empty!", 'error');
    return;
  }
  
  let orderText = `Hello CozyCurl 🌸\n\n🛍 Order Details:\n`;
  let total = 0;
  
  cart.forEach(item => {
    const product = products.find(p => p.id === item.productId || p.id == item.productId);
    if (product) {
      const itemTotal = product.price * item.quantity;
      total += itemTotal;
      orderText += `- ${product.name} × ${item.quantity} — ₹${itemTotal.toLocaleString('en-IN')}\n`;
    }
  });

  orderText += `\n💰 Total: ₹${total.toLocaleString('en-IN')}\n\n`;
  orderText += `👤 Customer Details:\n`;
  orderText += `Name: ${name}\n`;
  orderText += `Phone: ${phone}\n`;
  orderText += `Address: ${address}\n`;
  orderText += `Pincode: ${pincode}\n`;
  
  if (note) {
    orderText += `\n📝 Note:\n${note}\n`;
  }
  
  const whatsappNumber = "917004344223";
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(orderText)}`;
  
  showStoreToast(`Redirecting to WhatsApp 💖`, 'success');
  
  cart = []; // Empty cart
  saveCart();
  renderCart();
  
  setTimeout(() => {
    window.location.href = whatsappUrl;
  }, 1200);
}
window.submitCheckout = submitCheckout;

// Header Scroll Effect
window.addEventListener('scroll', () => {
  const header = document.getElementById('header');
  if (header) {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }
});

// Mobile Menu
const mobileToggle = document.getElementById('mobile-toggle');
if (mobileToggle) {
  mobileToggle.addEventListener('click', () => {
    document.getElementById('nav-links').classList.toggle('active');
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initProducts();
  renderCart();
  
  // Deep Linking Initialization
  const urlParams = new URLSearchParams(window.location.search);
  const initialProductId = urlParams.get('product');
  const initialPageId = urlParams.get('page') || (initialProductId ? 'product' : 'home');
  if (initialPageId !== 'home' || initialProductId) {
    setTimeout(() => navigate(initialPageId, initialProductId), 100);
  }

  // Star rating logic
  document.querySelectorAll('.star-btn').forEach(star => {
    star.addEventListener('click', (e) => {
      const val = parseInt(e.target.getAttribute('data-val'));
      document.getElementById('review-rating').value = val;
      document.querySelectorAll('.star-btn').forEach(s => {
        const sVal = parseInt(s.getAttribute('data-val'));
        if (sVal <= val) {
          s.classList.replace('fa-regular', 'fa-solid');
          s.style.color = '#f4c150';
        } else {
          s.classList.replace('fa-solid', 'fa-regular');
          s.style.color = 'var(--outline-variant)';
        }
      });
    });
  });
});


// PDP Logic
window.loadProductDetails = async function(id) {
  document.getElementById('pdp-content').style.display = 'none';
  document.getElementById('pdp-error').style.display = 'none';
  document.getElementById('pdp-loading').style.display = 'grid';
  document.getElementById('pdp-related-section').style.display = 'none';
  document.getElementById('pdp-reviews-section').style.display = 'none';
  
  try {
    const { data: product, error } = await supabase.from('Products').select('*').eq('id', id).single();
    if (error || !product) throw new Error('Not found');
    
    currentPdpProduct = product;
    currentPdpQty = 1;
    document.getElementById('pdp-qty').innerText = 1;
    const minusBtn = document.getElementById('qty-minus');
    if (minusBtn) minusBtn.disabled = true;
    
    // Populate info
    document.getElementById('pdp-name').innerText = product.name;
    document.getElementById('pdp-category').innerText = product.category;
    document.getElementById('pdp-bread-category').innerText = product.category;
    document.getElementById('pdp-price').innerText = `₹${product.price.toLocaleString('en-IN')}`;
    document.getElementById('pdp-description').innerText = product.description || 'No description available.';
    
    // Images
    document.getElementById('pdp-main-image').src = product.image;
    document.getElementById('pdp-thumb-1').src = product.image;
    document.getElementById('pdp-thumb-2').src = product.image; 
    document.getElementById('pdp-thumb-3').src = product.image;
    
    // Hide skeleton, show content
    document.getElementById('pdp-loading').style.display = 'none';
    document.getElementById('pdp-content').style.display = 'grid';
    document.getElementById('pdp-reviews-section').style.display = 'block';
    
    // Load related
    loadRelatedProducts(product.category, product.id);
    
    // Load reviews
    loadProductReviews(product.id);
    
  } catch (err) {
    document.getElementById('pdp-loading').style.display = 'none';
    document.getElementById('pdp-error').style.display = 'block';
  }
};

window.switchImage = function(src, el) {
  document.getElementById('pdp-main-image').src = src;
  document.querySelectorAll('.pdp-thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

window.changePdpQty = function(delta) {
  currentPdpQty += delta;
  if (currentPdpQty < 1) currentPdpQty = 1;
  
  const qtyEl = document.getElementById('pdp-qty');
  if (qtyEl) {
    qtyEl.innerText = currentPdpQty;
    qtyEl.classList.remove('qty-bump');
    void qtyEl.offsetWidth;
    qtyEl.classList.add('qty-bump');
  }
  
  const minusBtn = document.getElementById('qty-minus');
  if (minusBtn) {
    minusBtn.disabled = currentPdpQty <= 1;
  }
}

window.addPdpToCart = function() {
  if (!currentPdpProduct) return;
  const existingItem = cart.find(item => item.productId == currentPdpProduct.id);
  if (existingItem) {
    existingItem.quantity += currentPdpQty;
  } else {
    cart.push({ productId: currentPdpProduct.id, quantity: currentPdpQty });
  }
  saveCart();
  renderCart();
  animateCartIcon();
  showStoreToast(`${currentPdpProduct.name} added to cart!`, 'success', '<button onclick="navigate(\'checkout\')" style="background: none; border: none; color: var(--primary); font-weight: 600; cursor: pointer; text-decoration: underline; font-size: 13px;">View</button>');
};

window.shareProduct = async function() {
  const url = window.location.href;
  if (navigator.share) {
    try {
      await navigator.share({
        title: currentPdpProduct ? currentPdpProduct.name : 'CozyCurl Product',
        text: 'Check out this gorgeous product from CozyCurl!',
        url: url
      });
    } catch (err) {
      console.log('Share error:', err);
    }
  } else {
    navigator.clipboard.writeText(url).then(() => {
      showStoreToast("Product link copied ", 'success');
    });
  }
};

async function loadRelatedProducts(category, excludeId) {
  try {
    const { data } = await supabase.from('Products').select('*').eq('category', category).neq('id', excludeId).limit(4);
    if (data && data.length > 0) {
      document.getElementById('related-products').innerHTML = data.map(renderProductCard).join('');
      document.getElementById('pdp-related-section').style.display = 'block';
    }
  } catch (e) {
    console.error(e);
  }
}

async function loadProductReviews(productId) {
  try {
    const { data, error } = await supabase.from('Reviews').select('*').eq('product_id', productId).order('created_at', { ascending: false });
    if (error && error.code !== '42P01') throw error; 
    
    const container = document.getElementById('reviews-container');
    const noMsg = document.getElementById('no-reviews-msg');
    
    if (!data || data.length === 0) {
      container.innerHTML = '';
      noMsg.style.display = 'block';
    } else {
      noMsg.style.display = 'none';
      container.innerHTML = data.map(review => {
        const dateStr = new Date(review.created_at).toLocaleDateString();
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
          const isFilled = i <= review.rating;
          starsHtml += `<i class="${isFilled ? 'fa-solid' : 'fa-regular'} fa-star" style="color: ${isFilled ? '#f4c150' : 'var(--outline-variant)'}"></i>`;
        }
        return `
          <div class="review-card glass-panel" style="padding: 20px;">
            <div style="margin-bottom: 10px;">${starsHtml}</div>
            <p style="font-style: italic; font-size: 14px; margin-bottom: 10px;">"${review.review}"</p>
            <h4 style="font-size: 14px;">- ${review.customer_name} <span style="font-size: 11px; font-weight: normal; color: var(--on-surface-variant); margin-left: 10px;">${dateStr}</span></h4>
          </div>
        `;
      }).join('');
    }
  } catch(e) {
    console.error('Error fetching reviews:', e);
  }
}

window.openReviewModal = function() {
  document.getElementById('review-form').reset();
  document.getElementById('review-rating').value = 5;
  document.querySelectorAll('.star-btn').forEach(s => {
    s.classList.replace('fa-regular', 'fa-solid');
    s.style.color = '#f4c150';
  });
  document.getElementById('review-modal').classList.add('active');
};

window.closeReviewModal = function() {
  document.getElementById('review-modal').classList.remove('active');
};

window.submitReview = async function(e) {
  e.preventDefault();
  if (!currentPdpProduct) return;
  
  const btn = document.getElementById('submit-review-btn');
  btn.disabled = true;
  btn.innerText = 'Submitting...';
  
  const reviewData = {
    product_id: currentPdpProduct.id,
    customer_name: document.getElementById('review-name').value,
    rating: parseInt(document.getElementById('review-rating').value),
    review: document.getElementById('review-message').value
  };
  
  try {
    const { error } = await supabase.from('Reviews').insert([reviewData]);
    if (error) throw error;
    
    showStoreToast('Thank you for your review! 💖', 'success');
    closeReviewModal();
    loadProductReviews(currentPdpProduct.id);
  } catch (err) {
    console.error('Review submit error:', err);
    showStoreToast('Failed to submit review. Check if Reviews table exists.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = 'Submit Review';
  }
};

window.trackOrderOnWhatsApp = function() {
  const orderId = document.getElementById('track-order-id').value.trim();
  const phone = document.getElementById('track-phone').value.trim();
  const btn = document.getElementById('track-submit-btn');

  if (!orderId || !phone) {
    showStoreToast('Please enter both Order ID and Phone Number.', 'error');
    return;
  }

  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Connecting...';
  btn.style.opacity = '0.8';
  btn.disabled = true;

  const message = `Hello CozyCurl,\n\nI would like to track my order.\n\nOrder ID:\n${orderId}\n\nRegistered Phone Number:\n${phone}\n\nPlease share the latest update regarding my order.`;
  const whatsappUrl = `https://wa.me/917004344223?text=${encodeURIComponent(message)}`;

  setTimeout(() => {
    showStoreToast('Redirecting to WhatsApp...', 'success');
    window.location.href = whatsappUrl;
    
    setTimeout(() => {
      btn.innerHTML = originalHtml;
      btn.style.opacity = '1';
      btn.disabled = false;
      document.getElementById('track-order-form').reset();
    }, 1000);
  }, 800);
};

window.openSearchOverlay = function() {
  document.getElementById('search-overlay').classList.add('active');
  setTimeout(() => document.getElementById('search-input').focus(), 100);
}

window.closeSearchOverlay = function() {
  document.getElementById('search-overlay').classList.remove('active');
}

// Close on click outside and setup listeners
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('search-overlay');
  if(overlay) {
    overlay.addEventListener('click', (e) => {
      if(e.target === overlay) closeSearchOverlay();
    });
  }
  
  const searchInput = document.getElementById('search-input');
  if(searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value.trim().toLowerCase();
      
      const suggestionsEl = document.getElementById('search-suggestions');
      const resultsEl = document.getElementById('search-results');
      
      if(query.length === 0) {
        suggestionsEl.style.display = 'block';
        resultsEl.style.display = 'none';
        return;
      }
      
      suggestionsEl.style.display = 'none';
      resultsEl.style.display = 'flex';
      resultsEl.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--on-surface-variant);"><i class="fa-solid fa-circle-notch fa-spin"></i> Searching...</div>';
      
      debounceTimer = setTimeout(() => {
        performSearch(query);
      }, 300); // 300ms debounce
    });
  }
});

window.setSearchQuery = function(query) {
  const searchInput = document.getElementById('search-input');
  searchInput.value = query;
  searchInput.dispatchEvent(new Event('input'));
}

async function performSearch(query) {
  const resultsEl = document.getElementById('search-results');
  
  try {
    const { data, error } = await supabase
      .from('Products')
      .select('*')
      .or(`name.ilike.%${query}%,category.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(6);
      
    if (error) throw error;
    
    if(!data || data.length === 0) {
      resultsEl.innerHTML = `
        <div class="search-empty">
          <i class="fa-solid fa-box-open"></i>
          <p>No products found for "${query}"</p>
          <button class="btn btn-secondary" style="margin-top:15px; padding: 10px 20px;" onclick="setSearchQuery('')">Clear Search</button>
        </div>
      `;
      return;
    }
    
    resultsEl.innerHTML = data.map(product => `
      <div class="search-result-item" onclick="closeSearchOverlay(); viewProduct('${product.id}')">
        <img src="${product.image}" class="search-result-img" alt="${product.name}">
        <div class="search-result-info">
          <h4>${product.name}</h4>
          <p>${product.category}</p>
        </div>
        <div class="search-result-price">₹${product.price.toLocaleString('en-IN')}</div>
      </div>
    `).join('');
    
  } catch(err) {
    console.error('Search error:', err);
    resultsEl.innerHTML = '<div style="text-align:center; color:red; padding: 20px;">Search failed. Try again.</div>';
  }
}

