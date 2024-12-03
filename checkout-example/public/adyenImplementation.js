const clientKey = document.getElementById("clientKey").textContent;
const typeList = JSON.parse(document.getElementById("typeList").textContent);

// Retrieve the selected locale, country, and currency from localStorage
const selectedLocale = localStorage.getItem("selectedLocale") || "en_US";
const selectedCurrency = localStorage.getItem("selectedCurrency") || "USD";
const selectedCountry = localStorage.getItem("selectedCountry") || "US";

// Log selected values for debugging
console.log("Selected Locale:", selectedLocale);
console.log("Selected Currency:", selectedCurrency);
console.log("Selected Country:", selectedCountry);

// Used to finalize a checkout call in case of redirect
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('sessionId');
const redirectResult = urlParams.get('redirectResult');

// Start the checkout process
async function startCheckout() {
  try {
    console.log("Starting checkout process...");

    // Pass selected country and currency to the backend
    const sessionData = {
      country: selectedCountry,
      currency: selectedCurrency,
    };

    const checkoutSessionResponse = await callServer("/api/sessions", sessionData);

    console.log("Session Response from Server:", checkoutSessionResponse);

    const checkout = await createAdyenCheckout(checkoutSessionResponse);

    // Dynamically create and mount components for each type in typeList
    typeList.forEach((type) => {
      console.log(`Mounting payment method: ${type}`);
      const elementId = `#${type}`;
      checkout.create(type, {
       //showStoredPaymentMethods: false
      }).mount(elementId);
    });
  } catch (error) {
    console.error("Error during checkout initialization:", error);
    alert("Error occurred. Look at console for details");
  }
}

// Finalize checkout for redirects
async function finalizeCheckout() {
  try {
    console.log("Finalizing checkout for redirect...");
    const checkout = await createAdyenCheckout({ id: sessionId });
    checkout.submitDetails({ details: { redirectResult } });
  } catch (error) {
    console.error("Error during redirect handling:", error);
    alert("Error occurred. Look at console for details");
  }
}

// global Drop-in Configuration + passing session
async function createAdyenCheckout(session) {
  console.log("Initializing Adyen Checkout with session:", session);

  const configuration = {
    clientKey,
    locale: selectedLocale, // Set locale based on selection
    environment: "test",
    //showStoredPaymentMethods: false, // Optionally hide stored payment methods
    showPayButton: true, // Show the Pay button
    session: session,
    showBrandIcon: false,
    paymentMethodsConfiguration: {
      riverty: {
        visibility: {
          personalDetails: "hidden", // These fields will not appear on the payment form.
          billingAddress: "readOnly", // These fields will appear on the payment form, but the shopper cannot edit them.
          deliveryAddress: "editable", // These fields will appear on the payment form, and the shopper can edit them.
        },
      },
      ideal: {
        showImage: true,
        amount: { currency: selectedCurrency, value: 10000 },
      },
      card: {
        hasHolderName: false,
        name: "Credit or debit card",
        amount: { currency: selectedCurrency, value: 10000 },
      },
      paypal: {
        amount: { currency: selectedCurrency, value: 10000 },
        environment: "test",
      },
      twint: {
        amount: { currency: selectedCurrency, value: 10000 },
      },
    },
    onPaymentCompleted: (result, component) => {
      console.log("Payment completed:", result);
      handleServerResponse(result, component);
    },
    onError: (error, component) => {
      console.error("Checkout error:", error);
    },
  };

  return new AdyenCheckout(configuration);
}

// Function to make calls to the server
async function callServer(url, data) {
  console.log("Calling server with:", data);
  const res = await fetch(url, {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
  const response = await res.json();
  console.log("Server Response:", response);
  return response;
}

// Handle server responses
function handleServerResponse(res, component) {
  if (res.action) {
    component.handleAction(res.action);
  } else {
    switch (res.resultCode) {
      case "Authorised":
        window.location.href = "/result/success";
        break;
      case "Pending":
      case "Received":
        window.location.href = "/result/pending";
        break;
      case "Refused":
        window.location.href = "/result/failed";
        break;
      default:
        window.location.href = "/result/error";
        break;
    }
  }
}

// Start checkout process
if (!sessionId) {
  console.log("No sessionId detected, starting checkout...");
  startCheckout();
} else {
  console.log("sessionId detected, finalizing checkout...");
  finalizeCheckout();
}