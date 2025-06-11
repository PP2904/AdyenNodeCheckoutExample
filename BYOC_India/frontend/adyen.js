const clientKey = "<YOUR_CLIENT_KEY>"; // from Adyen Customer Area

async function getPaymentMethods() {
  const response = await fetch("http://localhost:8080/api/getPaymentMethods", {
    method: "POST",
  });
  return await response.json();
}

async function makePayment(paymentData) {
  const response = await fetch("http://localhost:8080/api/initiatePayment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(paymentData),
  });
  return await response.json();
}

async function submitAdditionalDetails(detailsData) {
  const response = await fetch("http://localhost:8080/api/submitAdditionalDetails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(detailsData),
  });
  return await response.json();
}

async function initCheckout() {
  const paymentMethodsResponse = await getPaymentMethods();

  const checkout = await AdyenCheckout({
    environment: "test", // change to 'live' for production
    clientKey,
    paymentMethodsResponse,
    onSubmit: async (state, component) => {
      if (state.isValid) {
        const response = await makePayment(state.data);
        if (response.action) {
          component.handleAction(response.action);
        } else {
          handleResult(response.resultCode);
        }
      }
    },
    onAdditionalDetails: async (state, component) => {
      const response = await submitAdditionalDetails(state.data);
      if (response.action) {
        component.handleAction(response.action);
      } else {
        handleResult(response.resultCode);
      }
    },
  });

  checkout.create("card").mount("#payment-container");
  checkout.create("ideal").mount("#payment-container");
  checkout.create("paypal").mount("#payment-container");
}

function handleResult(resultCode) {
  switch (resultCode) {
    case "Authorised":
      alert("Payment successful!");
      break;
    case "Refused":
      alert("Payment refused!");
      break;
    case "Pending":
    case "Received":
      alert("Payment pending!");
      break;
    default:
      alert("Payment error!");
  }
}

window.onload = initCheckout;
