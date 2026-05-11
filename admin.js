import { supabase } from './supabaseClient.js';

// State
let products = [];
let coupons = [];
let deleteId = null;
let deleteType = null; // 'product' or 'coupon'

// Initialize Admin
document.addEventListener('DOMContentLoaded', () => {
  fetchDashboardData();
  setupEventListeners();
});

function setupEventListeners() {
  // Sidebar Navigation
  document.querySelectorAll('.sidebar .nav-item[data-target]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Update active nav
      document.querySelectorAll('.sidebar .nav-item').forEach(n => n.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
      // Show view
      const target = e.currentTarget.getAttribute('data-target');
      document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('active'));
      document.getElementById(`view-${target}`).classList.add('active');
      
      // Update Header title
      document.getElementById('current-view-title').innerText = target.charAt(0).toUpperCase() + target.slice(1);
      
      // Close mobile sidebar
      document.querySelector('.sidebar').classList.remove('active');
    });
  });

  // Mobile toggle
  const mobileToggle = document.getElementById('admin-mobile-toggle');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      document.querySelector('.sidebar').classList.toggle('active');
    });
  }

  // Search listeners
  document.getElementById('product-search').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = products.filter(p => p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term));
    renderProductsTable(filtered);
  });

  document.getElementById('coupon-search').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = coupons.filter(c => c.code.toLowerCase().includes(term));
    renderCouponsTable(filtered);
  });

  // Image preview
  document.getElementById('product-image-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        document.getElementById('image-preview').style.display = 'block';
        document.getElementById('image-preview-img').src = evt.target.result;
      }
      reader.readAsDataURL(file);
    }
  });
}

// Data Fetching
async function fetchDashboardData() {
  showLoading('products-loading', true);
  showLoading('coupons-loading', true);

  // Fetch Products
  try {
    const { data: pData, error: pError } = await supabase.from('Products').select('*').order('id', { ascending: false });
    if (pError) throw pError;
    products = pData || [];
    renderProductsTable(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    showToast('Failed to fetch products. Check if table exists.', 'error');
  } finally {
    showLoading('products-loading', false);
  }

  // Fetch Coupons
  try {
    const { data: cData, error: cError } = await supabase.from('Coupons').select('*').order('id', { ascending: false });
    if (cError) throw cError;
    coupons = cData || [];
    renderCouponsTable(coupons);
  } catch (error) {
    console.error('Error fetching coupons:', error);
    // We don't want a missing coupons table to annoy the user with a red toast every time, so we just log it unless it's a real issue.
    // showToast('Failed to fetch coupons. Make sure table "coupons" exists.', 'error');
  } finally {
    showLoading('coupons-loading', false);
  }

  updateDashboardStats();
}

function updateDashboardStats() {
  document.getElementById('stat-total-products').innerText = products.length;
  document.getElementById('stat-low-stock').innerText = products.filter(p => p.stock < 10).length;
  document.getElementById('stat-active-coupons').innerText = coupons.length;
}

// Rendering
function renderProductsTable(data) {
  const tbody = document.getElementById('products-tbody');
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--on-surface-variant);">No products found.</td></tr>';
    return;
  }
  
  tbody.innerHTML = data.map(product => `
    <tr>
      <td><img src="${product.image || 'images/hero_illustration.png'}" alt="product" class="table-img"></td>
      <td style="font-weight: 500;">${product.name}</td>
      <td><span class="badge" style="position: static;">${product.category}</span></td>
      <td>₹${product.price.toLocaleString('en-IN')}</td>
      <td>${product.stock}</td>
      <td>
        <div class="action-btns">
          <button class="icon-btn edit" onclick="editProduct('${product.id}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="icon-btn delete" onclick="confirmDelete('${product.id}', 'product')" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderCouponsTable(data) {
  const tbody = document.getElementById('coupons-tbody');
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--on-surface-variant);">No coupons found.</td></tr>';
    return;
  }
  
  tbody.innerHTML = data.map(coupon => `
    <tr>
      <td style="font-weight: 600;">${coupon.code}</td>
      <td>${coupon.discount_percentage}%</td>
      <td>₹${coupon.min_order_amount.toLocaleString('en-IN')}</td>
      <td>${new Date(coupon.expiry_date).toLocaleDateString()}</td>
      <td>
        <div class="action-btns">
          <button class="icon-btn edit" onclick="editCoupon('${coupon.id}')" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="icon-btn delete" onclick="confirmDelete('${coupon.id}', 'coupon')" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Modals
window.openProductModal = function(product = null) {
  const modal = document.getElementById('product-modal');
  const title = document.getElementById('product-modal-title');
  const form = document.getElementById('product-form');
  const preview = document.getElementById('image-preview');
  const previewImg = document.getElementById('image-preview-img');
  
  if (product) {
    title.innerText = 'Edit Product';
    document.getElementById('product-id').value = product.id;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-category').value = product.category;
    document.getElementById('product-price').value = product.price;
    document.getElementById('product-stock').value = product.stock;
    document.getElementById('product-image').value = product.image || '';
    document.getElementById('product-description').value = product.description || '';
    
    if (product.image) {
      preview.style.display = 'block';
      previewImg.src = product.image;
    } else {
      preview.style.display = 'none';
    }
  } else {
    title.innerText = 'Add Product';
    form.reset();
    document.getElementById('product-id').value = '';
    document.getElementById('product-image').value = '';
    preview.style.display = 'none';
  }
  document.getElementById('product-image-file').value = '';
  modal.classList.add('active');
}

window.editProduct = function(id) {
  const product = products.find(p => p.id === id || p.id == id);
  if (product) openProductModal(product);
}

window.openCouponModal = function(coupon = null) {
  const modal = document.getElementById('coupon-modal');
  const title = document.getElementById('coupon-modal-title');
  const form = document.getElementById('coupon-form');
  
  if (coupon) {
    title.innerText = 'Edit Coupon';
    document.getElementById('coupon-id').value = coupon.id;
    document.getElementById('coupon-code').value = coupon.code;
    document.getElementById('coupon-discount').value = coupon.discount_percentage;
    document.getElementById('coupon-min-order').value = coupon.min_order_amount;
    document.getElementById('coupon-expiry').value = coupon.expiry_date.split('T')[0];
  } else {
    title.innerText = 'Add Coupon';
    form.reset();
    document.getElementById('coupon-id').value = '';
  }
  
  modal.classList.add('active');
}

window.editCoupon = function(id) {
  const coupon = coupons.find(c => c.id === id || c.id == id);
  if (coupon) openCouponModal(coupon);
}

window.closeModal = function(id) {
  document.getElementById(id).classList.remove('active');
}

// CRUD Operations

window.handleProductSubmit = async function(e) {
  e.preventDefault();
  const btn = document.getElementById('product-submit-btn');
  btn.disabled = true;
  btn.innerText = 'Saving...';
  
  const id = document.getElementById('product-id').value;
  let imageUrl = document.getElementById('product-image').value;
  const fileInput = document.getElementById('product-image-file');
  const file = fileInput.files[0];

  try {
    if (file) {
      btn.innerText = 'Uploading Image...';
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      let { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      // Fallback: Try to create the bucket if it doesn't exist
      if (uploadError && uploadError.message.toLowerCase().includes('bucket not found')) {
        console.log('Attempting to create missing bucket...');
        await supabase.storage.createBucket('product-images', { public: true });
        
        // Retry upload
        const retry = await supabase.storage.from('product-images').upload(filePath, file);
        uploadError = retry.error;
      }

      if (uploadError) {
        throw new Error('Upload Error: ' + uploadError.message + ' (If RLS policy error, make sure to add an "INSERT" policy to the product-images bucket in Supabase)');
      }

      const { data: publicUrlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      imageUrl = publicUrlData.publicUrl;
    }

    const productData = {
      name: document.getElementById('product-name').value,
      category: document.getElementById('product-category').value,
      price: parseFloat(document.getElementById('product-price').value),
      stock: parseInt(document.getElementById('product-stock').value),
      image: imageUrl,
      description: document.getElementById('product-description').value
    };

    if (id) {
      // Update
      const { error } = await supabase.from('Products').update(productData).eq('id', id);
      if (error) throw error;
      showToast('Product updated successfully', 'success');
    } else {
      // Insert
      const { error } = await supabase.from('Products').insert([productData]);
      if (error) throw error;
      showToast('Product added successfully', 'success');
    }
    
    closeModal('product-modal');
    fetchDashboardData();
  } catch (error) {
    console.error('Error saving product:', error);
    showToast(error.message || 'Error saving product', 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = 'Save Product';
  }
}

window.handleCouponSubmit = async function(e) {
  e.preventDefault();
  const btn = document.getElementById('coupon-submit-btn');
  btn.disabled = true;
  btn.innerText = 'Saving...';
  
  const id = document.getElementById('coupon-id').value;
  const couponData = {
    code: document.getElementById('coupon-code').value.toUpperCase(),
    discount_percentage: parseInt(document.getElementById('coupon-discount').value),
    min_order_amount: parseFloat(document.getElementById('coupon-min-order').value),
    expiry_date: document.getElementById('coupon-expiry').value
  };

  try {
    if (id) {
      const { error } = await supabase.from('Coupons').update(couponData).eq('id', id);
      if (error) throw error;
      showToast('Coupon updated successfully', 'success');
    } else {
      const { error } = await supabase.from('Coupons').insert([couponData]);
      if (error) throw error;
      showToast('Coupon added successfully', 'success');
    }
    
    closeModal('coupon-modal');
    fetchDashboardData();
  } catch (error) {
    console.error('Error saving coupon:', error);
    showToast(error.message || 'Error saving coupon', 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = 'Save Coupon';
  }
}

// Delete Confirmation
window.confirmDelete = function(id, type) {
  deleteId = id;
  deleteType = type;
  document.getElementById('delete-modal').classList.add('active');
}

document.getElementById('confirm-delete-btn').addEventListener('click', async (e) => {
  const btn = e.target;
  btn.disabled = true;
  btn.innerText = 'Deleting...';
  
  try {
    const table = deleteType === 'product' ? 'Products' : 'Coupons';
    const { error } = await supabase.from(table).delete().eq('id', deleteId);
    if (error) throw error;
    
    showToast(`${deleteType === 'product' ? 'Product' : 'Coupon'} deleted successfully`, 'success');
    closeModal('delete-modal');
    fetchDashboardData();
  } catch (error) {
    console.error('Delete error:', error);
    showToast(error.message || 'Error deleting item', 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = 'Delete';
  }
});

// Utils
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation'}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showLoading(elementId, isLoading) {
  const el = document.getElementById(elementId);
  if (el) el.style.display = isLoading ? 'block' : 'none';
}
