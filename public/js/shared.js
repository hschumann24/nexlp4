// Ensure the cart exists in localStorage
function initializeCart() {
    if (!localStorage.getItem("cart")) {
        localStorage.setItem("cart", JSON.stringify([]));
    }
}

// Load the order summary onto the checkout page
function loadOrderSummary() {
    console.log("loadOrderSummary called");

    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    console.log("Cart contents:", cart);

    const orderSummary = document.getElementById("order-summary");
    const checkoutButton = document.getElementById("checkout-button");

    if (!orderSummary || !checkoutButton) {
        console.error("Required DOM elements not found.");
        return;
    }

    // If the cart is empty, disable the button and show a message
    if (cart.length === 0) {
        orderSummary.innerHTML = "<p>Your cart is empty.</p>";
        checkoutButton.disabled = true;
        return;
    }

    let summaryHTML = '';
    cart.forEach((item, index) => {
        summaryHTML += `
            <div class="order-summary-item">
                <strong>${item.productName}</strong> (Product Number: ${item.productNumber})<br>
                <em>Customizations:</em> ${Object.entries(item)
                    .filter(([key]) => !['productName', 'productNumber'].includes(key))
                    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                    .join('<br>')}
                <button onclick="removeFromCart(${index})">Remove</button>
            </div>
        `;
    });

    orderSummary.innerHTML = summaryHTML;
    checkoutButton.disabled = false; // Enable checkout button
}

// Add an item to the cart
function addToCart(item) {
    console.log("addToCart called with item:", item);

    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    cart.push(item);
    localStorage.setItem("cart", JSON.stringify(cart));

    console.log("Item added to cart. Updated cart:", cart);
}

// Remove an item from the cart
function removeFromCart(index) {
    console.log("removeFromCart called for index:", index);

    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    if (index >= 0 && index < cart.length) {
        cart.splice(index, 1);
        localStorage.setItem("cart", JSON.stringify(cart));
        console.log("Item removed. Updated cart:", cart);

        const orderSummary = document.getElementById("order-summary");
        if (orderSummary) loadOrderSummary();
    } else {
        console.error("Invalid index:", index);
    }
}

// Clear the entire cart
function clearCart() {
    console.log("clearCart called");
    localStorage.removeItem("cart");
    console.log("Cart cleared.");
}

// Map product numbers to API endpoints
function getApiEndpoint(productNumber) {
    const apiRoutes = {
        101: '/.netlify/functions/createCookbook', // Example endpoint for cookbooks
        // Add more product numbers and their endpoints here
    };
    return apiRoutes[productNumber] || null;
}

// Handle checkout process
async function handleCheckout() {
    console.log("handleCheckout called");

    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const groupedProducts = {};
    const downloadLinks = [];

    // Group products by product number
    cart.forEach((item) => {
        if (!groupedProducts[item.productNumber]) {
            groupedProducts[item.productNumber] = [];
        }
        groupedProducts[item.productNumber].push(item);
    });

    // Send grouped products to respective APIs
    for (const [productNumber, items] of Object.entries(groupedProducts)) {
        const apiEndpoint = getApiEndpoint(productNumber);

        if (apiEndpoint) {
            try {
                const response = await fetch(apiEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items }),
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.downloadLink) {
                        downloadLinks.push(result.downloadLink);
                    }
                } else {
                    console.error(`Error with product ${productNumber}:`, await response.text());
                }
            } catch (error) {
                console.error(`Error with product ${productNumber}:`, error.message);
            }
        }
    }

    // Save download links to localStorage
    localStorage.setItem('downloadLinks', JSON.stringify(downloadLinks));

    // Clear the cart
    clearCart();

    // Redirect to confirmation page
    window.location.href = "confirmation.html";
}

// Display results on confirmation page
function loadConfirmationPage() {
    console.log("loadConfirmationPage called");

    const downloadLinks = JSON.parse(localStorage.getItem('downloadLinks')) || [];
    const resultDiv = document.getElementById('result');

    if (downloadLinks.length === 0) {
        resultDiv.innerHTML = "<p>No download links available. Please contact support.</p>";
        return;
    }

    const linksHTML = downloadLinks
        .map((link, index) => `<p>Download your file <a href="${link}" target="_blank">here</a>.</p>`)
        .join('');
    resultDiv.innerHTML = linksHTML;

    // Optionally clear the stored links after displaying them
    // localStorage.removeItem('downloadLinks');
}

// Initialize shared.js functionality
document.addEventListener("DOMContentLoaded", () => {
    console.log("shared.js loaded. Initializing cart...");
    initializeCart();

    // If the page contains an order summary, load it
    const orderSummary = document.getElementById("order-summary");
    if (orderSummary) loadOrderSummary();

    // Attach checkout handler if checkout button exists
    const checkoutButton = document.getElementById("checkout-button");
    if (checkoutButton) {
        checkoutButton.addEventListener("click", handleCheckout);
    }

    // If on confirmation.html, load the results
    const resultDiv = document.getElementById('result');
    if (resultDiv) loadConfirmationPage();
});
