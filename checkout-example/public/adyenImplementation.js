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
      //one function for create checkout and mount
      checkout.create(type, {
       //showStoredPaymentMethods: false
      }).mount(`${elementId}-container`);
    });

   //works for paypal with missing string "container" 
   //checkout.create(type).mount(document.getElementById(`${type}-container`));

    //Alternative split create and mount in two functions
    /* const checkoutComp = checkout.create(type, {
      //showStoredPaymentMethods: false
     })
     console.log("after checkout create") 
    checkoutComp.mount(elementId);
    console.log("after mount") */
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
    //showStoredPaymentMethods: false, // not here!!
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
      klarna: {
        name:"KlarnaCustomName",
        amount: { currency: selectedCurrency, value: 10000 },
      },
    },

      //+++++++
          //++ Card Component Event Handlers++
          //from https://docs.adyen.com/payment-methods/cards/web-component/#optional-configuration:~:text=callback.-,Events,-You%20can%20also
          //+++++++
          
    
          
    onPaymentCompleted: (result, component) => {
      console.log("Payment completed:", result);
      handleServerResponse(result, component);
    },
    onError: (error, component) => {
      console.error("Checkout error:", error);
    },
    /* onSubmit: (state, component) => {
      console.log("onSubmit called");
      console.log("State:", state);
      console.log("Component:", component);
    
      // Simulate a delay of 3 seconds before continuing with the payment flow
      setTimeout(() => {
        console.log("Proceeding with payment after 3 seconds...");
        // Continue the payment flow
        actions.resolve();
      }, 3000); // Delay of 3 seconds
    }, */
    
    onChange:(state, component) => {
      //console.log("this is the state: ", state)
      console.log("triggering onChange")
    }

    //onFieldValid does not work with sessions?
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