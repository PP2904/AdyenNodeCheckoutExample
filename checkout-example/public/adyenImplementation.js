const clientKey = document.getElementById("clientKey").textContent;
const typeList = JSON.parse(document.getElementById("typeList").textContent);

// Retrieve the selected locale and currency from localStorage
const selectedLocale = localStorage.getItem("selectedLocale") || "en_US";
const selectedCurrency = localStorage.getItem("selectedCurrency") || "USD";

// Used to finalize a checkout call in case of redirect
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('sessionId');
const redirectResult = urlParams.get('redirectResult');

async function startCheckout() {
  try {
    const checkoutSessionResponse = await callServer("/api/sessions");

    const checkout = await createAdyenCheckout(checkoutSessionResponse);

    // Dynamically create and mount components for each type in typeList
    typeList.forEach(type => {
      const elementId = `#${type}`;
      checkout.create(type).mount(elementId);
    });

  } catch (error) {
    console.error(error);
    alert("Error occurred. Look at console for details");
  }
}

// Finalize checkout for redirects
async function finalizeCheckout() {
  try {
    const checkout = await createAdyenCheckout({ id: sessionId });
    checkout.submitDetails({ details: { redirectResult } });
  } catch (error) {
    console.error(error);
    alert("Error occurred. Look at console for details");
  }
}

async function createAdyenCheckout(session) {
  const configuration = {
    clientKey,
    locale: selectedLocale, // Set locale based on selection
    environment: "test",
    showPayButton: true,
    session: session,
    paymentMethodsConfiguration: {
      ideal: { 
        showImage: true,
        amount: { currency: selectedCurrency, value: 10000 },
      },
      card: {
        hasHolderName: true,
        holderNameRequired: true,
        name: "Credit or debit card",
        amount: { currency: selectedCurrency, value: 10000 },
        /*  //click to pay config
          clickToPayConfiguration: {
            //Card PAN enrolled for CTP for MC: 5186001700008785
            merchantDisplayName: 'PeterPEcom',
            shopperEmail: 'pfrommer.peter@gmail.com' // Used to recognize your shopper's Click to Pay account.
          },  */
      },
      paypal: {
        amount: { currency: selectedCurrency, value: 10000 },
        environment: "test",
      },
      twint: {
        amount: { currency: selectedCurrency, value: 10000 },
      }
    },
    onPaymentCompleted: (result, component) => {
      handleServerResponse(result, component);
    },
    onError: (error, component) => {
      console.error(error.name, error.message, error.stack, component);
    }
  };

  return new AdyenCheckout(configuration);
}

// Function to make calls to the server
async function callServer(url, data) {
  const res = await fetch(url, {
    method: "POST",
    body: data ? JSON.stringify(data) : "",
    headers: { "Content-Type": "application/json" }
  });
  return await res.json();
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
  startCheckout();
} else {
  finalizeCheckout();
}