const products = [
  {
    id: 1,
    name: "Honeycrisp Apples",
    price: 4.99,
    image:
      "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 2,
    name: "Ataulfo Mangoes",
    price: 6.5,
    image:
      "https://images.unsplash.com/photo-1591073113125-e46713c829ed?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 3,
    name: "Blueberry Pack",
    price: 5.25,
    image:
      "https://images.unsplash.com/photo-1498557850523-fd3d118b962e?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 4,
    name: "Valencia Oranges",
    price: 3.75,
    image:
      "https://images.unsplash.com/photo-1582979512210-99b6a53386f9?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 5,
    name: "Seedless Grapes",
    price: 4.2,
    image:
      "https://images.unsplash.com/photo-1537640538966-79f369143f8f?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 6,
    name: "Dragon Fruit",
    price: 7.9,
    image:
      "https://images.unsplash.com/photo-1527325678964-54921661f888?auto=format&fit=crop&w=900&q=80",
  },
];

const cart = [];
const productGrid = document.getElementById("product-grid");
const cartItems = document.getElementById("cart-items");
const cartTotal = document.getElementById("cart-total");
const cartCount = document.getElementById("cart-count");
const cartPanel = document.getElementById("cart-panel");

function renderProducts() {
  productGrid.innerHTML = products
    .map(
      (product) => `
      <article class="product-card">
        <img src="${product.image}" alt="${product.name}" />
        <div class="product-body">
          <h3>${product.name}</h3>
          <div class="price-row">
            <span>$${product.price.toFixed(2)}</span>
            <button data-id="${product.id}">Add</button>
          </div>
        </div>
      </article>
    `
    )
    .join("");
}

function renderCart() {
  if (cart.length === 0) {
    cartItems.innerHTML = "<li>Your cart is empty.</li>";
    cartTotal.textContent = "0.00";
    cartCount.textContent = "0";
    return;
  }

  cartItems.innerHTML = cart
    .map((item) => `<li>${item.name} × ${item.qty} — $${(item.qty * item.price).toFixed(2)}</li>`)
    .join("");

  const total = cart.reduce((sum, item) => sum + item.qty * item.price, 0);
  const count = cart.reduce((sum, item) => sum + item.qty, 0);

  cartTotal.textContent = total.toFixed(2);
  cartCount.textContent = count;
}

productGrid.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const id = Number(target.dataset.id);
  const product = products.find((item) => item.id === id);

  if (!product) {
    return;
  }

  const existingItem = cart.find((item) => item.id === id);

  if (existingItem) {
    existingItem.qty += 1;
  } else {
    cart.push({ ...product, qty: 1 });
  }

  renderCart();
});

document.getElementById("cart-button").addEventListener("click", () => {
  cartPanel.classList.add("open");
});

document.getElementById("close-cart").addEventListener("click", () => {
  cartPanel.classList.remove("open");
});

renderProducts();
renderCart();
